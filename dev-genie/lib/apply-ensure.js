'use strict';

/**
 * apply-ensure
 *
 * Applies an `ensure`-kind finding (enforcement intent for pre-commit / build /
 * ci / audit). Extracted out of apply-flow.js to keep that module focused on
 * dispatch + interactive UI.
 *
 * Public API:
 *   applyEnsure(repoPath, finding) -> Promise<{ ok, message }>
 */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const {
  addGithubActionsWorkflow,
} = require('./write-helpers.js');
const { installAudit } = require('./audit-reconcile.js');

function detectIndent(raw) {
  if (!raw) return '  ';
  const m = raw.match(/^\{\s*\n([ \t]+)/);
  if (m) return m[1];
  return '  ';
}

function summarizeBeforeAfter(label, before, after) {
  return (
    `  ${label}\n` +
    `    before: ${before === undefined ? '<unset>' : JSON.stringify(before)}\n` +
    `    after:  ${after === undefined ? '<unset>' : JSON.stringify(after)}`
  );
}

async function applyEnsure(repoPath, finding) {
  const v = (finding.diff && finding.diff.value) || {};
  const stage = v.stage;
  const runs = Array.isArray(v.runs) ? v.runs : [];
  const mechanism = v.mechanism;

  // Audit-related ensure: route through installAudit when key indicates audit
  // or runs include 'audit'.
  if (stage === 'audit' || runs.includes('audit')) {
    try {
      const res = await installAudit(repoPath, {
        components: ['configDir', 'scripts', 'hook'],
      });
      return {
        ok: res.errors.length === 0,
        message:
          `audit install: changed=[${res.changed.join(', ')}] skipped=[${res.skipped.join(', ')}]` +
          (res.errors.length ? ` errors=${JSON.stringify(res.errors)}` : ''),
      };
    } catch (e) {
      return { ok: false, message: `installAudit failed: ${e.message}` };
    }
  }

  if (stage === 'pre-commit') {
    try {
      const mod = await import('../scripts/lib/pre-commit.mjs');
      const system =
        (mechanism && typeof mechanism === 'string' && mechanism) || 'pre-commit-raw';
      const commands = runs.map((r) => `npm run ${r}`);
      const res = await mod.installPreCommitHooks(repoPath, { system, commands });
      return {
        ok: true,
        message: `pre-commit install (${res.system}): ${res.changed ? 'changed' : 'no change'}\n${res.summary || ''}`,
      };
    } catch (e) {
      return { ok: false, message: `installPreCommitHooks failed: ${e.message}` };
    }
  }

  if (stage === 'build') {
    // Ensure each `runs` script exists; chain into `build` if present.
    try {
      const pjPath = path.join(repoPath, 'package.json');
      if (!fs.existsSync(pjPath)) {
        return { ok: false, message: `package.json not found at ${pjPath}` };
      }
      const raw = await fsp.readFile(pjPath, 'utf8');
      const pkg = JSON.parse(raw);
      pkg.scripts = pkg.scripts || {};
      const before = pkg.scripts.build;
      const prefix = runs.map((r) => `npm run ${r}`).join(' && ');
      let nextBuild;
      if (!before) {
        nextBuild = prefix;
      } else if (before.includes(prefix)) {
        nextBuild = before;
      } else {
        nextBuild = `${prefix} && ${before}`;
      }
      pkg.scripts.build = nextBuild;
      const indent = detectIndent(raw);
      const trailing = raw.endsWith('\n') ? '\n' : '';
      await fsp.writeFile(pjPath, JSON.stringify(pkg, null, indent) + trailing, 'utf8');
      return {
        ok: true,
        message:
          `build chain updated:\n` +
          summarizeBeforeAfter('scripts.build', before, nextBuild),
      };
    } catch (e) {
      return { ok: false, message: `build chain update failed: ${e.message}` };
    }
  }

  if (stage === 'ci') {
    try {
      const commands = runs.map((r) => `npm run ${r}`);
      const res = addGithubActionsWorkflow(repoPath, {
        name: 'guard-rails',
        commands,
      });
      return { ok: true, message: `wrote GitHub Actions workflow at ${res.path}` };
    } catch (e) {
      if (e.code === 'EEXIST') {
        return {
          ok: false,
          message: `${e.message} (skipping, will not overwrite without confirmation).`,
        };
      }
      return { ok: false, message: `addGithubActionsWorkflow failed: ${e.message}` };
    }
  }

  return { ok: false, message: `unknown enforcement stage: ${stage}` };
}

module.exports = { applyEnsure };
