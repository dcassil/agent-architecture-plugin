'use strict';

// Unified enforcement installer facade.
//
// Wraps the existing pre-commit installer and write-helpers to provide a
// single entry point for `apply-flow.js` to wire missing enforcement steps
// (lint / typecheck / audit) across pre-commit AND build/CI.
//
// Cooperates with the audit plugin's hook installer: when audit's hook is
// already managing pre-commit, we add commands to the same hook file rather
// than writing a competing one.

const path = require('node:path');
const fs = require('node:fs');

const { addPackageScripts, addGithubActionsWorkflow } = require('./write-helpers.js');

// pre-commit.mjs is ESM; we lazy-import it from the async wrappers below.
async function loadPrecommit() {
  return await import('../scripts/lib/pre-commit.mjs');
}

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

/**
 * Pick the right pre-commit framework based on detection signals.
 * @param {object} hookConfigs result of detect-config.js#detectHooks (or
 *   the new detect-pre-commit) — we accept any of the framework hints.
 */
function chooseFramework(repoPath) {
  const repo = path.resolve(repoPath);
  if (exists(path.join(repo, '.husky'))) return 'husky';
  if (exists(path.join(repo, 'lefthook.yml')) || exists(path.join(repo, 'lefthook.yaml'))) return 'lefthook';
  if (exists(path.join(repo, '.pre-commit-config.yaml'))) return 'pre-commit';
  if (exists(path.join(repo, 'package.json'))) return 'husky'; // recommended default
  return 'pre-commit-raw';
}

/**
 * Ensure a pre-commit hook runs the requested commands. Idempotent.
 * @param {string} repoPath
 * @param {{ lint?: boolean, typecheck?: boolean, audit?: boolean }} commands
 */
async function ensurePreCommit(repoPath, commands = { lint: true, typecheck: true }) {
  const { detectPreCommit, installPreCommitHooks } = await loadPrecommit();
  const detection = await detectPreCommit(repoPath);
  const system = detection.systems[0]?.system || chooseFramework(repoPath);
  const cmds = [];
  if (commands.lint) cmds.push('lint');
  if (commands.typecheck) cmds.push('typecheck');
  if (commands.audit) cmds.push('audit');
  const result = await installPreCommitHooks(repoPath, { system, commands: cmds });
  return { framework: system, ...result };
}

/**
 * Ensure package.json has lint and typecheck scripts. Returns a summary.
 */
function ensurePackageScripts(repoPath, scripts = { lint: 'eslint .', typecheck: 'tsc -p tsconfig.json --noEmit' }) {
  if (!exists(path.join(repoPath, 'package.json'))) {
    return { ok: false, reason: 'no package.json' };
  }
  return addPackageScripts(repoPath, scripts);
}

/**
 * Ensure a CI step exists. We do not edit existing workflow files (that's a
 * destructive operation); instead, when no workflow runs lint/typecheck, we
 * write `.github/workflows/dev-genie-guardrails.yml`. If a workflow already
 * runs them, no-op. Returns `{ created: boolean, path?: string, reason?: string }`.
 */
function ensureCiStep(repoPath, ciDetection) {
  if (!ciDetection || !ciDetection.found) {
    // No workflows present at all → create one.
    return writeNewWorkflow(repoPath);
  }
  if (ciDetection.anyRunsLint && ciDetection.anyRunsTypecheck) {
    return { created: false, reason: 'existing workflow already runs lint + typecheck' };
  }
  // Some workflows but missing coverage → add a separate guardrails workflow.
  return writeNewWorkflow(repoPath);
}

function writeNewWorkflow(repoPath, opts = {}) {
  try {
    const res = addGithubActionsWorkflow(repoPath, {
      name: 'dev-genie-guardrails',
      commands: opts.commands || ['npm run lint', 'npm run typecheck'],
      packageManager: opts.packageManager || 'npm',
    });
    return { created: true, path: res.path };
  } catch (e) {
    if (e.code === 'EEXIST') return { created: false, reason: 'workflow already exists' };
    return { created: false, reason: e.message };
  }
}

module.exports = {
  ensurePreCommit,
  ensurePackageScripts,
  ensureCiStep,
  chooseFramework,
};
