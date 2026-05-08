// node --test guardrails/scripts/lint-edited-file.test.mjs
//
// Behavioral coverage for the edit-time lint hook (DGEN-T-0055).
// Exercises binary selection (eslint_d preferred, eslint fallback),
// extension filtering, exit-code propagation, and the no-eslint no-op path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  'lint-edited-file.sh',
);

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'edithook-'));
}

// Build a fake eslint binary that records its argv to a file and exits with
// `exitCode`. Uses a shell shim (the hook script invokes via path).
async function fakeEslint(dir, name, exitCode = 0) {
  const binDir = path.join(dir, 'node_modules', '.bin');
  await fs.mkdir(binDir, { recursive: true });
  const target = path.join(binDir, name);
  const log = path.join(dir, `${name}.log`);
  const script =
    `#!/usr/bin/env bash\n` +
    `echo "$@" >> ${JSON.stringify(log)}\n` +
    `exit ${exitCode}\n`;
  await fs.writeFile(target, script);
  await fs.chmod(target, 0o755);
  return log;
}

function runHook(cwd, fileEdited) {
  const input = JSON.stringify({ tool_input: { file_path: fileEdited } });
  return spawnSync('bash', [HOOK], { input, cwd, encoding: 'utf8' });
}

test('non-JS/TS extension: exits 0 and never spawns eslint', async () => {
  const dir = await mkTmp();
  const log = await fakeEslint(dir, 'eslint', 0);
  const r = runHook(dir, 'README.md');
  assert.equal(r.status, 0);
  assert.equal(await fs.readFile(log, 'utf8').catch(() => ''), '');
});

test('no eslint installed: exits 0 (no-op)', async () => {
  const dir = await mkTmp();
  const r = runHook(dir, 'src/foo.ts');
  assert.equal(r.status, 0);
});

test('prefers eslint_d when both binaries are present', async () => {
  const dir = await mkTmp();
  const dLog = await fakeEslint(dir, 'eslint_d', 0);
  const eLog = await fakeEslint(dir, 'eslint', 0);
  const r = runHook(dir, 'src/foo.ts');
  assert.equal(r.status, 0);
  const dCalls = (await fs.readFile(dLog, 'utf8')).trim().split('\n').filter(Boolean);
  assert.equal(dCalls.length, 1, 'eslint_d should be invoked exactly once');
  assert.match(dCalls[0], /src\/foo\.ts/);
  const eCalls = await fs.readFile(eLog, 'utf8').catch(() => '');
  assert.equal(eCalls, '', 'plain eslint must not be invoked when eslint_d exists');
});

test('falls back to eslint when eslint_d is absent', async () => {
  const dir = await mkTmp();
  const eLog = await fakeEslint(dir, 'eslint', 0);
  const r = runHook(dir, 'src/foo.ts');
  assert.equal(r.status, 0);
  const eCalls = (await fs.readFile(eLog, 'utf8')).trim().split('\n').filter(Boolean);
  assert.equal(eCalls.length, 1);
  assert.match(eCalls[0], /--cache/, 'fallback should pass --cache');
});

test('eslint failure propagates as exit 2', async () => {
  const dir = await mkTmp();
  await fakeEslint(dir, 'eslint', 1);
  const r = runHook(dir, 'src/bad.ts');
  assert.equal(r.status, 2);
});

test('GUARDRAILS_ESLINT_BIN override is honored', async () => {
  const dir = await mkTmp();
  // Standard binaries say success; override binary says failure.
  await fakeEslint(dir, 'eslint_d', 0);
  await fakeEslint(dir, 'eslint', 0);
  const overrideLog = path.join(dir, 'override.log');
  const overrideBin = path.join(dir, 'fake-override.sh');
  await fs.writeFile(
    overrideBin,
    `#!/usr/bin/env bash\necho "$@" >> ${JSON.stringify(overrideLog)}\nexit 1\n`,
  );
  await fs.chmod(overrideBin, 0o755);

  const input = JSON.stringify({ tool_input: { file_path: 'src/foo.ts' } });
  const r = spawnSync('bash', [HOOK], {
    input,
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, GUARDRAILS_ESLINT_BIN: overrideBin },
  });
  assert.equal(r.status, 2);
  assert.ok(
    (await fs.readFile(overrideLog, 'utf8')).includes('src/foo.ts'),
    'override binary must have been invoked',
  );
});
