'use strict';

/**
 * report
 *
 * Turn the structured Findings produced by `compare-config.js` into
 * human-readable output for the dev-genie init flow.
 *
 * Public API:
 *   formatReport(findings, opts?) -> string   // terminal-friendly text
 *   formatSummary(findings)        -> string  // single-paragraph summary
 *   toJSON(findings)               -> object  // structured for tooling
 *
 * Notes:
 *   - Findings with status 'present' are excluded from formatReport by
 *     default (set opts.includePresent=true to include them).
 *   - The "diff" emitted per finding is *declarative* — strings for eslint
 *     rules, JSON-Patch-style ops for tsconfig and scripts. The actual
 *     mutation logic lives in the apply flow (Wave 4 / T-0024); this module
 *     never mutates anything.
 *
 * This module is read-only — no filesystem writes.
 */

// ---- ANSI helpers ------------------------------------------------------

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
};

function makeColorize(useColor) {
  if (!useColor) {
    return (_code, s) => String(s);
  }
  return (code, s) => `${code}${s}${ANSI.reset}`;
}

// ---- severity / status badges -----------------------------------------

const SEVERITY_ORDER = ['critical', 'recommended', 'optional'];
const STATUS_ORDER = ['missing', 'weaker', 'conflicting', 'present'];

function statusBadge(status, c) {
  switch (status) {
    case 'missing':
      return c(ANSI.red, '[MISSING]');
    case 'weaker':
      return c(ANSI.yellow, '[WEAKER]');
    case 'conflicting':
      return c(ANSI.magenta, '[CONFLICT]');
    case 'present':
      return c(ANSI.green, '[OK]');
    default:
      return c(ANSI.gray, `[${String(status).toUpperCase()}]`);
  }
}

function severityHeader(severity, c) {
  switch (severity) {
    case 'critical':
      return c(ANSI.red + ANSI.bold, 'CRITICAL');
    case 'recommended':
      return c(ANSI.yellow + ANSI.bold, 'RECOMMENDED');
    case 'optional':
      return c(ANSI.blue + ANSI.bold, 'OPTIONAL');
    default:
      return c(ANSI.bold, String(severity).toUpperCase());
  }
}

// ---- rationale derivation ---------------------------------------------
// Hand-written rationales for the most impactful guard-rail rules; fall back
// to the finding's own `message` for everything else.
const RATIONALES = {
  'eslint:@typescript-eslint/no-explicit-any':
    'allows `any` to leak through the type system, defeating TS guarantees.',
  'eslint:@typescript-eslint/no-floating-promises':
    'unhandled promise rejections silently break async flows in production.',
  'eslint:@typescript-eslint/no-misused-promises':
    'passing a promise where a sync value is expected leads to subtle bugs.',
  'eslint:@typescript-eslint/consistent-type-imports':
    'separating type-only imports keeps build output and bundle size lean.',
  'eslint:@typescript-eslint/consistent-type-definitions':
    'a single style (interface vs type) keeps the codebase scannable.',
  'eslint:object-shorthand':
    'shorthand keeps objects compact and easier to read.',
  'eslint:prefer-template':
    'template strings beat string concatenation for readability.',
  'eslint:max-depth':
    'deep nesting is a reliable predictor of bugs and untestable code.',
  'eslint:max-params':
    'too many positional params suggest a missing object/struct boundary.',
  'eslint:complexity':
    'high cyclomatic complexity means the function has too many branches to test.',
  'tsconfig:strict':
    'turns on the full TS strictness suite — the single highest-leverage flag.',
  'tsconfig:noUncheckedIndexedAccess':
    'array/object index access becomes possibly-undefined, catching real bugs.',
  'tsconfig:exactOptionalPropertyTypes':
    'distinguishes "property absent" from "property = undefined".',
  'tsconfig:noImplicitOverride':
    'forces `override` keyword so refactors do not silently shadow base methods.',
  'enforcement:pre-commit':
    'pre-commit is the cheapest place to catch lint/type errors before they hit CI.',
  'enforcement:build':
    'failing the build on lint/type errors prevents broken artifacts shipping.',
  'enforcement:ci':
    'CI is the last line of defense; running lint+typecheck there is non-negotiable.',
  'scripts:lint': 'a `lint` script is the contract every other tool calls.',
  'scripts:typecheck': 'a `typecheck` script lets pre-commit and CI invoke TS uniformly.',
  'scripts:verify':
    'a single `verify` script (lint + typecheck + tests) is the canonical pre-push gate.',
  'scripts:prebuild':
    '`prebuild` running verify guarantees no broken build artifacts.',
};

function rationaleFor(finding) {
  const r = RATIONALES[finding.id];
  if (r) return r;
  // Category-level fallback when no specific rationale exists.
  switch (finding.category) {
    case 'eslint':
      return 'baseline guard-rail rule for this architecture.';
    case 'tsconfig':
      return 'baseline TS compiler option for this architecture.';
    case 'scripts':
      return 'baseline package.json script the init flow expects.';
    case 'enforcement':
      return 'baseline enforcement point for this architecture.';
    default:
      return finding.message || '';
  }
}

// ---- diff rendering ----------------------------------------------------

function describeEslintLevel(entry) {
  if (entry == null) return 'unset';
  const arr = Array.isArray(entry) ? entry : [entry];
  const head = arr[0];
  let level;
  if (typeof head === 'number') level = head === 2 ? 'error' : head === 1 ? 'warn' : 'off';
  else if (head === 'error' || head === 'warn' || head === 'off') level = head;
  else level = String(head);
  if (arr.length > 1) {
    return `${level} (+ ${arr.slice(1).map((o) => JSON.stringify(o)).join(', ')})`;
  }
  return level;
}

function eslintRuleLine(name, entry) {
  if (entry === undefined) return `  "${name}": <unset>`;
  return `  "${name}": ${JSON.stringify(entry)}`;
}

function buildDiff(finding) {
  if (finding.status === 'present') return null;

  switch (finding.category) {
    case 'eslint': {
      // String diff with - / + lines.
      const minus = eslintRuleLine(finding.key, finding.actual);
      const plus = eslintRuleLine(finding.key, finding.expected);
      return {
        kind: 'string',
        value: `- ${minus.trimStart()}\n+ ${plus.trimStart()}`,
      };
    }
    case 'tsconfig': {
      // JSON-Patch-style declarative ops.
      const ptr = `/compilerOptions/${finding.key}`;
      const ops =
        finding.status === 'missing'
          ? [{ op: 'add', path: ptr, value: finding.expected }]
          : [{ op: 'replace', path: ptr, value: finding.expected }];
      return { kind: 'json-patch', target: 'tsconfig.json', value: ops };
    }
    case 'scripts': {
      const ptr = `/scripts/${finding.key}`;
      const ops =
        finding.status === 'missing'
          ? [{ op: 'add', path: ptr, value: finding.expected }]
          : [{ op: 'replace', path: ptr, value: finding.expected }];
      return { kind: 'json-patch', target: 'package.json', value: ops };
    }
    case 'enforcement': {
      // Enforcement is wired by the apply flow (hooks, build chains, CI). We
      // emit a structured "ensure" intent rather than a literal patch.
      return {
        kind: 'ensure',
        value: {
          stage: finding.key,
          runs:
            (finding.expected && Array.isArray(finding.expected.runs) && finding.expected.runs) ||
            [],
          mechanism: (finding.expected && finding.expected.mechanism) || null,
        },
      };
    }
    default:
      return null;
  }
}

function renderDiffBlock(diff, c) {
  if (!diff) return '';
  if (diff.kind === 'string') {
    const lines = diff.value.split('\n').map((line) => {
      if (line.startsWith('-')) return c(ANSI.red, line);
      if (line.startsWith('+')) return c(ANSI.green, line);
      return line;
    });
    return lines.map((l) => `      ${l}`).join('\n');
  }
  if (diff.kind === 'json-patch') {
    const header = c(ANSI.dim, `      # JSON-Patch on ${diff.target}`);
    const body = JSON.stringify(diff.value, null, 2)
      .split('\n')
      .map((l) => `      ${c(ANSI.cyan, l)}`)
      .join('\n');
    return `${header}\n${body}`;
  }
  if (diff.kind === 'ensure') {
    const header = c(ANSI.dim, `      # ensure enforcement`);
    const body = JSON.stringify(diff.value, null, 2)
      .split('\n')
      .map((l) => `      ${c(ANSI.cyan, l)}`)
      .join('\n');
    return `${header}\n${body}`;
  }
  return '';
}

// ---- grouping / counting ----------------------------------------------

function groupBy(arr, keyFn) {
  const out = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

function counts(findings) {
  const byStatus = {};
  const bySeverity = {};
  const byCategory = {};
  for (const f of findings) {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }
  return { total: findings.length, byStatus, bySeverity, byCategory };
}

// ---- public API: formatReport -----------------------------------------

function formatReport(findings, opts) {
  const options = opts || {};
  const useColor =
    options.color !== undefined
      ? !!options.color
      : !!(process.stdout && process.stdout.isTTY);
  const includePresent = !!options.includePresent;
  const c = makeColorize(useColor);

  const filtered = includePresent
    ? findings
    : findings.filter((f) => f.status !== 'present');

  const lines = [];
  lines.push(c(ANSI.bold, 'dev-genie config report'));
  lines.push(c(ANSI.dim, '------------------------'));

  if (filtered.length === 0) {
    lines.push('');
    lines.push(c(ANSI.green, 'No gaps found — config matches baseline.'));
    lines.push('');
    // Summary counts what was rendered. With nothing rendered, we still show
    // the present-count for transparency.
    lines.push(formatSummaryCounts(filtered, c, { presentCount: findings.length - filtered.length }));
    return lines.join('\n');
  }

  const bySeverity = groupBy(filtered, (f) => f.severity);

  for (const sev of SEVERITY_ORDER) {
    const items = bySeverity.get(sev);
    if (!items || items.length === 0) continue;

    lines.push('');
    lines.push(`${severityHeader(sev, c)} ${c(ANSI.dim, `(${items.length})`)}`);
    lines.push(c(ANSI.dim, '-'.repeat(60)));

    const byCategory = groupBy(items, (f) => f.category);
    // Sort categories deterministically.
    const cats = Array.from(byCategory.keys()).sort();
    for (const cat of cats) {
      const catItems = byCategory.get(cat);
      lines.push('');
      lines.push(c(ANSI.bold + ANSI.cyan, `  ${cat}`) + c(ANSI.dim, ` (${catItems.length})`));
      // Sort within category by status order, then key.
      catItems.sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.status);
        const sb = STATUS_ORDER.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        return String(a.key).localeCompare(String(b.key));
      });
      for (const f of catItems) {
        const badge = statusBadge(f.status, c);
        const key = c(ANSI.bold, f.key);
        lines.push(`    ${badge} ${key}`);

        // current vs expected
        const actualStr =
          f.category === 'eslint'
            ? describeEslintLevel(f.actual)
            : f.actual === undefined
              ? '<unset>'
              : JSON.stringify(f.actual);
        const expectedStr =
          f.category === 'eslint'
            ? describeEslintLevel(f.expected)
            : JSON.stringify(f.expected);
        lines.push(
          `      ${c(ANSI.dim, 'current:')}  ${actualStr}`,
        );
        lines.push(
          `      ${c(ANSI.dim, 'expected:')} ${expectedStr}`,
        );

        // rationale
        lines.push(`      ${c(ANSI.dim, 'why:')}      ${rationaleFor(f)}`);

        // diff
        const diff = buildDiff(f);
        const block = renderDiffBlock(diff, c);
        if (block) {
          lines.push(`      ${c(ANSI.dim, 'change:')}`);
          lines.push(block);
        }
      }
    }
  }

  lines.push('');
  // Summary counts only what was rendered (i.e. matches the per-group counts
  // above). The "present" count from the unfiltered list is shown separately
  // so it's clear how many findings were skipped from the body.
  lines.push(
    formatSummaryCounts(filtered, c, { presentCount: findings.length - filtered.length }),
  );
  return lines.join('\n');
}

function formatSummaryCounts(findings, c, opts) {
  const ct = counts(findings);
  const sev = ct.bySeverity || {};
  const st = ct.byStatus || {};
  const presentCount = (opts && opts.presentCount != null) ? opts.presentCount : (st.present || 0);
  const parts = [
    `${c(ANSI.bold, 'Summary:')} ${ct.total} gap${ct.total === 1 ? '' : 's'}`,
    `${c(ANSI.red, `${sev.critical || 0} critical`)}`,
    `${c(ANSI.yellow, `${sev.recommended || 0} recommended`)}`,
    `${c(ANSI.blue, `${sev.optional || 0} optional`)}`,
    `${c(ANSI.dim, `(missing=${st.missing || 0}, weaker=${st.weaker || 0}, conflicting=${st.conflicting || 0}, present=${presentCount})`)}`,
  ];
  return parts.join(' | ');
}

// ---- public API: formatSummary ----------------------------------------

function formatSummary(findings) {
  // Single paragraph; no color (this is meant to be embedded in other output).
  // Counts only non-present findings for the headline; mentions categories
  // touched by those findings.
  const gaps = findings.filter((f) => f.status !== 'present');
  if (gaps.length === 0) {
    return 'No gaps: detected config matches baseline.';
  }
  const ct = counts(gaps);
  const sev = ct.bySeverity || {};
  const cats = Object.keys(ct.byCategory || {}).sort();
  const sevParts = [];
  if (sev.critical) sevParts.push(`${sev.critical} critical`);
  if (sev.recommended) sevParts.push(`${sev.recommended} recommended`);
  if (sev.optional) sevParts.push(`${sev.optional} optional`);
  const sevStr = sevParts.join(', ');
  const catStr = cats.length ? cats.join(', ') : 'unknown';
  return `${sevStr} findings across ${catStr}.`;
}

// ---- public API: toJSON ------------------------------------------------

function toJSON(findings) {
  const summary = counts(findings);
  const groups = [];
  const bySeverity = groupBy(findings, (f) => f.severity);
  for (const sev of SEVERITY_ORDER) {
    const items = bySeverity.get(sev) || [];
    if (items.length === 0) continue;
    const byCategory = groupBy(items, (f) => f.category);
    const catGroups = [];
    const cats = Array.from(byCategory.keys()).sort();
    for (const cat of cats) {
      const catItems = byCategory.get(cat).slice().sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.status);
        const sb = STATUS_ORDER.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        return String(a.key).localeCompare(String(b.key));
      });
      catGroups.push({
        category: cat,
        count: catItems.length,
        findings: catItems.map((f) => ({
          ...f,
          rationale: rationaleFor(f),
          diff: buildDiff(f),
        })),
      });
    }
    groups.push({
      severity: sev,
      count: items.length,
      categories: catGroups,
    });
  }
  return { summary, groups };
}

module.exports = { formatReport, formatSummary, toJSON };

// ---- Smoke test --------------------------------------------------------
// node dev-genie/lib/report.js
if (require.main === module) {
  const path = require('node:path');
  const { compareConfig } = require('./compare-config.js');

  (async () => {
    const repoRoot = path.resolve(__dirname, '../..');
    process.stdout.write(`Running comparator on ${repoRoot}\n`);
    let findings = [];
    try {
      const res = await compareConfig({ archId: 'node-api', repoPath: repoRoot });
      findings = res.findings;
    } catch (err) {
      process.stderr.write(`compareConfig failed: ${err.message}\n`);
      process.exit(1);
    }

    process.stdout.write('\n--- formatSummary ---\n');
    process.stdout.write(formatSummary(findings) + '\n');

    process.stdout.write('\n--- formatReport ---\n');
    process.stdout.write(formatReport(findings) + '\n');

    process.stdout.write('\n--- toJSON (top-level summary) ---\n');
    const j = toJSON(findings);
    process.stdout.write(JSON.stringify(j.summary, null, 2) + '\n');
    process.stdout.write(`groups: ${j.groups.length} (severities: ${j.groups.map((g) => `${g.severity}=${g.count}`).join(', ')})\n`);
  })().catch((err) => {
    process.stderr.write(String((err && err.stack) || err) + '\n');
    process.exit(1);
  });
}
