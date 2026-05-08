'use strict';

/**
 * compare-config
 *
 * Diff a target repo's detected/effective configuration against the
 * recommended dev-genie baseline for a given architecture, plus the universal
 * (cross-arch) enforcement baseline. Produces a flat list of structured
 * Findings the init flow can group, prompt on, and apply.
 *
 * Public API:
 *   compareConfig({
 *     archId,            // string, required (e.g. 'node-api')
 *     repoPath,          // string, required (absolute repo path)
 *     detected?,         // optional pre-computed detect-config.js report
 *     resolvedEslint?,   // optional pre-computed eslint-effective-config result
 *     resolvedTsconfig?, // optional pre-computed tsconfig-effective-config result
 *     baseline?,         // optional pre-loaded arch baseline JSON
 *     universal?,        // optional pre-loaded universal baseline JSON
 *     buildCI?,          // optional pre-computed detect-build-ci.js report
 *   }) -> Promise<{ findings: Finding[] }>
 *
 * Finding shape:
 *   {
 *     id:        string,           // stable id e.g. 'eslint:no-explicit-any'
 *     category:  'eslint' | 'tsconfig' | 'scripts' | 'enforcement',
 *     key:       string,           // rule/option/script/stage name
 *     status:    'missing' | 'weaker' | 'conflicting' | 'present',
 *     severity:  'critical' | 'recommended' | 'optional',
 *     expected:  unknown,
 *     actual:    unknown,
 *     message:   string,           // short human-readable summary
 *   }
 *
 * Severity policy (defaults):
 *   - critical: `@typescript-eslint/no-explicit-any`, tsconfig `strict`,
 *     lint-on-pre-commit enforcement.
 *   - optional: stylistic/formatting rules (object-shorthand, prefer-template,
 *     consistent-type-definitions).
 *   - recommended: everything else.
 *
 * This module is read-only — it never mutates the target repo.
 */

const path = require('node:path');
const { detectConfig } = require('../skills/project-detection/detect-config.js');
const { resolveEslintConfig } = require('./eslint-effective-config.js');
const { resolveTsconfig } = require('./tsconfig-effective-config.js');
const { detectBuildCI } = require('../skills/project-detection/detect-build-ci.js');

// --- baseline loader (baselines/index.mjs is ESM; bridge via dynamic import) ---
async function loadBaselines(archId, baseline, universal) {
  if (baseline && universal) return { baseline, universal };
  const mod = await import('../baselines/index.mjs');
  return {
    baseline: baseline || mod.loadBaseline(archId),
    universal: universal || mod.loadUniversal(),
  };
}

// --- severity classification ---------------------------------------------
const CRITICAL_ESLINT_RULES = new Set([
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
]);
const OPTIONAL_ESLINT_RULES = new Set([
  'object-shorthand',
  'prefer-template',
  '@typescript-eslint/consistent-type-definitions',
  '@typescript-eslint/consistent-type-imports',
  'max-depth',
  'max-params',
  'complexity',
]);

function eslintRuleSeverity(ruleName) {
  if (CRITICAL_ESLINT_RULES.has(ruleName)) return 'critical';
  if (OPTIONAL_ESLINT_RULES.has(ruleName)) return 'optional';
  return 'recommended';
}

const CRITICAL_TS_OPTIONS = new Set(['strict']);
function tsOptionSeverity(key) {
  if (CRITICAL_TS_OPTIONS.has(key)) return 'critical';
  return 'recommended';
}

// --- eslint severity normalization ---------------------------------------
// Normalize eslint severity (number or string, with optional options) to a
// numeric level: 0=off, 1=warn, 2=error.
function normalizeEslintEntry(entry) {
  if (entry == null) return { level: undefined, options: undefined, present: false };
  const arr = Array.isArray(entry) ? entry : [entry];
  const head = arr[0];
  const options = arr.length > 1 ? arr.slice(1) : undefined;
  let level;
  if (typeof head === 'number') level = head;
  else if (head === 'error') level = 2;
  else if (head === 'warn') level = 1;
  else if (head === 'off') level = 0;
  else level = undefined;
  return { level, options, present: true };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

// Pick the most representative resolved config (prefer .ts, then .tsx, .js).
function pickRepresentativeConfig(resolvedEslint) {
  if (!resolvedEslint || !resolvedEslint.configs) return null;
  const entries = Object.entries(resolvedEslint.configs);
  if (entries.length === 0) return null;
  const order = ['.ts', '.tsx', '.js'];
  for (const ext of order) {
    const hit = entries.find(([f]) => f.endsWith(ext));
    if (hit) return hit[1];
  }
  return entries[0][1];
}

// --- comparators ----------------------------------------------------------

function compareEslint(baseline, resolvedEslint) {
  const findings = [];
  const baseRules = (baseline.eslint && baseline.eslint.base && baseline.eslint.base.rules) || {};
  const unresolvedSpreads =
    (baseline.eslint && baseline.eslint.base && baseline.eslint.base.unresolvedSpreads) || [];
  const unresolvedSet = new Set(unresolvedSpreads);

  const repConfig = pickRepresentativeConfig(resolvedEslint);
  const userRules = (repConfig && repConfig.rules) || {};

  for (const [ruleName, baselineEntry] of Object.entries(baseRules)) {
    // Skip baseline rules that came from an unresolved spread, unless the user
    // actually has the rule resolved.
    if (unresolvedSet.has(ruleName) && !(ruleName in userRules)) continue;

    const baseN = normalizeEslintEntry(baselineEntry);
    const userN = normalizeEslintEntry(userRules[ruleName]);
    const severity = eslintRuleSeverity(ruleName);

    if (!userN.present || userN.level === undefined) {
      findings.push({
        id: `eslint:${ruleName}`,
        category: 'eslint',
        key: ruleName,
        status: 'missing',
        severity,
        expected: baselineEntry,
        actual: undefined,
        message: `eslint rule "${ruleName}" is not configured (baseline: ${describeLevel(baseN.level)}).`,
      });
      continue;
    }

    if (userN.level < baseN.level) {
      findings.push({
        id: `eslint:${ruleName}`,
        category: 'eslint',
        key: ruleName,
        status: 'weaker',
        severity,
        expected: baselineEntry,
        actual: userRules[ruleName],
        message: `eslint rule "${ruleName}" is ${describeLevel(userN.level)}; baseline expects ${describeLevel(baseN.level)}.`,
      });
      continue;
    }

    // Same or stricter level. Check options for conflict.
    if (baseN.options && !deepEqual(userN.options, baseN.options)) {
      findings.push({
        id: `eslint:${ruleName}`,
        category: 'eslint',
        key: ruleName,
        status: 'conflicting',
        severity,
        expected: baselineEntry,
        actual: userRules[ruleName],
        message: `eslint rule "${ruleName}" has different options than baseline.`,
      });
      continue;
    }

    findings.push({
      id: `eslint:${ruleName}`,
      category: 'eslint',
      key: ruleName,
      status: 'present',
      severity,
      expected: baselineEntry,
      actual: userRules[ruleName],
      message: `eslint rule "${ruleName}" matches baseline.`,
    });
  }
  return findings;
}

function describeLevel(level) {
  if (level === 2) return 'error';
  if (level === 1) return 'warn';
  if (level === 0) return 'off';
  return 'unset';
}

function compareTsconfig(baseline, repoPath, resolvedTsconfig) {
  const findings = [];
  const expected =
    (baseline.tsconfig && baseline.tsconfig.compilerOptions) || {};
  const resolved = resolvedTsconfig || resolveTsconfig(repoPath);
  const userOpts = resolved.compilerOptions || {};

  for (const [key, baselineVal] of Object.entries(expected)) {
    const has = Object.prototype.hasOwnProperty.call(userOpts, key);
    const userVal = userOpts[key];
    const severity = tsOptionSeverity(key);

    if (!has) {
      findings.push({
        id: `tsconfig:${key}`,
        category: 'tsconfig',
        key,
        status: 'missing',
        severity,
        expected: baselineVal,
        actual: undefined,
        message: `tsconfig.compilerOptions.${key} is not set (baseline: ${JSON.stringify(baselineVal)}).`,
      });
      continue;
    }

    // Boolean strict-ish flags: weaker if baseline=true and user=false.
    if (typeof baselineVal === 'boolean') {
      if (baselineVal === true && userVal !== true) {
        findings.push({
          id: `tsconfig:${key}`,
          category: 'tsconfig',
          key,
          status: 'weaker',
          severity,
          expected: baselineVal,
          actual: userVal,
          message: `tsconfig.compilerOptions.${key} should be true; got ${JSON.stringify(userVal)}.`,
        });
        continue;
      }
    }

    if (!deepEqual(userVal, baselineVal)) {
      findings.push({
        id: `tsconfig:${key}`,
        category: 'tsconfig',
        key,
        status: 'conflicting',
        severity,
        expected: baselineVal,
        actual: userVal,
        message: `tsconfig.compilerOptions.${key} differs from baseline.`,
      });
      continue;
    }

    findings.push({
      id: `tsconfig:${key}`,
      category: 'tsconfig',
      key,
      status: 'present',
      severity,
      expected: baselineVal,
      actual: userVal,
      message: `tsconfig.compilerOptions.${key} matches baseline.`,
    });
  }
  return findings;
}

function compareScripts(baseline, universal, detected) {
  const findings = [];
  const expected = {
    ...(universal.requiredScripts || {}),
    ...(baseline.requiredScripts || {}), // arch overrides universal
  };

  // detected.scripts.files looks like ['package.json#scripts.lint', ...]
  // We need actual script names — re-read from detected via detectConfig output.
  const present = new Set();
  if (detected && detected.scripts && Array.isArray(detected.scripts.files)) {
    for (const f of detected.scripts.files) {
      const m = /^package\.json#scripts\.(.+)$/.exec(f);
      if (m) present.add(m[1]);
    }
  }
  // detectConfig only normalizes a handful (lint, typecheck, etc.). To capture
  // arbitrary required-script names like "verify"/"prebuild", also read
  // package.json directly.
  try {
    const fs = require('node:fs');
    const pkg = JSON.parse(
      fs.readFileSync(path.join(detected.repoPath, 'package.json'), 'utf8'),
    );
    if (pkg.scripts) for (const n of Object.keys(pkg.scripts)) present.add(n);
  } catch {
    /* no package.json — every required script is missing */
  }

  for (const [name, body] of Object.entries(expected)) {
    if (present.has(name)) {
      findings.push({
        id: `scripts:${name}`,
        category: 'scripts',
        key: name,
        status: 'present',
        severity: 'recommended',
        expected: body,
        actual: undefined, // we don't compare bodies (user freedom)
        message: `package.json script "${name}" present.`,
      });
    } else {
      findings.push({
        id: `scripts:${name}`,
        category: 'scripts',
        key: name,
        status: 'missing',
        severity: 'recommended',
        expected: body,
        actual: undefined,
        message: `package.json script "${name}" is missing (baseline: ${body}).`,
      });
    }
  }
  return findings;
}

function compareEnforcement(universal, detected, buildCI) {
  const findings = [];
  const points = Array.isArray(universal.enforcementPoints) ? universal.enforcementPoints : [];

  // Pre-commit: do detected hooks exist + plausibly run lint/typecheck?
  // We don't deep-parse hook scripts; treat presence of any hook system as
  // partial coverage and inspect package.json `lint-staged`/`simple-git-hooks`
  // entries when available via detected.hooks.
  const hookFiles = (detected && detected.hooks && detected.hooks.files) || [];
  // simple-git-hooks stores its config inside package.json under the
  // "simple-git-hooks" key rather than a hook file on disk, so plain file
  // detection misses it. Treat the presence of that key as a hook system.
  let hasSimpleGitHooks = false;
  try {
    const fs = require('node:fs');
    const repo = (detected && detected.repoPath) || '';
    if (repo) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(repo, 'package.json'), 'utf8'),
      );
      if (pkg && pkg['simple-git-hooks']) hasSimpleGitHooks = true;
    }
  } catch {
    /* no package.json or unparseable — leave false */
  }
  const hasAnyHookSystem = hookFiles.length > 0 || hasSimpleGitHooks;

  for (const point of points) {
    const stage = point.stage; // 'pre-commit' | 'build' | 'ci'
    const expectedRuns = Array.isArray(point.runs) ? point.runs : [];
    let status = 'missing';
    let actual;

    if (stage === 'pre-commit') {
      const systems = hookFiles.slice();
      if (hasSimpleGitHooks) systems.push('package.json#simple-git-hooks');
      actual = { hookSystems: systems };
      status = hasAnyHookSystem ? 'present' : 'missing';
    } else if (stage === 'build') {
      const chains =
        buildCI && buildCI.packageJson && buildCI.packageJson.buildChainsLintAndTypecheck;
      const hasBuild =
        buildCI && buildCI.packageJson && buildCI.packageJson.scripts.build;
      actual = {
        hasBuild: !!hasBuild,
        buildChainsLintAndTypecheck: !!chains,
      };
      if (!hasBuild) status = 'missing';
      else status = chains ? 'present' : 'weaker';
    } else if (stage === 'ci') {
      const ci = buildCI && buildCI.ci;
      const runsLint = !!(ci && ci.anyRunsLint);
      const runsType = !!(ci && ci.anyRunsTypecheck);
      actual = {
        ciFound: !!(ci && ci.found),
        anyRunsLint: runsLint,
        anyRunsTypecheck: runsType,
      };
      if (!ci || !ci.found) status = 'missing';
      else if (runsLint && runsType) status = 'present';
      else status = 'weaker';
    } else {
      continue;
    }

    const severity = stage === 'pre-commit' ? 'critical' : 'recommended';
    findings.push({
      id: `enforcement:${stage}`,
      category: 'enforcement',
      key: stage,
      status,
      severity,
      expected: { stage, runs: expectedRuns, mechanism: point.mechanism },
      actual,
      message:
        status === 'present'
          ? `${stage} enforcement is wired.`
          : status === 'weaker'
            ? `${stage} enforcement is partial: expected to run ${expectedRuns.join(', ')}.`
            : `${stage} enforcement is missing: expected ${expectedRuns.join(', ')}.`,
    });
  }
  return findings;
}

// --- Public API ----------------------------------------------------------

async function compareConfig(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('compareConfig requires an options object');
  }
  const { archId, repoPath } = opts;
  if (!archId) throw new Error('compareConfig: archId is required');
  if (!repoPath) throw new Error('compareConfig: repoPath is required');

  const detected = opts.detected || detectConfig(repoPath);
  const resolvedEslint = opts.resolvedEslint || resolveEslintConfig(repoPath);
  const resolvedTsconfig = opts.resolvedTsconfig || resolveTsconfig(repoPath);
  const buildCI = opts.buildCI || detectBuildCI(repoPath);
  const { baseline, universal } = await loadBaselines(archId, opts.baseline, opts.universal);

  const findings = [
    ...compareEslint(baseline, resolvedEslint),
    ...compareTsconfig(baseline, repoPath, resolvedTsconfig),
    ...compareScripts(baseline, universal, detected),
    ...compareEnforcement(universal, detected, buildCI),
  ];

  return { findings };
}

module.exports = { compareConfig };

// --- Smoke test ----------------------------------------------------------
// node dev-genie/lib/compare-config.js
if (require.main === module) {
  (async () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const archDir = path.join(repoRoot, 'guardrails/architectures/node-api');

    function summarize(findings) {
      const byStatus = {};
      const bySeverity = {};
      const byCategory = {};
      for (const f of findings) {
        byStatus[f.status] = (byStatus[f.status] || 0) + 1;
        bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      }
      return { total: findings.length, byStatus, bySeverity, byCategory };
    }

    function printRun(label, summary, sample) {
      process.stdout.write(`\n=== ${label} ===\n`);
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      const non = sample.filter((f) => f.status !== 'present').slice(0, 5);
      if (non.length) {
        process.stdout.write('first non-present findings:\n');
        for (const f of non) {
          process.stdout.write(`  [${f.severity}] ${f.status} ${f.category}:${f.key} — ${f.message}\n`);
        }
      }
    }

    try {
      const archRun = await compareConfig({ archId: 'node-api', repoPath: archDir });
      printRun(`baseline arch dir: ${path.relative(repoRoot, archDir)}`, summarize(archRun.findings), archRun.findings);
    } catch (err) {
      process.stdout.write(`arch run failed: ${err.message}\n`);
    }

    try {
      const repoRun = await compareConfig({ archId: 'node-api', repoPath: repoRoot });
      printRun(`repo root: ${repoRoot}`, summarize(repoRun.findings), repoRun.findings);
    } catch (err) {
      process.stdout.write(`repo run failed: ${err.message}\n`);
    }
  })().catch((err) => {
    process.stderr.write(String(err && err.stack || err) + '\n');
    process.exit(1);
  });
}
