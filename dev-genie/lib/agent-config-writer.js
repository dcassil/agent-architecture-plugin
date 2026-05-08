'use strict';

// Fenced-block writer for agent config files (CLAUDE.md, AGENTS.md, ...).
// Wraps dev-genie's contributions in
//   <!-- dev-genie:guardrails:begin -->
//   ...
//   <!-- dev-genie:guardrails:end -->
// Re-runs replace ONLY the contents between the markers; never touch text
// outside the fence.

const fs = require('node:fs');
const path = require('node:path');

const BEGIN = '<!-- dev-genie:guardrails:begin -->';
const END = '<!-- dev-genie:guardrails:end -->';
// Escape regex special chars in the markers so they can be safely embedded.
const RE_FENCE = new RegExp(
  BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '[\\s\\S]*?' +
  END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
);

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function buildBlock(body) {
  const trimmed = String(body || '').replace(/^\n+|\n+$/g, '');
  return `${BEGIN}\n${trimmed}\n${END}`;
}

/**
 * Write/replace the dev-genie fenced block in `filePath`.
 * @param {string} filePath absolute path to the agent config file
 * @param {string} body content to place inside the fence (no markers required)
 * @returns {{ ok: true, changed: boolean, action: 'created'|'appended'|'replaced'|'noop' }}
 */
function writeAgentBlock(filePath, body) {
  const block = buildBlock(body);
  const before = readSafe(filePath);
  if (before == null) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, block + '\n', 'utf8');
    return { ok: true, changed: true, action: 'created' };
  }
  if (RE_FENCE.test(before)) {
    const next = before.replace(RE_FENCE, block);
    if (next === before) return { ok: true, changed: false, action: 'noop' };
    fs.writeFileSync(filePath, next, 'utf8');
    return { ok: true, changed: true, action: 'replaced' };
  }
  const sep = before.endsWith('\n') ? '\n' : '\n\n';
  const next = before + sep + block + '\n';
  fs.writeFileSync(filePath, next, 'utf8');
  return { ok: true, changed: true, action: 'appended' };
}

/**
 * Comment out any lock-statement line in `filePath` that references
 * `lockPattern`. Used when the user picks "lift-permanently" during reconcile.
 * Conservative: only modifies lines that match a known lock phrase AND
 * mention the pattern (or its globbed prefix). Leaves everything else intact.
 * @returns {{ ok: true, changed: boolean, lifted: number }}
 */
function liftLock(filePath, lockPattern) {
  const before = readSafe(filePath);
  if (before == null) return { ok: false, changed: false, lifted: 0, error: 'file not found' };

  const lockPhraseRe = /\b(do\s+not|never|don'?t)\s+(modify|edit|change|touch|alter)\b|is\s+locked\b|must\s+not\s+be\s+(modified|edited|changed|touched)\b/i;
  // Convert glob to a substring/regex check. We treat `*` as ".*" but otherwise
  // require the pattern (or its leading literal prefix) to appear in the line.
  const literalPrefix = String(lockPattern).split('*')[0].replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  const patternRe = new RegExp(literalPrefix, 'i');

  const lines = before.split(/\r?\n/);
  let lifted = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const ln = lines[i];
    if (lockPhraseRe.test(ln) && patternRe.test(ln) && !/^\s*<!--/.test(ln)) {
      lines[i] = `<!-- dev-genie lifted lock: ${ln.trim()} -->`;
      lifted += 1;
    }
  }
  if (lifted === 0) return { ok: true, changed: false, lifted: 0 };
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return { ok: true, changed: true, lifted };
}

module.exports = { writeAgentBlock, liftLock, BEGIN, END };
