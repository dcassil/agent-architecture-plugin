import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export const MANAGED_COMMAND = 'guardrails/scripts/lint-edited-file.sh';
export const MANAGED_MATCHER = 'Edit|Write|MultiEdit';

export function buildManagedEntry() {
  return {
    matcher: MANAGED_MATCHER,
    hooks: [{ type: 'command', command: MANAGED_COMMAND }],
  };
}

function isManagedEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
  return hooks.some((h) => h && h.command === MANAGED_COMMAND);
}

function entriesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeEditLintHook({ settingsPath }) {
  if (!settingsPath) throw new Error('settingsPath is required');
  const managed = buildManagedEntry();

  if (!existsSync(settingsPath)) {
    mkdirSync(path.dirname(settingsPath), { recursive: true });
    const fresh = { hooks: { PostToolUse: [managed] } };
    writeFileSync(settingsPath, JSON.stringify(fresh, null, 2) + '\n');
    return { action: 'created', changed: true, path: settingsPath };
  }

  const raw = readFileSync(settingsPath, 'utf8');
  let parsed;
  try {
    parsed = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse ${settingsPath}: ${e.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object at ${settingsPath}`);
  }

  if (!parsed.hooks || typeof parsed.hooks !== 'object' || Array.isArray(parsed.hooks)) {
    parsed.hooks = {};
  }
  if (!Array.isArray(parsed.hooks.PostToolUse)) {
    parsed.hooks.PostToolUse = [];
  }

  const arr = parsed.hooks.PostToolUse;
  const idx = arr.findIndex(isManagedEntry);

  let action;
  if (idx === -1) {
    arr.push(managed);
    action = 'added';
  } else if (entriesEqual(arr[idx], managed)) {
    action = 'noop';
  } else {
    arr[idx] = managed;
    action = 'updated';
  }

  const next = JSON.stringify(parsed, null, 2) + '\n';
  if (next === raw) {
    return { action: 'noop', changed: false, path: settingsPath };
  }
  writeFileSync(settingsPath, next);
  return { action, changed: action !== 'noop', path: settingsPath };
}

async function main(argv) {
  const args = argv.slice(2);
  let repo = process.cwd();
  let settingsPath = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--repo') repo = args[++i];
    else if (a === '--settings') settingsPath = args[++i];
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: claude-settings-merger.mjs [--repo PATH] [--settings PATH]\n' +
          'Installs the dev-genie edit-time ESLint hook into <repo>/.claude/settings.json.\n',
      );
      return 0;
    }
  }
  const target = settingsPath || path.join(repo, '.claude', 'settings.json');
  const result = mergeEditLintHook({ settingsPath: target });
  process.stdout.write(JSON.stringify(result) + '\n');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then((code) => process.exit(code));
}
