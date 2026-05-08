'use strict';

/**
 * eslint-effective-config
 *
 * Resolve the *effective* eslint configuration for a target repo by shelling
 * out to the repo's own eslint via `eslint --print-config <file>`. This
 * correctly resolves `extends`, presets, plugins, and flat-config layering
 * without us re-implementing eslint's resolution logic.
 *
 * Public API:
 *   resolveEslintConfig(repoPath, sampleFiles?) -> {
 *     configs:       { [relativeFilePath]: parsedJson },
 *     eslintVersion: string | null,
 *     errors:        Array<{ stage, file?, message, code? }>
 *   }
 *
 * Design notes:
 *   - No external deps. Uses only `node:` builtins.
 *   - `execFileSync` with a hard timeout so a wedged eslint can't hang us.
 *   - Prefers the target repo's local `node_modules/.bin/eslint`. Falls back
 *     to `npx --no-install eslint` (which still uses a locally-installed
 *     eslint without trying to download one). If neither is available we
 *     return a structured error rather than throwing.
 *   - Works for both flat config (`eslint.config.*`) and legacy `.eslintrc*`
 *     repos — `eslint --print-config` is the same CLI for both.
 *
 * Sample-file selection (when `sampleFiles` not provided):
 *   pick at most one `.ts`, one `.tsx`, one `.js` from `src/**` first, then
 *   from the repo root. We deliberately keep this small (3 files max) so
 *   we capture per-language overrides without exploding runtime.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BUFFER = 16 * 1024 * 1024; // 16MB; print-config output can be large

/**
 * @param {string} repoPath  Absolute path to the target repo.
 * @param {string[]} [sampleFiles]  Optional explicit sample files
 *   (relative to repoPath). If omitted, auto-pick.
 * @returns {{
 *   configs: Record<string, unknown>,
 *   eslintVersion: string | null,
 *   errors: Array<{ stage: string, file?: string, message: string, code?: string }>
 * }}
 */
function resolveEslintConfig(repoPath, sampleFiles) {
  const errors = [];
  const configs = {};
  let eslintVersion = null;

  if (!repoPath || typeof repoPath !== 'string') {
    return {
      configs,
      eslintVersion,
      errors: [{ stage: 'validate', message: 'repoPath is required and must be a string' }],
    };
  }

  let absRepo;
  try {
    absRepo = path.resolve(repoPath);
    const st = fs.statSync(absRepo);
    if (!st.isDirectory()) {
      return {
        configs,
        eslintVersion,
        errors: [{ stage: 'validate', message: `repoPath is not a directory: ${absRepo}` }],
      };
    }
  } catch (err) {
    return {
      configs,
      eslintVersion,
      errors: [{ stage: 'validate', message: `repoPath not accessible: ${err.message}` }],
    };
  }

  // 1. Pick the eslint runner.
  const runner = detectEslintRunner(absRepo);
  if (!runner) {
    errors.push({
      stage: 'detect-binary',
      message:
        'No eslint binary found. Tried node_modules/.bin/eslint and npx --no-install eslint.',
    });
    return { configs, eslintVersion, errors };
  }

  // 2. Get version (best-effort; not fatal).
  try {
    const out = execFileSync(runner.cmd, [...runner.args, '--version'], {
      cwd: absRepo,
      encoding: 'utf8',
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    eslintVersion = out.trim() || null;
  } catch (err) {
    errors.push({
      stage: 'eslint-version',
      message: `Failed to read eslint version: ${shortErr(err)}`,
      code: err.code,
    });
  }

  // 3. Resolve sample files.
  const files =
    Array.isArray(sampleFiles) && sampleFiles.length > 0
      ? sampleFiles
      : autoPickSampleFiles(absRepo);

  if (files.length === 0) {
    errors.push({
      stage: 'sample-files',
      message: 'No representative .ts/.tsx/.js files found in src/ or repo root.',
    });
    return { configs, eslintVersion, errors };
  }

  // 4. Run --print-config per file.
  for (const rel of files) {
    try {
      const stdout = execFileSync(
        runner.cmd,
        [...runner.args, '--print-config', rel],
        {
          cwd: absRepo,
          encoding: 'utf8',
          timeout: DEFAULT_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      try {
        configs[rel] = JSON.parse(stdout);
      } catch (parseErr) {
        errors.push({
          stage: 'parse-print-config',
          file: rel,
          message: `Could not parse eslint --print-config output as JSON: ${parseErr.message}`,
        });
      }
    } catch (err) {
      errors.push({
        stage: 'print-config',
        file: rel,
        message: shortErr(err),
        code: err.code,
      });
    }
  }

  return { configs, eslintVersion, errors };
}

/**
 * Pick how to invoke eslint inside the target repo.
 * Returns `{ cmd, args }` or null.
 *
 * Preference order:
 *   1. <repo>/node_modules/.bin/eslint  (uses the repo's exact pinned eslint)
 *   2. npx --no-install eslint          (still resolves locally; refuses to
 *                                       download). Only returned if `npx` is
 *                                       on PATH; we don't probe further to
 *                                       avoid spawning a process here.
 */
function detectEslintRunner(absRepo) {
  const localBin = path.join(
    absRepo,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'eslint.cmd' : 'eslint',
  );
  try {
    fs.accessSync(localBin, fs.constants.X_OK);
    return { cmd: localBin, args: [] };
  } catch {
    // fall through
  }

  // npx fallback. We don't sniff PATH here — if npx is missing the actual
  // execFileSync call below will surface ENOENT and we record it as a
  // structured error.
  return { cmd: 'npx', args: ['--no-install', 'eslint'] };
}

/**
 * Auto-pick representative sample files: at most one of each of
 * .ts / .tsx / .js. Prefer files under `src/`, fall back to repo root.
 * Returned paths are relative to `absRepo`.
 */
function autoPickSampleFiles(absRepo) {
  const wantedExts = ['.ts', '.tsx', '.js'];
  const found = new Map(); // ext -> relPath

  const srcDir = path.join(absRepo, 'src');
  if (safeIsDir(srcDir)) {
    walk(srcDir, absRepo, wantedExts, found, /* maxDepth */ 6);
  }
  // Fill any missing exts from repo root (non-recursive).
  if (found.size < wantedExts.length) {
    walk(absRepo, absRepo, wantedExts, found, /* maxDepth */ 1);
  }

  return wantedExts.map((e) => found.get(e)).filter(Boolean);
}

function walk(dir, absRepo, wantedExts, found, maxDepth, depth = 0) {
  if (depth > maxDepth) return;
  if (found.size >= wantedExts.length) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  // Files first so a shallow hit wins over a deeper one.
  entries.sort((a, b) => Number(a.isDirectory()) - Number(b.isDirectory()));

  for (const entry of entries) {
    if (found.size >= wantedExts.length) return;
    const name = entry.name;
    if (name.startsWith('.')) continue;
    if (name === 'node_modules' || name === 'dist' || name === 'build' || name === 'coverage') {
      continue;
    }
    const full = path.join(dir, name);
    if (entry.isDirectory()) {
      walk(full, absRepo, wantedExts, found, maxDepth, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(name);
      if (wantedExts.includes(ext) && !found.has(ext)) {
        // Skip declaration files.
        if (name.endsWith('.d.ts')) continue;
        found.set(ext, path.relative(absRepo, full));
      }
    }
  }
}

function safeIsDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function shortErr(err) {
  // execFileSync errors include stdout/stderr; surface stderr if present.
  if (err && err.stderr) {
    const s = err.stderr.toString().trim();
    if (s) return s.split('\n').slice(0, 5).join('\n');
  }
  return err && err.message ? err.message : String(err);
}

module.exports = { resolveEslintConfig };
