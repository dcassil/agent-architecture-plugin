'use strict';

/**
 * tsconfig-effective-config
 *
 * Resolve the *effective* tsconfig for a target repo by shelling out to the
 * repo's own TypeScript via `tsc --showConfig`. This correctly follows
 * `extends` chains (including `@tsconfig/*` presets and monorepo bases)
 * without us re-implementing TS's resolution logic.
 *
 * Public API:
 *   resolveTsconfig(repoPath, opts?) -> {
 *     compilerOptions: object | null,   // resolved compilerOptions, or null on failure
 *     source:          'tsc' | 'literal' | 'none',
 *     tscVersion:      string | null,
 *     errors:          Array<{ stage, message, code? }>
 *   }
 *
 * Resolution strategy (in order):
 *   1. <repo>/node_modules/.bin/tsc --showConfig
 *   2. npx --no-install tsc --showConfig
 *   3. Literal read of tsconfig.json (loses extends — last resort)
 *
 * No external deps. Mirrors the design of eslint-effective-config.js.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BUFFER = 16 * 1024 * 1024;

function resolveTsconfig(repoPath, opts = {}) {
  const errors = [];

  if (!repoPath || typeof repoPath !== 'string') {
    return {
      compilerOptions: null,
      source: 'none',
      tscVersion: null,
      errors: [{ stage: 'validate', message: 'repoPath is required and must be a string' }],
    };
  }

  const absRepo = path.resolve(repoPath);
  const tsconfigPath = path.join(absRepo, 'tsconfig.json');
  if (!safeIsFile(tsconfigPath)) {
    return {
      compilerOptions: null,
      source: 'none',
      tscVersion: null,
      errors: [{ stage: 'validate', message: `no tsconfig.json at ${tsconfigPath}` }],
    };
  }

  // 1. Try tsc --showConfig (preferred — resolves extends).
  const runner = detectTscRunner(absRepo);
  if (runner) {
    let tscVersion = null;
    try {
      const out = execFileSync(runner.cmd, [...runner.args, '--version'], {
        cwd: absRepo,
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      tscVersion = out.trim() || null;
    } catch (err) {
      errors.push({ stage: 'tsc-version', message: shortErr(err), code: err.code });
    }

    try {
      const stdout = execFileSync(runner.cmd, [...runner.args, '--showConfig'], {
        cwd: absRepo,
        encoding: 'utf8',
        timeout: DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(stdout);
      return {
        compilerOptions: parsed.compilerOptions || {},
        source: 'tsc',
        tscVersion,
        errors,
      };
    } catch (err) {
      errors.push({ stage: 'tsc-showconfig', message: shortErr(err), code: err.code });
      // fall through to literal read
    }
  } else {
    errors.push({
      stage: 'detect-binary',
      message: 'No tsc binary found. Tried node_modules/.bin/tsc and npx --no-install tsc.',
    });
  }

  // 2. Fallback: literal JSONC read of tsconfig.json (does NOT follow extends).
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf8');
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(stripped);
    return {
      compilerOptions: parsed.compilerOptions || {},
      source: 'literal',
      tscVersion: null,
      errors,
    };
  } catch (err) {
    errors.push({ stage: 'literal-read', message: shortErr(err) });
    return { compilerOptions: null, source: 'none', tscVersion: null, errors };
  }
}

function detectTscRunner(absRepo) {
  const localBin = path.join(
    absRepo,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
  );
  try {
    fs.accessSync(localBin, fs.constants.X_OK);
    return { cmd: localBin, args: [] };
  } catch {
    /* fall through */
  }
  return { cmd: 'npx', args: ['--no-install', 'tsc'] };
}

function safeIsFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function shortErr(err) {
  if (err && err.stderr) {
    const s = err.stderr.toString().trim();
    if (s) return s.slice(0, 500);
  }
  if (err && err.message) return err.message;
  return String(err);
}

module.exports = { resolveTsconfig };
