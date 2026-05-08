#!/usr/bin/env node
/**
 * dev-genie-init
 *
 * Thin entry script that wires the dev-genie modules into the
 * `/dev-genie-init` command flow. Two paths:
 *
 *   - greenfield: detectConfig reports no eslint/tsconfig/scripts/hooks. We
 *     emit a hint pointing the agent at the orchestration registry / scaffold
 *     command. (The interactive scaffold is driven by the slash command, not
 *     this script.)
 *
 *   - existing-repo: at least one of eslint/tsconfig/scripts/hooks is found.
 *     Run detect → classify → compareConfig → formatReport → applyFindings.
 *
 * Usage:
 *   node dev-genie/bin/dev-genie-init.mjs [--repo PATH] [--arch ID] [--mode MODE] [--dry-run] [--json]
 *
 *   --repo PATH   target repo (default: cwd)
 *   --arch ID     force architecture id (skip prompt). One of:
 *                   node-api | react-next-vercel-webapp | supabase-api | supabase-node-rag
 *   --mode MODE   apply mode: dry-run | auto-critical | interactive | apply-all | quit
 *                 (default: prompt). With --dry-run flag, forced to dry-run.
 *   --dry-run     force mode=dry-run regardless of --mode
 *   --json        emit a final JSON summary line on stdout
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const require = createRequire(import.meta.url);

const { detectConfig } = require('../skills/project-detection/detect-config.js');
const { compareConfig } = require('../lib/compare-config.js');
const { formatReport, formatSummary, toJSON } = require('../lib/report.js');
const { applyFindings } = require('../lib/apply-flow.js');
const { saveLastRun, loadLastRun, ensureGitignore, diffPlan } = require('../lib/plan-store.js');
const { listArchitectures } = await import('../baselines/index.mjs');

const VALID_MODES = new Set(['dry-run', 'auto-critical', 'interactive', 'apply-all', 'quit']);
const VALID_ARCHS = new Set(['node-api', 'react-next-vercel-webapp', 'supabase-api', 'supabase-node-rag']);

function parseArgs(argv) {
  const args = { repo: process.cwd(), arch: null, mode: null, dryRun: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a === '--arch') args.arch = argv[++i];
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${a}\n`);
      printHelp();
      process.exit(2);
    }
  }
  args.repo = path.resolve(args.repo);
  if (args.arch && !VALID_ARCHS.has(args.arch)) {
    process.stderr.write(`invalid --arch "${args.arch}". Known: ${[...VALID_ARCHS].join(', ')}\n`);
    process.exit(2);
  }
  if (args.mode && !VALID_MODES.has(args.mode)) {
    process.stderr.write(`invalid --mode "${args.mode}". Known: ${[...VALID_MODES].join(', ')}\n`);
    process.exit(2);
  }
  if (args.dryRun) args.mode = 'dry-run';
  return args;
}

function printHelp() {
  process.stdout.write(
    `Usage: dev-genie-init [--repo PATH] [--arch ID] [--mode MODE] [--dry-run] [--json]\n` +
      `  --arch  ${[...VALID_ARCHS].join(' | ')}\n` +
      `  --mode  ${[...VALID_MODES].join(' | ')}\n`,
  );
}

function isGreenfield(detected) {
  // Greenfield = none of the actionable categories found.
  return (
    !detected.eslint.found &&
    !detected.typescript.found &&
    !detected.scripts.found &&
    !detected.hooks.found &&
    !detected.hasPackageJson
  );
}

function suggestArch(detected) {
  const repo = detected.repoPath;
  const fs = require('node:fs');
  // Try classification using the project-detection signals.
  const has = (rel) => {
    try { fs.accessSync(path.join(repo, rel)); return true; } catch { return false; }
  };
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')); } catch {}
  const deps = {
    ...(pkg && pkg.dependencies) || {},
    ...(pkg && pkg.devDependencies) || {},
  };
  const isNext = has('next.config.js') || has('next.config.mjs') || has('next.config.ts') || 'next' in deps;
  const hasSupabase = has('supabase');
  const ragHint = 'pgvector' in deps || /rag/i.test(path.basename(repo));
  if (isNext) return { archId: 'react-next-vercel-webapp', confidence: 'high' };
  if (hasSupabase && ragHint) return { archId: 'supabase-node-rag', confidence: 'medium' };
  if (hasSupabase) return { archId: 'supabase-api', confidence: 'medium' };
  if (pkg) return { archId: 'node-api', confidence: 'medium' };
  return { archId: null, confidence: 'n/a' };
}

async function promptChoice(rl, label, choices, fallbackIndex = 0) {
  const list = choices.map((c, i) => `  ${i + 1}) ${c}`).join('\n');
  const ans = (await rl.question(`${label}\n${list}\nChoose [1-${choices.length}] (default ${fallbackIndex + 1}): `)).trim();
  if (!ans) return choices[fallbackIndex];
  const n = Number(ans);
  if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1];
  // accept by name
  if (choices.includes(ans)) return ans;
  return choices[fallbackIndex];
}

async function resolveArch({ argArch, detected, rl }) {
  if (argArch) return argArch;
  const suggestion = suggestArch(detected);
  if (suggestion.archId && suggestion.confidence === 'high') {
    return suggestion.archId;
  }
  const archs = listArchitectures().map((a) => a.id);
  if (!rl) {
    // Non-interactive: fall back to the suggestion (any confidence) or node-api.
    const fallback = suggestion.archId || 'node-api';
    process.stdout.write(`[dev-genie] no TTY; using inferred arch "${fallback}" (${suggestion.confidence}).\n`);
    return fallback;
  }
  const fallback = suggestion.archId
    ? Math.max(0, archs.indexOf(suggestion.archId))
    : 0;
  const label =
    suggestion.archId
      ? `Architecture suggestion: ${suggestion.archId} (${suggestion.confidence}). Pick one:`
      : 'Architecture could not be inferred. Pick one:';
  return promptChoice(rl, label, archs, fallback);
}

async function promptMode(rl) {
  const modes = ['dry-run', 'auto-critical', 'interactive', 'apply-all', 'quit'];
  const choice = await promptChoice(
    rl,
    'Apply mode:',
    modes,
    0,
  );
  return choice;
}

async function main() {
  const args = parseArgs(process.argv);

  process.stdout.write(`[dev-genie] target repo: ${args.repo}\n`);
  const detected = detectConfig(args.repo);

  if (isGreenfield(detected)) {
    process.stdout.write(
      `[dev-genie] greenfield repo detected (no package.json / eslint / tsconfig / scripts / hooks).\n` +
        `Run the /dev-genie-init slash command and follow the orchestration flow:\n` +
        `  1) /scaffold-architecture <pattern>   (one of: ${[...VALID_ARCHS].join(', ')})\n` +
        `  2) /audit-init\n` +
        `This bin script handles the existing-repo branch only.\n`,
    );
    if (args.json) {
      process.stdout.write(JSON.stringify({ branch: 'greenfield', detected }) + '\n');
    }
    return;
  }

  process.stdout.write(`[dev-genie] existing-repo branch: detected eslint=${detected.eslint.found} ts=${detected.typescript.found} scripts=${detected.scripts.found} hooks=${detected.hooks.found}\n`);

  const rl = (!args.arch || !args.mode) && process.stdin.isTTY
    ? readline.createInterface({ input, output })
    : null;

  let archId;
  try {
    archId = await resolveArch({ argArch: args.arch, detected, rl });
  } catch (e) {
    if (rl) rl.close();
    throw e;
  }
  process.stdout.write(`[dev-genie] using architecture: ${archId}\n`);

  const { findings } = await compareConfig({ archId, repoPath: args.repo, detected });

  // Enrich findings with `diff` (required by apply-flow) by walking toJSON.
  const enrichedById = new Map();
  for (const g of toJSON(findings).groups) {
    for (const cat of g.categories) {
      for (const f of cat.findings) enrichedById.set(f.id, f);
    }
  }
  const enriched = findings.map((f) => enrichedById.get(f.id) || f);

  // Idempotent re-run: load prior plan and annotate which findings are new.
  const lastRun = loadLastRun(args.repo);
  if (lastRun) {
    const { newFindings, unchanged } = diffPlan(enriched, lastRun);
    process.stdout.write(
      `[dev-genie] prior run found at .dev-genie/init.last-run.json (${lastRun.timestamp}); ` +
        `${newFindings.length} new finding(s), ${unchanged.length} unchanged.\n`,
    );
  }

  process.stdout.write('\n' + formatReport(enriched) + '\n');
  process.stdout.write('\n' + formatSummary(enriched) + '\n');

  let mode = args.mode;
  if (!mode) {
    if (rl) {
      mode = await promptMode(rl);
    } else {
      mode = 'dry-run';
      process.stdout.write(`[dev-genie] no TTY and no --mode given; defaulting to dry-run.\n`);
    }
  }
  if (rl) rl.close();

  if (mode === 'quit') {
    process.stdout.write('[dev-genie] quit requested; no changes applied.\n');
    if (args.json) process.stdout.write(JSON.stringify({ branch: 'existing', archId, mode, applied: [], skipped: [], errors: [] }) + '\n');
    return;
  }

  const result = await applyFindings({ repoPath: args.repo, archId, findings: enriched, mode });
  process.stdout.write(
    `\n[dev-genie] DONE — applied=${result.applied.length} skipped=${result.skipped.length} errors=${result.errors.length}\n`,
  );
  if (result.errors.length) {
    for (const e of result.errors) process.stdout.write(`  ERROR ${e.id}: ${e.message}\n`);
  }

  // Persist the resolved plan so re-runs can prompt only on real changes.
  // Skip writing on dry-run unless explicitly requested (out of scope for now).
  if (mode !== 'dry-run') {
    try {
      ensureGitignore(args.repo);
      saveLastRun(args.repo, { plan: enriched, applied: result.applied, skipped: result.skipped, errors: result.errors, extra: { archId, mode } });
      process.stdout.write('[dev-genie] wrote .dev-genie/init.last-run.json\n');
    } catch (e) {
      process.stdout.write(`[dev-genie] warning: could not write last-run.json: ${e.message}\n`);
    }
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ branch: 'existing', archId, mode, ...result }) + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err) + '\n');
  process.exit(1);
});
