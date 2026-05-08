'use strict';

// Persist the resolved init plan + apply summary to
// `.dev-genie/init.last-run.json` so re-runs can diff against the prior state
// and prompt only on real changes.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCHEMA_VERSION = 1;
const STORE_DIR = '.dev-genie';
const STORE_FILE = 'init.last-run.json';

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function storePath(repo) {
  return path.join(repo, STORE_DIR, STORE_FILE);
}

/**
 * Read prior run JSON. Returns null if missing or unparseable.
 */
function loadLastRun(repoPath) {
  const f = storePath(path.resolve(repoPath));
  if (!exists(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/**
 * Compute a stable fingerprint of files that influence detection so we can
 * tell whether the user manually edited config since the last run.
 */
function repoFingerprint(repoPath) {
  const repo = path.resolve(repoPath);
  const candidates = [
    'package.json',
    'eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts',
    '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs',
    'tsconfig.json',
    '.prettierrc', '.prettierrc.json', 'prettier.config.js',
    'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.windsurfrules',
    '.husky/pre-commit', 'lefthook.yml', '.pre-commit-config.yaml',
  ];
  const h = crypto.createHash('sha256');
  for (const rel of candidates) {
    const full = path.join(repo, rel);
    if (!exists(full)) continue;
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        h.update(rel);
        h.update('\0');
        h.update(fs.readFileSync(full));
        h.update('\n');
      }
    } catch {}
  }
  return h.digest('hex').slice(0, 16);
}

/**
 * Ensure `.dev-genie/` is gitignored. Idempotent. Returns true if updated.
 */
function ensureGitignore(repoPath) {
  const repo = path.resolve(repoPath);
  const gi = path.join(repo, '.gitignore');
  let content = '';
  try { content = fs.readFileSync(gi, 'utf8'); } catch {}
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.trim() === '.dev-genie/' || l.trim() === '.dev-genie')) {
    return false;
  }
  const next = (content && !content.endsWith('\n') ? content + '\n' : content) + '.dev-genie/\n';
  fs.writeFileSync(gi, next, 'utf8');
  return true;
}

/**
 * @param {string} repoPath
 * @param {{ plan?: any[], applied?: any[], skipped?: any[], errors?: any[], extra?: object }} payload
 */
function saveLastRun(repoPath, payload = {}) {
  const repo = path.resolve(repoPath);
  const dir = path.join(repo, STORE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const body = {
    schemaVersion: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    repoFingerprint: repoFingerprint(repo),
    plan: payload.plan || [],
    applied: payload.applied || [],
    skipped: payload.skipped || [],
    errors: payload.errors || [],
    ...(payload.extra ? { extra: payload.extra } : {}),
  };
  fs.writeFileSync(storePath(repo), JSON.stringify(body, null, 2) + '\n', 'utf8');
  return body;
}

/**
 * Compare a current plan against the prior run's plan. Returns the subset of
 * findings that are new or changed. Identity is by `id` if present, else by a
 * synthetic key over `(file, classification, ruleName)`.
 */
function diffPlan(currentPlan, lastRun) {
  if (!lastRun || !Array.isArray(lastRun.plan)) return { newFindings: currentPlan, unchanged: [] };
  function keyOf(f) {
    if (f && f.id) return String(f.id);
    return [f && f.file, f && f.classification, f && f.ruleName].join('|');
  }
  const prior = new Map();
  for (const f of lastRun.plan) prior.set(keyOf(f), f);
  const newFindings = [];
  const unchanged = [];
  for (const f of currentPlan) {
    const k = keyOf(f);
    if (!prior.has(k)) newFindings.push(f);
    else unchanged.push(f);
  }
  return { newFindings, unchanged };
}

module.exports = {
  SCHEMA_VERSION,
  storePath,
  loadLastRun,
  saveLastRun,
  repoFingerprint,
  ensureGitignore,
  diffPlan,
};
