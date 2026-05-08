// node --test dev-genie/lib/apply-flow-jsonc.test.mjs
//
// Regression coverage for DGEN-T-0041: parseJsonc must not eat `/**/` out of
// strings like `"src/**/*"`, and applying a json-patch to compilerOptions must
// preserve unrelated keys (especially include globs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseJsonc, stripJsonc, applyFinding } = require('./apply-flow.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-jsonc-'));
}

test('parseJsonc preserves /**/ inside string globs', () => {
  const raw = '{ "include": ["src/**/*", "app/**/*"] }';
  const parsed = parseJsonc(raw);
  assert.deepEqual(parsed.include, ['src/**/*', 'app/**/*']);
});

test('parseJsonc strips line comments', () => {
  const raw = '{\n  // top comment\n  "a": 1 // trailing\n}';
  const parsed = parseJsonc(raw);
  assert.deepEqual(parsed, { a: 1 });
});

test('parseJsonc strips block comments but not when inside strings', () => {
  const raw = '{\n  /* leading */\n  "msg": "/* not a comment */",\n  "x": 2\n}';
  const parsed = parseJsonc(raw);
  assert.equal(parsed.msg, '/* not a comment */');
  assert.equal(parsed.x, 2);
});

test('parseJsonc handles trailing commas (JSONC)', () => {
  const raw = '{ "a": [1, 2,], "b": { "c": 3, }, }';
  assert.deepEqual(parseJsonc(raw), { a: [1, 2], b: { c: 3 } });
});

test('parseJsonc handles escaped quotes and backslashes in strings', () => {
  const raw = '{ "p": "C:\\\\path\\\\with\\\\stars/**/*", "q": "say \\"/* hi */\\"" }';
  const parsed = parseJsonc(raw);
  assert.equal(parsed.p, 'C:\\path\\with\\stars/**/*');
  assert.equal(parsed.q, 'say "/* hi */"');
});

test('stripJsonc on a glob string is a no-op', () => {
  const s = '"src/**/*"';
  assert.equal(stripJsonc(s), s);
});

test('applyFinding json-patch tsconfig preserves include globs', async () => {
  const dir = await mkTmp();
  const original = JSON.stringify(
    { compilerOptions: { strict: false }, include: ['src/**/*', 'app/**/*'] },
    null,
    2,
  ) + '\n';
  await fs.writeFile(path.join(dir, 'tsconfig.json'), original);

  const finding = {
    id: 'fix-strict',
    key: 'compilerOptions.strict',
    category: 'tsconfig',
    diff: {
      kind: 'json-patch',
      target: 'tsconfig.json',
      value: [{ op: 'replace', path: '/compilerOptions/strict', value: true }],
    },
  };
  const res = await applyFinding(dir, finding);
  assert.equal(res.ok, true);

  const after = JSON.parse(await fs.readFile(path.join(dir, 'tsconfig.json'), 'utf8'));
  assert.equal(after.compilerOptions.strict, true);
  assert.deepEqual(after.include, ['src/**/*', 'app/**/*'], 'include globs must survive');
});

test('applyFinding json-patch tsconfig idempotent re-apply', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src/**/*'] }, null, 2) + '\n',
  );
  const finding = {
    id: 'x',
    key: 'compilerOptions.strict',
    category: 'tsconfig',
    diff: {
      kind: 'json-patch',
      target: 'tsconfig.json',
      value: [{ op: 'replace', path: '/compilerOptions/strict', value: true }],
    },
  };
  await applyFinding(dir, finding);
  const a = await fs.readFile(path.join(dir, 'tsconfig.json'), 'utf8');
  await applyFinding(dir, finding);
  const b = await fs.readFile(path.join(dir, 'tsconfig.json'), 'utf8');
  assert.equal(a, b);
});

test('applyFinding json-patch tsconfig with JSONC comments succeeds', async () => {
  const dir = await mkTmp();
  const jsonc =
    '{\n' +
    '  // dev tsconfig\n' +
    '  "compilerOptions": { "strict": false /* todo */ },\n' +
    '  "include": ["src/**/*"]\n' +
    '}\n';
  await fs.writeFile(path.join(dir, 'tsconfig.json'), jsonc);
  const finding = {
    id: 'x',
    key: 'compilerOptions.strict',
    category: 'tsconfig',
    diff: {
      kind: 'json-patch',
      target: 'tsconfig.json',
      value: [{ op: 'replace', path: '/compilerOptions/strict', value: true }],
    },
  };
  const res = await applyFinding(dir, finding);
  assert.equal(res.ok, true);
  const parsed = JSON.parse(await fs.readFile(path.join(dir, 'tsconfig.json'), 'utf8'));
  assert.deepEqual(parsed.include, ['src/**/*']);
  assert.equal(parsed.compilerOptions.strict, true);
});
