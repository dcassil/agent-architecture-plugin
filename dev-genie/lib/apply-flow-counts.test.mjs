// node --test dev-genie/lib/apply-flow-counts.test.mjs
//
// Regression coverage for DGEN-T-0043: invariants on the post-apply summary
// counts. The headline `applied + skipped + errors` MUST equal the count of
// actionable (non-`present`) findings rendered in the report — and the
// per-severity / per-category breakdowns from `report.toJSON` must match the
// underlying findings list.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { applyFindings } = require('./apply-flow.js');
const { toJSON, formatReport } = require('./report.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-counts-'));
}

async function setupRepo() {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'x', scripts: {} }, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: false }, include: ['src/**/*'] }, null, 2) + '\n',
  );
  await fs.writeFile(path.join(dir, 'eslint.config.mjs'), 'export default [{}];\n');
  return dir;
}

function mkFinding(over) {
  return {
    id: over.id,
    category: over.category,
    key: over.key,
    severity: over.severity || 'critical',
    status: over.status || 'missing',
    actual: over.actual,
    expected: over.expected,
    message: '',
    diff: over.diff,
  };
}

function syntheticFindings() {
  return [
    mkFinding({
      id: 'eslint-1',
      category: 'eslint',
      key: 'no-console',
      severity: 'critical',
      expected: 'error',
      diff: { kind: 'string', target: 'eslint.config.mjs', value: '+ no-console: error' },
    }),
    mkFinding({
      id: 'ts-1',
      category: 'tsconfig',
      key: 'strict',
      severity: 'critical',
      expected: true,
      diff: {
        kind: 'json-patch',
        target: 'tsconfig.json',
        value: [{ op: 'replace', path: '/compilerOptions/strict', value: true }],
      },
    }),
    mkFinding({
      id: 'rec-1',
      category: 'tsconfig',
      key: 'noUncheckedIndexedAccess',
      severity: 'recommended',
      expected: true,
      diff: {
        kind: 'json-patch',
        target: 'tsconfig.json',
        value: [{ op: 'add', path: '/compilerOptions/noUncheckedIndexedAccess', value: true }],
      },
    }),
    mkFinding({
      id: 'opt-1',
      category: 'scripts',
      key: 'verify',
      severity: 'optional',
      expected: 'npm run lint && npm run typecheck',
      diff: {
        kind: 'json-patch',
        target: 'package.json',
        value: [{ op: 'add', path: '/scripts/verify', value: 'npm run lint && npm run typecheck' }],
      },
    }),
    // status:'present' must be ignored by both apply and (effectively) the report
    // as a "gap" — included here to verify it doesn't leak into counts.
    mkFinding({
      id: 'present-1',
      category: 'tsconfig',
      key: 'target',
      severity: 'recommended',
      status: 'present',
      expected: 'ES2022',
      diff: null,
    }),
  ];
}

test('apply-all: applied + skipped + errors === actionable count', async () => {
  const dir = await setupRepo();
  const findings = syntheticFindings();
  const actionable = findings.filter((f) => f.status !== 'present' && f.diff);

  const r = await applyFindings({ repoPath: dir, archId: 'test', findings, mode: 'apply-all' });
  const total = r.applied.length + r.skipped.length + r.errors.length;
  assert.equal(
    total,
    actionable.length,
    `summary total ${total} != actionable ${actionable.length} (applied=${r.applied.length} skipped=${r.skipped.length} errors=${r.errors.length})`,
  );
});

test('auto-critical: applied + skipped + errors === actionable, criticals applied, others skipped', async () => {
  const dir = await setupRepo();
  const findings = syntheticFindings();
  const actionable = findings.filter((f) => f.status !== 'present' && f.diff);
  const critical = actionable.filter((f) => f.severity === 'critical').map((f) => f.id);
  const nonCritical = actionable.filter((f) => f.severity !== 'critical').map((f) => f.id);

  const r = await applyFindings({ repoPath: dir, archId: 'test', findings, mode: 'auto-critical' });
  const total = r.applied.length + r.skipped.length + r.errors.length;
  assert.equal(total, actionable.length);

  // every non-critical landed in skipped
  for (const id of nonCritical) assert.ok(r.skipped.includes(id), `${id} should be skipped`);
  // critical findings either applied or errored; none silently dropped
  for (const id of critical) {
    assert.ok(r.applied.includes(id) || r.errors.some((e) => e.id === id), `${id} unaccounted for`);
  }
});

test('dry-run: skipped === actionable, applied === errors === 0', async () => {
  const dir = await setupRepo();
  const findings = syntheticFindings();
  const actionable = findings.filter((f) => f.status !== 'present' && f.diff);
  const r = await applyFindings({ repoPath: dir, archId: 'test', findings, mode: 'dry-run' });
  assert.equal(r.applied.length, 0);
  assert.equal(r.errors.length, 0);
  assert.equal(r.skipped.length, actionable.length);
});

test('report.toJSON severity counts equal sum of category counts', () => {
  const findings = syntheticFindings();
  const json = toJSON(findings);
  for (const grp of json.groups) {
    const catSum = grp.categories.reduce((acc, c) => acc + c.count, 0);
    assert.equal(grp.count, catSum, `severity ${grp.severity}: ${grp.count} != Σcategories ${catSum}`);
  }
  // Top-level summary.bySeverity should match the per-group counts.
  const sumGroups = json.groups.reduce((acc, g) => acc + g.count, 0);
  // toJSON groups exclude empty severities; total findings includes 'present'
  // entries that may still have a severity, so sum of groups equals total.
  assert.equal(sumGroups, findings.length);
});

test('formatReport summary total equals sum of per-severity rendered counts', () => {
  const findings = syntheticFindings();
  const out = formatReport(findings, { color: false });

  // Pull the headline gap count.
  const headline = out.match(/Summary:\s+(\d+)\s+gap/);
  assert.ok(headline, 'summary line should be present');
  const headlineTotal = Number(headline[1]);

  // Sum the per-severity "(N)" counts shown next to each header.
  const sevCounts = [...out.matchAll(/^(?:CRITICAL|RECOMMENDED|OPTIONAL)\s+\((\d+)\)/gm)]
    .map((m) => Number(m[1]));
  const sevSum = sevCounts.reduce((a, b) => a + b, 0);

  assert.equal(
    headlineTotal,
    sevSum,
    `headline (${headlineTotal}) must match Σ per-severity rendered counts (${sevSum})`,
  );
  // Also: rendered count must equal actionable findings count.
  const actionable = findings.filter((f) => f.status !== 'present');
  assert.equal(headlineTotal, actionable.length);
});

test('all findings already present: zero actionable, zero applied/skipped/errors', async () => {
  const dir = await setupRepo();
  const findings = [
    mkFinding({
      id: 'p-1',
      category: 'tsconfig',
      key: 'strict',
      severity: 'critical',
      status: 'present',
      expected: true,
    }),
  ];
  const r = await applyFindings({ repoPath: dir, archId: 'test', findings, mode: 'apply-all' });
  assert.equal(r.applied.length, 0);
  assert.equal(r.skipped.length, 0);
  assert.equal(r.errors.length, 0);
});
