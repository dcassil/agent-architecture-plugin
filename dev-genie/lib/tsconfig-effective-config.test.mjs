// node --test dev-genie/lib/tsconfig-effective-config.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveTsconfig } = require('./tsconfig-effective-config.js');
const { compareConfig } = require('./compare-config.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-tsconfig-'));
}

test('resolveTsconfig: literal fallback reads compilerOptions', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, target: 'es2022' } }),
  );
  const r = resolveTsconfig(dir);
  assert.equal(r.compilerOptions.strict, true);
  assert.equal(r.compilerOptions.target, 'es2022');
  // tsc may not be available in this env; literal fallback is acceptable.
  assert.ok(r.source === 'tsc' || r.source === 'literal');
});

test('resolveTsconfig: missing tsconfig returns null', async () => {
  const dir = await mkTmp();
  const r = resolveTsconfig(dir);
  assert.equal(r.compilerOptions, null);
  assert.equal(r.source, 'none');
});

test('compareConfig: injected resolvedTsconfig wins over literal read', async () => {
  const dir = await mkTmp();
  // On-disk tsconfig is bare (mimics `extends` chain we cannot resolve here).
  await fs.writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify({ extends: './base.json' }));
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));

  // Pretend tsc resolved a fully-strict effective config.
  const resolvedTsconfig = {
    compilerOptions: { strict: true, noUncheckedIndexedAccess: true },
    source: 'tsc',
    tscVersion: 'Version 5.0.0',
    errors: [],
  };

  const baseline = {
    eslint: { base: { rules: {} } },
    tsconfig: { compilerOptions: { strict: true } },
  };
  const universal = { requiredScripts: {}, enforcementPoints: [] };

  const { findings } = await compareConfig({
    archId: 'node-api',
    repoPath: dir,
    detected: { repoPath: dir, scripts: { files: [] }, hooks: { files: [] } },
    resolvedEslint: { configs: {}, eslintVersion: null, errors: [] },
    resolvedTsconfig,
    buildCI: { packageJson: { scripts: {}, buildChainsLintAndTypecheck: false }, ci: { found: false } },
    baseline,
    universal,
  });

  const strictFinding = findings.find((f) => f.id === 'tsconfig:strict');
  assert.ok(strictFinding, 'expected a tsconfig:strict finding');
  assert.equal(
    strictFinding.status,
    'present',
    `strict should be present via injected resolved config; got ${strictFinding.status}`,
  );
});
