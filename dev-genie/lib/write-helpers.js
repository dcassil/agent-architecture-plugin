'use strict';

// Write helpers extracted from skills/project-detection/detect-build-ci.js so
// that detector module remains read-only. These functions idempotently mutate
// package.json scripts and create a guard-rails GitHub Actions workflow.
//
// No external deps. Node 18+.

const fs = require('node:fs');
const path = require('node:path');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function detectIndent(raw) {
  if (!raw) return '  ';
  const m = raw.match(/^\{\s*\n([ \t]+)/);
  if (m) return m[1];
  return '  ';
}

/**
 * Idempotently merge `scripts` into package.json#scripts.
 * - Preserves existing scripts; never overwrites unless allowOverwrite is true.
 * - Preserves existing JSON indentation.
 * - Returns { added: [...], skipped: [...], overwritten: [...] }.
 */
function addPackageScripts(repoPath, scripts, opts = {}) {
  const { allowOverwrite = false } = opts;
  const repo = path.resolve(repoPath);
  const pkgPath = path.join(repo, 'package.json');
  const raw = readFileSafe(pkgPath);
  if (raw == null) throw new Error(`package.json not found at ${pkgPath}`);
  const indent = detectIndent(raw);
  let pkg;
  try { pkg = JSON.parse(raw); }
  catch (e) { throw new Error(`failed to parse package.json: ${e.message}`); }
  pkg.scripts = pkg.scripts || {};
  const added = [];
  const skipped = [];
  const overwritten = [];
  for (const [name, body] of Object.entries(scripts || {})) {
    const has = Object.prototype.hasOwnProperty.call(pkg.scripts, name);
    if (!has) {
      pkg.scripts[name] = body;
      added.push(name);
    } else if (pkg.scripts[name] === body) {
      skipped.push(name);
    } else if (allowOverwrite) {
      pkg.scripts[name] = body;
      overwritten.push(name);
    } else {
      skipped.push(name);
    }
  }
  const trailing = raw.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + trailing);
  return { added, skipped, overwritten, path: pkgPath };
}

/**
 * Write a GitHub Actions workflow at `.github/workflows/<name>.yml` that runs
 * each provided npm script on push/PR. Errors if the file already exists
 * (caller must confirm overwrite by passing `allowOverwrite: true`).
 */
function addGithubActionsWorkflow(repoPath, opts) {
  const {
    name = 'guard-rails',
    commands,
    nodeVersion = '20',
    packageManager = 'npm',
    allowOverwrite = false,
  } = opts || {};
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('commands must be a non-empty array');
  }
  const repo = path.resolve(repoPath);
  const wfDir = path.join(repo, '.github/workflows');
  const wfPath = path.join(wfDir, `${name}.yml`);
  if (exists(wfPath) && !allowOverwrite) {
    const err = new Error(
      `workflow already exists at ${path.relative(repo, wfPath)}; pass allowOverwrite: true to replace`,
    );
    err.code = 'EEXIST';
    err.path = wfPath;
    throw err;
  }
  fs.mkdirSync(wfDir, { recursive: true });
  const installCmd =
    packageManager === 'pnpm' ? 'pnpm install --frozen-lockfile'
    : packageManager === 'yarn' ? 'yarn install --frozen-lockfile'
    : 'npm ci';
  const setupCache = packageManager;
  const lines = [];
  lines.push(`name: ${name}`);
  lines.push('');
  lines.push('on:');
  lines.push('  push:');
  lines.push('    branches: [main]');
  lines.push('  pull_request:');
  lines.push('');
  lines.push('jobs:');
  lines.push('  guard-rails:');
  lines.push('    runs-on: ubuntu-latest');
  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v4');
  lines.push('      - uses: actions/setup-node@v4');
  lines.push('        with:');
  lines.push(`          node-version: '${nodeVersion}'`);
  lines.push(`          cache: '${setupCache}'`);
  lines.push(`      - run: ${installCmd}`);
  for (const cmd of commands) {
    const safe = String(cmd).replace(/'/g, `'\\''`);
    lines.push(`      - run: '${safe}'`);
  }
  const yaml = lines.join('\n') + '\n';
  fs.writeFileSync(wfPath, yaml);
  return { path: wfPath, overwritten: exists(wfPath) && allowOverwrite };
}

module.exports = { addPackageScripts, addGithubActionsWorkflow };
