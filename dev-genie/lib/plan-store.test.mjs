// node --test dev-genie/lib/plan-store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadLastRun, saveLastRun, ensureGitignore, repoFingerprint, diffPlan } = require('./plan-store.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-plan-'));
}

test('first run: load returns null', async () => {
  const dir = await mkTmp();
  assert.equal(loadLastRun(dir), null);
});

test('save then load round-trips', async () => {
  const dir = await mkTmp();
  saveLastRun(dir, { plan: [{ id: 'r1' }], applied: [], skipped: [], errors: [] });
  const r = loadLastRun(dir);
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.plan.length, 1);
  assert.equal(r.plan[0].id, 'r1');
  assert.ok(r.repoFingerprint);
});

test('ensureGitignore: adds entry; idempotent', async () => {
  const dir = await mkTmp();
  assert.equal(ensureGitignore(dir), true);
  const c = await fs.readFile(path.join(dir, '.gitignore'), 'utf8');
  assert.ok(c.includes('.dev-genie/'));
  assert.equal(ensureGitignore(dir), false);
});

test('repoFingerprint changes when tracked file changes', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), '{}');
  const f1 = repoFingerprint(dir);
  await fs.writeFile(path.join(dir, 'package.json'), '{"name":"x"}');
  const f2 = repoFingerprint(dir);
  assert.notEqual(f1, f2);
});

test('diffPlan: identifies new findings vs prior', () => {
  const last = { plan: [{ id: 'a' }, { id: 'b' }] };
  const cur = [{ id: 'a' }, { id: 'c' }];
  const { newFindings, unchanged } = diffPlan(cur, last);
  assert.deepEqual(newFindings.map((f) => f.id), ['c']);
  assert.deepEqual(unchanged.map((f) => f.id), ['a']);
});

test('diffPlan: with no prior, all are new', () => {
  const cur = [{ id: 'a' }];
  const { newFindings } = diffPlan(cur, null);
  assert.equal(newFindings.length, 1);
});
