// node --test dev-genie/lib/claude-settings-merger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  mergeEditLintHook,
  buildManagedEntry,
  MANAGED_COMMAND,
  MANAGED_MATCHER,
} from './claude-settings-merger.mjs';

async function mkTmp() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'devgenie-csm-'));
}

function readJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

test('creates settings.json when absent', async () => {
  const dir = await mkTmp();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  const r = mergeEditLintHook({ settingsPath });
  assert.equal(r.action, 'created');
  assert.equal(r.changed, true);
  const parsed = readJSON(settingsPath);
  assert.deepEqual(parsed, { hooks: { PostToolUse: [buildManagedEntry()] } });
});

test('adds entry when settings exist with empty/missing hooks', async () => {
  const dir = await mkTmp();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: ['Bash'] } }, null, 2));
  const r = mergeEditLintHook({ settingsPath });
  assert.equal(r.action, 'added');
  const parsed = readJSON(settingsPath);
  assert.deepEqual(parsed.permissions, { allow: ['Bash'] });
  assert.equal(parsed.hooks.PostToolUse.length, 1);
  assert.equal(parsed.hooks.PostToolUse[0].matcher, MANAGED_MATCHER);
});

test('appends to existing PostToolUse entries, preserving them', async () => {
  const dir = await mkTmp();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  const existing = {
    hooks: {
      PostToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] },
      ],
      PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'pre.sh' }] }],
    },
  };
  writeFileSync(settingsPath, JSON.stringify(existing, null, 2));
  const r = mergeEditLintHook({ settingsPath });
  assert.equal(r.action, 'added');
  const parsed = readJSON(settingsPath);
  assert.equal(parsed.hooks.PostToolUse.length, 2);
  assert.equal(parsed.hooks.PostToolUse[0].hooks[0].command, 'echo hi');
  assert.equal(parsed.hooks.PostToolUse[1].hooks[0].command, MANAGED_COMMAND);
  assert.deepEqual(parsed.hooks.PreToolUse, existing.hooks.PreToolUse);
});

test('idempotent: second run is a no-op', async () => {
  const dir = await mkTmp();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  mergeEditLintHook({ settingsPath });
  const before = readFileSync(settingsPath, 'utf8');
  const r2 = mergeEditLintHook({ settingsPath });
  assert.equal(r2.action, 'noop');
  assert.equal(r2.changed, false);
  const after = readFileSync(settingsPath, 'utf8');
  assert.equal(before, after);
  const parsed = readJSON(settingsPath);
  assert.equal(
    parsed.hooks.PostToolUse.filter((e) =>
      e.hooks?.some((h) => h.command === MANAGED_COMMAND),
    ).length,
    1,
  );
});

test('updates stale managed entry to canonical matcher', async () => {
  const dir = await mkTmp();
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  const stale = {
    hooks: {
      PostToolUse: [
        { matcher: 'Edit', hooks: [{ type: 'command', command: MANAGED_COMMAND }] },
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'other.sh' }] },
      ],
    },
  };
  writeFileSync(settingsPath, JSON.stringify(stale, null, 2));
  const r = mergeEditLintHook({ settingsPath });
  assert.equal(r.action, 'updated');
  const parsed = readJSON(settingsPath);
  assert.equal(parsed.hooks.PostToolUse.length, 2);
  assert.equal(parsed.hooks.PostToolUse[0].matcher, MANAGED_MATCHER);
  assert.equal(parsed.hooks.PostToolUse[0].hooks[0].command, MANAGED_COMMAND);
  assert.equal(parsed.hooks.PostToolUse[1].hooks[0].command, 'other.sh');
});
