// node --test dev-genie/lib/eslint-layered-writer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeLayeredEslintConfig } = require('./eslint-layered-writer.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-layered-'));
}

test('flat .mjs config: writes layered file referencing user config', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'eslint.config.mjs'), 'export default [{}];\n');
  const r = writeLayeredEslintConfig(dir, { 'no-console': 'error' });
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'flat');
  const out = await fs.readFile(path.join(dir, 'eslint.config.guardrails.mjs'), 'utf8');
  assert.ok(out.includes('./eslint.config.mjs'));
  assert.ok(out.includes('"no-console"'));
});

test('flat .ts config: imports the .ts entry', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'eslint.config.ts'), 'export default [];\n');
  const r = writeLayeredEslintConfig(dir, {});
  assert.equal(r.mode, 'flat');
  const out = await fs.readFile(path.join(dir, 'eslint.config.guardrails.mjs'), 'utf8');
  assert.ok(out.includes('./eslint.config.ts'));
});

test('legacy .eslintrc.json: returns fallback-legacy', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, '.eslintrc.json'), '{}');
  const r = writeLayeredEslintConfig(dir, { 'no-console': 'error' });
  assert.equal(r.ok, false);
  assert.equal(r.mode, 'fallback-legacy');
});

test('no eslint config: returns no-config', async () => {
  const dir = await mkTmp();
  const r = writeLayeredEslintConfig(dir, {});
  assert.equal(r.mode, 'no-config');
});

test('rewriteEntryPoint: backs up + writes proxy', async () => {
  const dir = await mkTmp();
  const orig = 'export default [{ rules: {} }];\n';
  await fs.writeFile(path.join(dir, 'eslint.config.mjs'), orig);
  const r = writeLayeredEslintConfig(dir, { 'no-var': 'error' }, { rewriteEntryPoint: true });
  assert.equal(r.rewroteEntryPoint, true);
  assert.ok(existsSync(path.join(dir, 'eslint.config.mjs.dev-genie.bak')));
  const newContents = await fs.readFile(path.join(dir, 'eslint.config.mjs'), 'utf8');
  assert.ok(newContents.includes('eslint.config.guardrails.mjs'));
  const backup = await fs.readFile(path.join(dir, 'eslint.config.mjs.dev-genie.bak'), 'utf8');
  assert.equal(backup, orig);
});
