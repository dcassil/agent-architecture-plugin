// node --test dev-genie/skills/project-detection/detect-agent-config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectAgentConfig, findLockForPath, parseLocks } = require('./detect-agent-config.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-agentcfg-'));
}

test('no agent files → empty array', async () => {
  const dir = await mkTmp();
  const res = detectAgentConfig(dir);
  assert.deepEqual(res, []);
});

test('plain CLAUDE.md with no locks → rules captured, locks empty', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'CLAUDE.md'),
    '# Project\n\n- Use TypeScript strict mode\n- Prefer named exports\n',
  );
  const res = detectAgentConfig(dir);
  assert.equal(res.length, 1);
  assert.equal(res[0].path, 'CLAUDE.md');
  assert.deepEqual(res[0].locks, []);
  assert.ok(res[0].rules.includes('Use TypeScript strict mode'));
});

test('CLAUDE.md with phrase-based lock → captured', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'CLAUDE.md'),
    'Do not modify `eslint.config.mjs`.\n',
  );
  const res = detectAgentConfig(dir);
  assert.equal(res[0].locks.length, 1);
  assert.equal(res[0].locks[0].pattern, 'eslint.config.mjs');
});

test('fenced locked: block → captured', async () => {
  const dir = await mkTmp();
  await fs.writeFile(
    path.join(dir, 'AGENTS.md'),
    'Some rules.\n\n```\nlocked:\n  - eslint.config.*\n  - tsconfig.json\n```\n',
  );
  const res = detectAgentConfig(dir);
  const pats = res[0].locks.map((l) => l.pattern).sort();
  assert.deepEqual(pats, ['eslint.config.*', 'tsconfig.json']);
});

test('multiple agent files with overlapping locks', async () => {
  const dir = await mkTmp();
  await fs.writeFile(path.join(dir, 'CLAUDE.md'), 'do not edit `eslint.config.mjs`\n');
  await fs.writeFile(path.join(dir, 'AGENTS.md'), 'never modify `eslint.config.mjs`\n');
  const res = detectAgentConfig(dir);
  assert.equal(res.length, 2);
  assert.equal(res[0].locks.length, 1);
  assert.equal(res[1].locks.length, 1);
});

test('.cursor/rules/*.md picked up', async () => {
  const dir = await mkTmp();
  await fs.mkdir(path.join(dir, '.cursor', 'rules'), { recursive: true });
  await fs.writeFile(path.join(dir, '.cursor', 'rules', 'core.md'), '- be kind\n');
  const res = detectAgentConfig(dir);
  assert.equal(res.length, 1);
  assert.ok(res[0].path.endsWith('core.md'));
});

test('findLockForPath matches glob', () => {
  const agentConfigs = [{ path: 'CLAUDE.md', locks: [{ pattern: 'eslint.config.*', reason: 'r', sourceLine: 1 }] }];
  assert.ok(findLockForPath(agentConfigs, 'eslint.config.mjs'));
  assert.ok(findLockForPath(agentConfigs, 'eslint.config.cjs'));
  assert.equal(findLockForPath(agentConfigs, 'tsconfig.json'), null);
});

test('parseLocks handles inline locked array', () => {
  const locks = parseLocks('```\nlocked: [eslint.config.mjs, tsconfig.json]\n```\n');
  assert.equal(locks.length, 2);
});
