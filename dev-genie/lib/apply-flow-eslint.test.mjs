// node --test dev-genie/lib/apply-flow-eslint.test.mjs
//
// Regression coverage for DGEN-T-0040: applying eslint findings must not
// produce a second `export default` in the user's flat config, and re-applying
// must be idempotent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeEslintManagedBlock } = require('./apply-flow.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-applyflow-'));
}

function countExportDefault(src) {
  // Count both `export default ...` and `export { default } from ...` (proxy form).
  const direct = (src.match(/^\s*export\s+default\b/gm) || []).length;
  const reexport = (src.match(/^\s*export\s*\{\s*default\b/gm) || []).length;
  return direct + reexport;
}

test('fresh apply produces a module with exactly one export default', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'eslint.config.mjs'),
    'export default [{ rules: {} }];\n',
  );

  const res = await writeEslintManagedBlock(dir, [['no-console', 'error']]);
  assert.equal(res.ok, true);

  const entry = await fs.readFile(path.join(dir, 'eslint.config.mjs'), 'utf8');
  assert.equal(countExportDefault(entry), 1, 'entry must have exactly one export default');

  // node --check passes on both files
  execFileSync(process.execPath, ['--check', path.join(dir, 'eslint.config.mjs')]);
  execFileSync(process.execPath, ['--check', path.join(dir, 'eslint.config.guardrails.mjs')]);

  const layered = await fs.readFile(path.join(dir, 'eslint.config.guardrails.mjs'), 'utf8');
  assert.ok(layered.includes('"no-console"'));
});

test('re-apply is idempotent (no duplicate export default, no diff)', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'eslint.config.mjs'), 'export default [{}];\n');

  await writeEslintManagedBlock(dir, [['no-var', 'error']]);
  const entry1 = await fs.readFile(path.join(dir, 'eslint.config.mjs'), 'utf8');
  const layered1 = await fs.readFile(path.join(dir, 'eslint.config.guardrails.mjs'), 'utf8');

  await writeEslintManagedBlock(dir, [['no-var', 'error']]);
  const entry2 = await fs.readFile(path.join(dir, 'eslint.config.mjs'), 'utf8');
  const layered2 = await fs.readFile(path.join(dir, 'eslint.config.guardrails.mjs'), 'utf8');

  assert.equal(entry1, entry2);
  assert.equal(layered1, layered2);
  assert.equal(countExportDefault(entry2), 1);
});

test('legacy appended managed block is stripped on first apply', async () => {
  const dir = await mkTmp();
  // Simulate a config corrupted by the old buggy writer: real export + appended
  // managed block with its own `export default`.
  const corrupted =
    'export default [{ rules: {} }];\n' +
    '\n' +
    '// >>> dev-genie managed >>>\n' +
    '// Managed by dev-genie. Do not edit between markers; re-run init to update.\n' +
    'export default [\n  {\n    rules: {\n      "no-console": "error",\n    },\n  },\n];\n' +
    '// <<< dev-genie managed <<<\n';
  await fs.writeFile(path.join(dir, 'eslint.config.mjs'), corrupted);
  assert.equal(countExportDefault(corrupted), 2);

  const res = await writeEslintManagedBlock(dir, [['no-console', 'error']]);
  assert.equal(res.ok, true);

  const entry = await fs.readFile(path.join(dir, 'eslint.config.mjs'), 'utf8');
  assert.equal(countExportDefault(entry), 1, 'corrupted second export default must be removed');
  assert.ok(!entry.includes('dev-genie managed'), 'sentinels must be gone');
  execFileSync(process.execPath, ['--check', path.join(dir, 'eslint.config.mjs')]);

  // Original is preserved as backup.
  assert.ok(existsSync(path.join(dir, 'eslint.config.mjs.dev-genie.bak')));
});

test('no eslint config: returns ok:false with message', async () => {
  const dir = await mkTmp();
  const res = await writeEslintManagedBlock(dir, [['no-var', 'error']]);
  assert.equal(res.ok, false);
  assert.match(res.message, /no eslint\.config/);
});
