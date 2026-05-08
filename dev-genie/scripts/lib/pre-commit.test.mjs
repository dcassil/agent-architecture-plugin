// node --test dev-genie/scripts/lib/pre-commit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

import { detectPreCommit, installPreCommitHooks } from './pre-commit.mjs';

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-precommit-'));
}

test('detect: empty repo → no systems, recommends husky if package.json present', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));
  const res = await detectPreCommit(dir);
  assert.equal(res.systems.length, 0);
  assert.equal(res.packageManager, 'npm');
  assert.equal(res.recommendedDefault, 'husky');
});

test('detect: husky pre-commit running npm scripts is correctly classified', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'x',
      scripts: { lint: 'eslint .', typecheck: 'tsc --noEmit', audit: 'node audit/scripts/audit.mjs' },
    }),
  );
  await fs.mkdir(path.join(dir, '.husky'), { recursive: true });
  await fs.writeFile(
    path.join(dir, '.husky', 'pre-commit'),
    '#!/usr/bin/env sh\nnpm run lint\nnpm run typecheck\nnpm run audit\n',
  );
  const res = await detectPreCommit(dir);
  const husky = res.systems.find((s) => s.system === 'husky');
  assert.ok(husky, 'husky detected');
  assert.deepEqual(husky.runs, { lint: true, typecheck: true, audit: true });
});

test('detect: lint-staged via husky resolves through package.json config', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'x',
      'lint-staged': { '*.ts': 'eslint --fix' },
    }),
  );
  await fs.mkdir(path.join(dir, '.husky'), { recursive: true });
  await fs.writeFile(path.join(dir, '.husky', 'pre-commit'), 'npx lint-staged\n');
  const res = await detectPreCommit(dir);
  const husky = res.systems.find((s) => s.system === 'husky');
  assert.ok(husky);
  assert.equal(husky.runs.lint, true);
});

test('detect: lefthook with eslint+tsc in pre-commit', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'lefthook.yml'),
    'pre-commit:\n  commands:\n    lint:\n      run: eslint {staged_files}\n    types:\n      run: tsc --noEmit\n',
  );
  const res = await detectPreCommit(dir);
  const lh = res.systems.find((s) => s.system === 'lefthook');
  assert.ok(lh);
  assert.equal(lh.runs.lint, true);
  assert.equal(lh.runs.typecheck, true);
  assert.equal(lh.runs.audit, false);
});

test('install husky: creates hook, idempotent, replaces managed block', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));

  const r1 = await installPreCommitHooks(dir, {
    system: 'husky',
    commands: ['npm run lint', 'npm run typecheck'],
  });
  assert.equal(r1.changed, true);
  const file = path.join(dir, '.husky', 'pre-commit');
  assert.ok(existsSync(file));
  const v1 = await fs.readFile(file, 'utf8');
  assert.match(v1, /npm run lint \|\| exit \$\?/);
  assert.match(v1, /npm run typecheck \|\| exit \$\?/);

  // Re-run identical → no change
  const r2 = await installPreCommitHooks(dir, {
    system: 'husky',
    commands: ['npm run lint', 'npm run typecheck'],
  });
  assert.equal(r2.changed, false);

  // Re-run with a new command set → managed block replaced, not duplicated
  const r3 = await installPreCommitHooks(dir, {
    system: 'husky',
    commands: ['npm run lint', 'npm run typecheck', 'node audit/scripts/audit.mjs'],
  });
  assert.equal(r3.changed, true);
  const v3 = await fs.readFile(file, 'utf8');
  const beginCount = v3.split('# >>> dev-genie pre-commit >>>').length - 1;
  const endCount = v3.split('# <<< dev-genie pre-commit <<<').length - 1;
  assert.equal(beginCount, 1, 'exactly one managed block');
  assert.equal(endCount, 1);
  assert.match(v3, /audit\/scripts\/audit\.mjs/);
});

test('install raw git hook: integrates with existing hook content', async () => {
  const dir = await mkTmp();
  // simulate a real .git dir
  execSync('git init -q', { cwd: dir });
  const hookFile = path.join(dir, '.git', 'hooks', 'pre-commit');
  await fs.mkdir(path.dirname(hookFile), { recursive: true });
  await fs.writeFile(hookFile, '#!/usr/bin/env bash\nset -e\necho "user hook"\n');

  const r = await installPreCommitHooks(dir, {
    system: 'pre-commit-raw',
    commands: ['npm run lint'],
  });
  assert.equal(r.changed, true);
  const v = await fs.readFile(hookFile, 'utf8');
  assert.match(v, /echo "user hook"/, 'preserves existing content');
  assert.match(v, /npm run lint \|\| exit \$\?/);

  // idempotent
  const r2 = await installPreCommitHooks(dir, {
    system: 'pre-commit-raw',
    commands: ['npm run lint'],
  });
  assert.equal(r2.changed, false);
});

test('install lefthook: creates managed block, idempotent', async () => {
  const dir = await mkTmp();
  const r1 = await installPreCommitHooks(dir, {
    system: 'lefthook',
    commands: ['npm run lint', 'npm run typecheck'],
  });
  assert.equal(r1.changed, true);
  const file = path.join(dir, 'lefthook.yml');
  const v1 = await fs.readFile(file, 'utf8');
  assert.match(v1, /dev_genie:/);

  const r2 = await installPreCommitHooks(dir, {
    system: 'lefthook',
    commands: ['npm run lint', 'npm run typecheck'],
  });
  assert.equal(r2.changed, false);
});

test('install pre-commit framework: creates local repo block, idempotent', async () => {
  const dir = await mkTmp();
  const r1 = await installPreCommitHooks(dir, {
    system: 'pre-commit',
    commands: ['npm run lint'],
  });
  assert.equal(r1.changed, true);
  const v = await fs.readFile(path.join(dir, '.pre-commit-config.yaml'), 'utf8');
  assert.match(v, /repo: local/);
  assert.match(v, /dev-genie-1/);

  const r2 = await installPreCommitHooks(dir, {
    system: 'pre-commit',
    commands: ['npm run lint'],
  });
  assert.equal(r2.changed, false);
});

test('installPreCommitHooks: rejects bad input', async () => {
  const dir = await mkTmp();
  await assert.rejects(() => installPreCommitHooks(dir, { system: 'husky', commands: [] }));
  await assert.rejects(() => installPreCommitHooks(dir, { system: 'unknown', commands: ['x'] }));
  await assert.rejects(() => installPreCommitHooks(dir, { commands: ['x'] }));
});
