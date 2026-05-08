// Read-only scanner for agent-config files (CLAUDE.md, AGENTS.md, GEMINI.md,
// .windsurfrules, .cursor/rules/*.md, .claude/**/*.md). Parses any "lock"
// declarations the file contains so the dev-genie reconcile flow can classify
// findings as `absent-and-file-locked`.
//
// Output shape:
//   [{ path, rawContent, rules: string[], locks: { pattern, reason, sourceLine }[] }]
//
// No external deps. Node 18+.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.windsurfrules'];

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function listMdRecursive(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMdRecursive(full));
    else if (e.isFile() && /\.(md|mdc|markdown)$/i.test(e.name)) out.push(full);
    else if (e.isFile() && e.name === '.windsurfrules') out.push(full);
  }
  return out;
}

// Phrase-based lock detection. Each regex group 1 captures the locked pattern.
// Each pattern: capture group 1 is the locked file. Prefer backticked form;
// otherwise capture a non-space token until terminator.
const LOCK_PATTERNS = [
  /\bdo\s+not\s+(?:modify|edit|change|touch|alter)\s+`([^`\n]+)`/i,
  /\bnever\s+(?:modify|edit|change|touch)\s+`([^`\n]+)`/i,
  /\bdon'?t\s+(?:modify|edit|change|touch)\s+`([^`\n]+)`/i,
  /\bdo\s+not\s+(?:modify|edit|change|touch|alter)\s+(\S+?)(?:[.,;:!]\s|\s|$)/i,
  /\bnever\s+(?:modify|edit|change|touch)\s+(\S+?)(?:[.,;:!]\s|\s|$)/i,
  /\bdon'?t\s+(?:modify|edit|change|touch)\s+(\S+?)(?:[.,;:!]\s|\s|$)/i,
  /`([^`\n]+)`\s+is\s+locked\b/i,
  /\b(\S+)\s+is\s+locked\b/i,
  /`([^`\n]+)`\s+(?:must|should)\s+not\s+be\s+(?:modified|edited|changed|touched)\b/i,
];

function parseLocks(content) {
  const locks = [];
  if (!content) return locks;
  const lines = content.split(/\r?\n/);

  // Phrase-based scan
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const re of LOCK_PATTERNS) {
      const m = line.match(re);
      if (m) {
        let raw = m[1].trim().replace(/^["'`]|["'`]$/g, '');
        // Strip trailing sentence punctuation that snuck in.
        raw = raw.replace(/[.,;:!?]+$/, '');
        // Must look like a path/glob: contain '.' or '/' or '*'.
        if (!raw || !/[./*]/.test(raw)) continue;
        locks.push({
          pattern: raw,
          reason: line.trim(),
          sourceLine: i + 1,
        });
        break;
      }
    }
  }

  // Fenced "locked:" YAML/JSON blocks:
  //   ```
  //   locked:
  //     - eslint.config.*
  //     - tsconfig.json
  //   ```
  // Also accept inline `locked: [a, b]`.
  const fenceRe = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(content)) !== null) {
    const body = match[1];
    const lockMatch = body.match(/locked\s*:\s*\n((?:\s*-\s*.+\n?)+)/);
    if (lockMatch) {
      const items = lockMatch[1]
        .split(/\n/)
        .map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean);
      const startLine = content.slice(0, match.index).split(/\r?\n/).length;
      for (const it of items) {
        const pat = it.replace(/^["']|["']$/g, '');
        if (pat) locks.push({ pattern: pat, reason: 'fenced locked: block', sourceLine: startLine });
      }
    }
    const inline = body.match(/locked\s*:\s*\[([^\]]+)\]/);
    if (inline) {
      const items = inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      const startLine = content.slice(0, match.index).split(/\r?\n/).length;
      for (const it of items) locks.push({ pattern: it, reason: 'fenced locked: inline', sourceLine: startLine });
    }
  }

  return locks;
}

function parseRules(content) {
  // Lightweight bullet-list extraction. Capture lines that look like rules
  // (start with `- ` or `* `) up to a reasonable cap.
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const rules = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (m) rules.push(m[1].trim());
    if (rules.length >= 200) break;
  }
  return rules;
}

function scanOne(repo, relPath) {
  const full = path.join(repo, relPath);
  const raw = readSafe(full);
  if (raw == null) return null;
  return {
    path: relPath,
    rawContent: raw,
    rules: parseRules(raw),
    locks: parseLocks(raw),
  };
}

function detectAgentConfig(repoPath) {
  const repo = path.resolve(repoPath);
  const out = [];
  // Root files
  for (const rel of ROOT_FILES) {
    if (exists(path.join(repo, rel))) {
      const res = scanOne(repo, rel);
      if (res) out.push(res);
    }
  }
  // .cursor/rules/
  const cursorDir = path.join(repo, '.cursor', 'rules');
  if (exists(cursorDir)) {
    for (const f of listMdRecursive(cursorDir)) {
      const res = scanOne(repo, path.relative(repo, f));
      if (res) out.push(res);
    }
  }
  // .claude/**/*.md
  const claudeDir = path.join(repo, '.claude');
  if (exists(claudeDir)) {
    for (const f of listMdRecursive(claudeDir)) {
      const res = scanOne(repo, path.relative(repo, f));
      if (res) out.push(res);
    }
  }
  return out;
}

// Given a list of agent configs and a target file path (relative to repo),
// return the first lock that matches. Glob support: '*' and '?' only.
function findLockForPath(agentConfigs, relTargetPath) {
  function globToRe(g) {
    const escaped = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp('^' + escaped + '$');
  }
  for (const ac of agentConfigs || []) {
    for (const lock of ac.locks || []) {
      const re = globToRe(lock.pattern);
      if (re.test(relTargetPath) || re.test(path.basename(relTargetPath))) {
        return { ...lock, agentFile: ac.path };
      }
    }
  }
  return null;
}

module.exports = { detectAgentConfig, findLockForPath, parseLocks, parseRules };

if (require.main === module) {
  const target = process.argv[2] || path.resolve(__dirname, '../../..');
  process.stdout.write(JSON.stringify(detectAgentConfig(target), null, 2) + '\n');
}
