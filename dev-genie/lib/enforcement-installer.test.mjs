// node --test dev-genie/lib/enforcement-installer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ensurePackageScripts, ensureCiStep, chooseFramework } = require('./enforcement-installer.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-enforce-'));
}

test('chooseFramework: detects husky', async () => {
  const dir = await mkTmp();
  await fs.mkdir(path.join(dir, '.husky'));
  assert.equal(chooseFramework(dir), 'husky');
});

test('chooseFramework: detects lefthook', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'lefthook.yml'), '');
  assert.equal(chooseFramework(dir), 'lefthook');
});

test('chooseFramework: detects pre-commit framework', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, '.pre-commit-config.yaml'), '');
  assert.equal(chooseFramework(dir), 'pre-commit');
});

test('chooseFramework: defaults to husky when package.json present', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), '{}');
  assert.equal(chooseFramework(dir), 'husky');
});

test('chooseFramework: pre-commit-raw when no package.json', async () => {
  const dir = await mkTmp();
  assert.equal(chooseFramework(dir), 'pre-commit-raw');
});

test('ensurePackageScripts: adds missing scripts', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), '{}');
  const r = ensurePackageScripts(dir);
  assert.ok(r.added.includes('lint'));
  assert.ok(r.added.includes('typecheck'));
});

test('ensurePackageScripts: skips existing scripts', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ scripts: { lint: 'eslint src' } }));
  const r = ensurePackageScripts(dir);
  assert.ok(r.skipped.includes('lint'));
  assert.ok(r.added.includes('typecheck'));
});

test('ensureCiStep: no detection → creates workflow', async () => {
  const dir = await mkTmp();
  const r = ensureCiStep(dir, { found: false });
  assert.equal(r.created, true);
  assert.ok(existsSync(path.join(dir, '.github/workflows/dev-genie-guardrails.yml')));
});

test('ensureCiStep: existing workflow runs both → no-op', async () => {
  const dir = await mkTmp();
  const r = ensureCiStep(dir, { found: true, anyRunsLint: true, anyRunsTypecheck: true });
  assert.equal(r.created, false);
});
