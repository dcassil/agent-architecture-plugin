'use strict';

/**
 * apply-flow
 *
 * Interactive confirm-and-apply flow for dev-genie init-into-existing-repo.
 *
 * Public API:
 *   applyFindings({ repoPath, archId, findings, mode })
 *     -> Promise<{ applied, skipped, errors }>
 *
 *   applyFinding(repoPath, finding)
 *     -> Promise<{ ok, message }>
 *
 *   mode ∈ 'dry-run' | 'auto-critical' | 'interactive' | 'apply-all'
 *
 * Findings carry a declarative `diff` (see lib/report.js):
 *   - kind 'string'      → eslint rule override (managed block in user config)
 *   - kind 'json-patch'  → tsconfig.json or package.json RFC-6902 ops
 *   - kind 'ensure'      → enforcement intent (pre-commit / build / ci / audit)
 *
 * Errors are collected, never thrown out of applyFindings.
 */

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');

const { toJSON, formatReport } = require('./report.js');
const { addPackageScripts } = require('./write-helpers.js');
const { applyEnsure } = require('./apply-ensure.js');
const { writeLayeredEslintConfig } = require('./eslint-layered-writer.js');

const ESLINT_SENTINEL_BEGIN = '// >>> dev-genie managed >>>';
const ESLINT_SENTINEL_END = '// <<< dev-genie managed <<<';

// ---------- helpers ------------------------------------------------------

function detectIndent(raw) {
  if (!raw) return '  ';
  const m = raw.match(/^\{\s*\n([ \t]+)/);
  if (m) return m[1];
  return '  ';
}

function parseJsonc(raw) {
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(stripped);
}

function ptrSegments(p) {
  if (!p.startsWith('/')) throw new Error(`bad pointer: ${p}`);
  return p
    .slice(1)
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function applyJsonPatchOp(obj, op) {
  const segs = ptrSegments(op.path);
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  const last = segs[segs.length - 1];
  if (op.op === 'add' || op.op === 'replace') {
    cur[last] = op.value;
  } else if (op.op === 'remove') {
    delete cur[last];
  } else {
    throw new Error(`unsupported json-patch op: ${op.op}`);
  }
}

function summarizeBeforeAfter(label, before, after) {
  return (
    `  ${label}\n` +
    `    before: ${before === undefined ? '<unset>' : JSON.stringify(before)}\n` +
    `    after:  ${after === undefined ? '<unset>' : JSON.stringify(after)}`
  );
}

// ---------- per-finding appliers ----------------------------------------

async function applyJsonPatchTsconfig(repoPath, finding) {
  const file = path.join(repoPath, 'tsconfig.json');
  if (!fs.existsSync(file)) {
    return { ok: false, message: `tsconfig.json not found at ${file}` };
  }
  const raw = await fsp.readFile(file, 'utf8');
  const indent = detectIndent(raw);
  let parsed;
  try {
    parsed = parseJsonc(raw);
  } catch (e) {
    return { ok: false, message: `failed to parse tsconfig.json: ${e.message}` };
  }
  const beforeKey = (() => {
    try {
      const segs = ptrSegments(finding.diff.value[0].path);
      let cur = parsed;
      for (const s of segs) cur = cur && cur[s];
      return cur;
    } catch {
      return undefined;
    }
  })();
  for (const op of finding.diff.value) applyJsonPatchOp(parsed, op);
  const trailing = raw.endsWith('\n') ? '\n' : '';
  await fsp.writeFile(file, JSON.stringify(parsed, null, indent) + trailing, 'utf8');
  return {
    ok: true,
    message:
      `updated tsconfig.json:\n` +
      summarizeBeforeAfter(finding.key, beforeKey, finding.diff.value[finding.diff.value.length - 1].value),
  };
}

function jsonPatchIsAllScriptAdditions(ops) {
  if (!Array.isArray(ops) || ops.length === 0) return false;
  return ops.every(
    (op) =>
      (op.op === 'add' || op.op === 'replace') &&
      typeof op.path === 'string' &&
      op.path.startsWith('/scripts/'),
  );
}

async function applyJsonPatchPackageJson(repoPath, finding) {
  const ops = finding.diff.value;
  const file = path.join(repoPath, 'package.json');
  if (!fs.existsSync(file)) {
    return { ok: false, message: `package.json not found at ${file}` };
  }

  if (jsonPatchIsAllScriptAdditions(ops)) {
    const scripts = {};
    for (const op of ops) {
      const name = op.path.slice('/scripts/'.length);
      scripts[name] = op.value;
    }
    try {
      const res = addPackageScripts(repoPath, scripts);
      const lines = [];
      if (res.added.length) lines.push(`  added: ${res.added.join(', ')}`);
      if (res.skipped.length) lines.push(`  skipped (already present): ${res.skipped.join(', ')}`);
      if (res.overwritten.length) lines.push(`  overwritten: ${res.overwritten.join(', ')}`);
      return { ok: true, message: `package.json scripts updated:\n${lines.join('\n')}` };
    } catch (e) {
      return { ok: false, message: `addPackageScripts failed: ${e.message}` };
    }
  }

  // Direct apply, preserving indent.
  const raw = await fsp.readFile(file, 'utf8');
  const indent = detectIndent(raw);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, message: `failed to parse package.json: ${e.message}` };
  }
  for (const op of ops) applyJsonPatchOp(parsed, op);
  const trailing = raw.endsWith('\n') ? '\n' : '';
  await fsp.writeFile(file, JSON.stringify(parsed, null, indent) + trailing, 'utf8');
  return { ok: true, message: `package.json updated (${ops.length} ops applied).` };
}

function findEslintConfigFile(repoPath) {
  for (const name of ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs']) {
    const p = path.join(repoPath, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Collect all queued eslint-rule findings into a single managed block, written
// once per applyFindings invocation. We expose this as a per-finding helper so
// the dispatcher can also be called standalone — in that case the block holds
// only that one rule (still idempotent).
function buildEslintManagedBlock(rulesEntries) {
  const ruleLines = rulesEntries.map(
    ([name, entry]) => `      ${JSON.stringify(name)}: ${JSON.stringify(entry)},`,
  );
  return [
    ESLINT_SENTINEL_BEGIN,
    '// Managed by dev-genie. Do not edit between markers; re-run init to update.',
    'export default [',
    '  {',
    '    rules: {',
    ...ruleLines,
    '    },',
    '  },',
    '];',
    ESLINT_SENTINEL_END,
    '',
  ].join('\n');
}

async function writeEslintManagedBlock(repoPath, rulesEntries) {
  const file = findEslintConfigFile(repoPath);
  if (!file) {
    return {
      ok: false,
      message:
        'no eslint.config.{mjs,js,cjs} found; create one (or use the arch-* boilerplate) before applying eslint findings.',
    };
  }

  // Strip any legacy managed block that earlier versions of dev-genie may have
  // appended (which produced a second `export default` and broke the module).
  const beforeRaw = (await readSafe(file)) || '';
  if (beforeRaw.includes(ESLINT_SENTINEL_BEGIN) && beforeRaw.includes(ESLINT_SENTINEL_END)) {
    const re = new RegExp(
      `\\n*${escapeRegExp(ESLINT_SENTINEL_BEGIN)}[\\s\\S]*?${escapeRegExp(ESLINT_SENTINEL_END)}\\n?`,
      'm',
    );
    const cleaned = beforeRaw.replace(re, '');
    if (cleaned !== beforeRaw) {
      await fsp.writeFile(file, cleaned, 'utf8');
    }
  }

  // Use the layered writer: emits a separate eslint.config.guardrails.mjs and
  // rewrites the user's entry point to a proxy (with .dev-genie.bak backup).
  // This avoids duplicating `export default` in the user's config.
  const rules = Object.fromEntries(rulesEntries);
  const res = writeLayeredEslintConfig(repoPath, rules, { rewriteEntryPoint: true });
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.mode === 'fallback-legacy'
          ? `legacy ${res.fallbackReason || 'eslint config'}; cannot layer flat-config rules`
          : `eslint layered write failed: ${res.fallbackReason || 'unknown'}`,
    };
  }
  return {
    ok: true,
    message:
      `wrote layered override at ${path.relative(repoPath, res.path)} ` +
      `(${rulesEntries.length} rule${rulesEntries.length === 1 ? '' : 's'}).`,
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readSafe(p) {
  try {
    return await fsp.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

// ---------- lock resolution ---------------------------------------------

// Map of finding category → repo-relative target path used to look up locks.
function targetPathForFinding(finding) {
  if (!finding) return null;
  if (finding.diff && finding.diff.target) {
    if (typeof finding.diff.target === 'string') return finding.diff.target;
  }
  if (finding.category === 'eslint') return 'eslint.config.mjs';
  if (finding.category === 'tsconfig' || finding.category === 'typescript') return 'tsconfig.json';
  if (finding.category === 'package' || finding.category === 'scripts') return 'package.json';
  return null;
}

let _agentConfigCache = null;
function loadAgentConfigs(repoPath) {
  if (_agentConfigCache && _agentConfigCache.repo === repoPath) return _agentConfigCache.data;
  try {
    const { detectAgentConfig } = require('../skills/project-detection/detect-agent-config.js');
    const data = detectAgentConfig(repoPath);
    _agentConfigCache = { repo: repoPath, data };
    return data;
  } catch {
    return [];
  }
}

function findLockForFinding(repoPath, finding) {
  const target = targetPathForFinding(finding);
  if (!target) return null;
  try {
    const { findLockForPath } = require('../skills/project-detection/detect-agent-config.js');
    return findLockForPath(loadAgentConfigs(repoPath), target);
  } catch {
    return null;
  }
}

// ---------- public: applyFinding ----------------------------------------

async function applyFinding(repoPath, finding) {
  if (!finding || !finding.diff) {
    return { ok: false, message: `finding has no diff: ${finding && finding.id}` };
  }
  const { diff } = finding;
  try {
    if (diff.kind === 'json-patch' && diff.target === 'tsconfig.json') {
      return await applyJsonPatchTsconfig(repoPath, finding);
    }
    if (diff.kind === 'json-patch' && diff.target === 'package.json') {
      return await applyJsonPatchPackageJson(repoPath, finding);
    }
    if (diff.kind === 'string') {
      // Single-rule eslint write. The batched pathway is preferred (see applyFindings).
      const ruleName = finding.key;
      const entry = finding.expected;
      return await writeEslintManagedBlock(repoPath, [[ruleName, entry]]);
    }
    if (diff.kind === 'ensure') {
      return await applyEnsure(repoPath, finding);
    }
    return { ok: false, message: `unsupported diff kind: ${diff.kind}` };
  } catch (e) {
    return { ok: false, message: `applyFinding(${finding.id}) threw: ${e.message}` };
  }
}

// ---------- prompt helpers ----------------------------------------------

async function prompt(rl, q) {
  const ans = (await rl.question(q)) || '';
  return ans.trim().toLowerCase();
}

function renderGroup(severity, items) {
  const lines = [];
  lines.push('');
  lines.push(`=== ${severity.toUpperCase()} (${items.length}) ===`);
  for (const f of items) {
    lines.push(`  [${f.status}] ${f.category}:${f.key} — ${f.message}`);
  }
  return lines.join('\n');
}

// ---------- public: applyFindings ---------------------------------------

async function applyFindings({ repoPath, archId, findings, mode }) {
  void archId; // currently unused; reserved for future arch-specific routing
  const applied = [];
  const skipped = [];
  const errors = [];

  // Filter to actionable findings only (drop status:'present').
  const actionable = (findings || []).filter(
    (f) => f && f.status !== 'present' && f.diff,
  );

  if (actionable.length === 0) {
    return { applied, skipped, errors };
  }

  // Group by severity for prompting / auto-critical.
  const bySeverity = { critical: [], recommended: [], optional: [] };
  for (const f of actionable) {
    (bySeverity[f.severity] || bySeverity.recommended).push(f);
  }

  // Decide which findings will be applied per mode.
  let toApply = [];
  if (mode === 'dry-run') {
    process.stdout.write('\n[dev-genie] DRY RUN — no files will be modified.\n');
    process.stdout.write(formatReport(findings, { color: false }) + '\n');
    process.stdout.write(
      `\n[dev-genie] Would apply ${actionable.length} finding${actionable.length === 1 ? '' : 's'} (none written).\n`,
    );
    return { applied: [], skipped: actionable.map((f) => f.id), errors: [] };
  }

  if (mode === 'apply-all') {
    toApply = actionable.slice();
  } else if (mode === 'auto-critical') {
    toApply = bySeverity.critical.slice();
    for (const f of [...bySeverity.recommended, ...bySeverity.optional]) {
      skipped.push(f.id);
    }
  } else if (mode === 'interactive') {
    const rl = readline.createInterface({ input, output });
    try {
      for (const sev of ['critical', 'recommended', 'optional']) {
        const items = bySeverity[sev];
        if (!items || items.length === 0) continue;
        process.stdout.write(renderGroup(sev, items) + '\n');
        const ans = await prompt(rl, `Apply ${sev} group? [a]ll / [n]one / [s]elect / [q]uit: `);
        if (ans === 'q' || ans === 'quit') {
          for (const f of items) skipped.push(f.id);
          // Skip remaining groups.
          for (const sev2 of ['critical', 'recommended', 'optional']) {
            if (sev2 === sev) continue;
            for (const f of bySeverity[sev2] || []) {
              if (!skipped.includes(f.id)) skipped.push(f.id);
            }
          }
          break;
        }
        if (ans === 'n' || ans === 'none' || ans === '') {
          for (const f of items) skipped.push(f.id);
          continue;
        }
        if (ans === 'a' || ans === 'all') {
          toApply.push(...items);
          continue;
        }
        if (ans === 's' || ans === 'select') {
          for (const f of items) {
            const ya = await prompt(
              rl,
              `  apply ${f.category}:${f.key} (${f.status})? [y/N]: `,
            );
            if (ya === 'y' || ya === 'yes') toApply.push(f);
            else skipped.push(f.id);
          }
          continue;
        }
        // Unknown input → treat as none, be safe.
        for (const f of items) skipped.push(f.id);
      }
    } finally {
      rl.close();
    }
  } else {
    throw new Error(`applyFindings: unknown mode "${mode}"`);
  }

  // Batch eslint-string findings into one managed block write.
  const eslintRuleFindings = toApply.filter(
    (f) => f.diff && f.diff.kind === 'string' && f.category === 'eslint',
  );
  const nonEslint = toApply.filter(
    (f) => !(f.diff && f.diff.kind === 'string' && f.category === 'eslint'),
  );

  // Lock resolution: for each finding whose target file is locked by an agent
  // config, prompt for skip / lift-temporarily / lift-permanently. In
  // non-interactive modes (apply-all / auto-critical), default to SKIP — never
  // silently lift a lock.
  const lockedItems = [];
  const lockResolutions = new Map(); // finding.id → 'skip'|'lift-temp'|'lift-perm'
  for (const f of toApply) {
    const lock = findLockForFinding(repoPath, f);
    if (lock) lockedItems.push({ finding: f, lock });
  }
  if (lockedItems.length > 0) {
    if (mode === 'interactive') {
      const rl = readline.createInterface({ input, output });
      try {
        for (const { finding, lock } of lockedItems) {
          process.stdout.write(`\n[lock] ${finding.id} target is locked by ${lock.agentFile}: "${lock.reason}"\n`);
          const ans = await prompt(rl, `  resolve: [s]kip / [t]emp-lift / [p]erm-lift+rewrite: `);
          if (ans === 't' || ans === 'temp' || ans === 'temp-lift') lockResolutions.set(finding.id, 'lift-temp');
          else if (ans === 'p' || ans === 'perm' || ans === 'perm-lift') lockResolutions.set(finding.id, 'lift-perm');
          else lockResolutions.set(finding.id, 'skip');
        }
      } finally {
        rl.close();
      }
    } else {
      for (const { finding, lock } of lockedItems) {
        lockResolutions.set(finding.id, 'skip');
        process.stdout.write(`[lock] skipping ${finding.id} (locked by ${lock.agentFile}); use --mode interactive to resolve.\n`);
      }
    }
  }
  // Drop skipped-locked findings from toApply; collect for later perm-lift.
  const permLifts = [];
  toApply = toApply.filter((f) => {
    const r = lockResolutions.get(f.id);
    if (r === undefined) return true;
    if (r === 'skip') { skipped.push(f.id); return false; }
    if (r === 'lift-perm') {
      const lock = findLockForFinding(repoPath, f);
      if (lock) permLifts.push({ finding: f, lock });
    }
    return true; // lift-temp and lift-perm both proceed with the apply
  });

  process.stdout.write(`\n[dev-genie] applying ${toApply.length} finding(s)...\n`);

  if (eslintRuleFindings.length > 0) {
    const entries = eslintRuleFindings.map((f) => [f.key, f.expected]);
    const res = await writeEslintManagedBlock(repoPath, entries);
    process.stdout.write(`  eslint: ${res.message}\n`);
    if (res.ok) {
      for (const f of eslintRuleFindings) applied.push(f.id);
    } else {
      for (const f of eslintRuleFindings) errors.push({ id: f.id, message: res.message });
    }
  }

  for (const f of nonEslint) {
    const res = await applyFinding(repoPath, f);
    process.stdout.write(`  ${f.id}: ${res.ok ? 'OK' : 'ERROR'} — ${res.message.split('\n')[0]}\n`);
    if (res.ok) applied.push(f.id);
    else errors.push({ id: f.id, message: res.message });
  }

  // Permanent lift: rewrite the lock language in the agent file(s).
  if (permLifts.length > 0) {
    try {
      const { liftLock } = require('./agent-config-writer.js');
      for (const { lock } of permLifts) {
        const agentPath = path.join(repoPath, lock.agentFile);
        const r = liftLock(agentPath, lock.pattern);
        process.stdout.write(`  [lock] permanently lifted "${lock.pattern}" in ${lock.agentFile}: ${r.changed ? 'updated' : 'no-op'}\n`);
      }
    } catch (e) {
      process.stdout.write(`  [lock] perm-lift error: ${e.message}\n`);
    }
  }

  process.stdout.write(
    `\n[dev-genie] applied=${applied.length} skipped=${skipped.length} errors=${errors.length}\n`,
  );
  return { applied, skipped, errors };
}

module.exports = { applyFindings, applyFinding, writeEslintManagedBlock };

// ---------- smoke test --------------------------------------------------
// node dev-genie/lib/apply-flow.js
if (require.main === module) {
  (async () => {
    const { compareConfig } = require('./compare-config.js');
    const repoRoot = path.resolve(__dirname, '../..');
    process.stdout.write(`[smoke] running dry-run apply against ${repoRoot}\n`);
    const { findings } = await compareConfig({ archId: 'node-api', repoPath: repoRoot });
    const result = await applyFindings({
      repoPath: repoRoot,
      archId: 'node-api',
      findings,
      mode: 'dry-run',
    });
    process.stdout.write(`\n[smoke] result: ${JSON.stringify(result, null, 2)}\n`);
    // Also exercise toJSON to confirm finding shape feeds the apply layer.
    const j = toJSON(findings);
    process.stdout.write(
      `[smoke] toJSON: ${j.summary.total} findings, ${j.groups.length} severity groups\n`,
    );
  })().catch((err) => {
    process.stderr.write(String((err && err.stack) || err) + '\n');
    process.exit(1);
  });
}
