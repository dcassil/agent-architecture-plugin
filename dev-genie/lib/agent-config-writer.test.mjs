// node --test dev-genie/lib/agent-config-writer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeAgentBlock, liftLock, BEGIN, END } = require('./agent-config-writer.js');

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-acw-'));
}

test('new file: creates file with fenced block', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  const r = writeAgentBlock(f, 'guardrails body');
  assert.equal(r.action, 'created');
  const content = await fs.readFile(f, 'utf8');
  assert.ok(content.includes(BEGIN) && content.includes(END));
  assert.ok(content.includes('guardrails body'));
});

test('existing file no fence: appends block, preserves prior text', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  await fs.writeFile(f, '# Project\n\nSome rules.\n');
  const r = writeAgentBlock(f, 'rule A');
  assert.equal(r.action, 'appended');
  const content = await fs.readFile(f, 'utf8');
  assert.ok(content.startsWith('# Project'));
  assert.ok(content.includes('rule A'));
});

test('existing fence with same body: noop', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  writeAgentBlock(f, 'rule A');
  const r = writeAgentBlock(f, 'rule A');
  assert.equal(r.action, 'noop');
  assert.equal(r.changed, false);
});

test('existing fence with different body: replaces in place', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  await fs.writeFile(f, `# Top\n\n${BEGIN}\nold body\n${END}\n\nbottom\n`);
  const r = writeAgentBlock(f, 'new body');
  assert.equal(r.action, 'replaced');
  const content = await fs.readFile(f, 'utf8');
  assert.ok(content.includes('new body'));
  assert.ok(!content.includes('old body'));
  assert.ok(content.startsWith('# Top'));
  assert.ok(content.includes('bottom'));
});

test('file with unrelated HTML comments is left intact', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  await fs.writeFile(f, '<!-- something else -->\n\n<!-- another -->\nbody\n');
  writeAgentBlock(f, 'rule A');
  const content = await fs.readFile(f, 'utf8');
  assert.ok(content.includes('<!-- something else -->'));
  assert.ok(content.includes('<!-- another -->'));
});

test('liftLock: comments out matching lock line', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  await fs.writeFile(f, '# rules\n\nDo not modify `eslint.config.mjs`.\n\nOther.\n');
  const r = liftLock(f, 'eslint.config.*');
  assert.equal(r.changed, true);
  assert.equal(r.lifted, 1);
  const content = await fs.readFile(f, 'utf8');
  assert.ok(content.includes('dev-genie lifted lock'));
  assert.ok(!/^Do not modify/m.test(content));
});

test('liftLock: idempotent on second call', async () => {
  const dir = await mkTmp();
  const f = path.join(dir, 'CLAUDE.md');
  await fs.writeFile(f, 'Do not edit `tsconfig.json`.\n');
  liftLock(f, 'tsconfig.json');
  const r2 = liftLock(f, 'tsconfig.json');
  assert.equal(r2.changed, false);
});
