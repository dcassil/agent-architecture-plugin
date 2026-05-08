#!/usr/bin/env node
// audit/scripts/audit.mjs
//
// Audit plugin entry point. Invoked by:
//   - the pre-commit hook (with --no-update): scan + compare + block, never write
//   - /audit-run + /audit-init (with --update): scan + compare + WRITE results
//
// Exit codes:
//   0 - pass / baseline written
//   1 - regression block
//   2 - internal/config error

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { scan } from './lib/scanner.mjs';
import { computeComposites } from './lib/composite.mjs';

const COMPOSITES = ['architecture', 'maintainability', 'testability', 'health'];

function findRepoRoot(start = process.cwd()) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd: start }).toString().trim();
  } catch {
    return start;
  }
}

function parseArgs(argv) {
  const a = { update: false, noUpdate: false, repoRoot: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--update') a.update = true;
    else if (argv[i] === '--no-update') a.noUpdate = true;
    else if (argv[i] === '--repo' && argv[i + 1]) a.repoRoot = argv[++i];
  }
  return a;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err2(`audit: failed to parse ${path}: ${e.message}`);
  }
}

function atomicWriteJson(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}

function err2(msg) {
  console.error(msg);
  process.exit(2);
}

/**
 * Compare current vs previous composites and produce a verdict.
 * Pure function — exported for testing.
 */
export function evaluate({ current, previous, config }) {
  const threshold = Number(config?.regressionThreshold ?? 5);
  const requireImprovement = !!config?.requireImprovement;

  if (!previous) {
    return { ok: true, baseline: true, blocks: [] };
  }

  const blocks = [];
  for (const c of COMPOSITES) {
    const oldS = Number(previous.composites?.[c]);
    const newS = Number(current.composites[c]);
    if (!Number.isFinite(oldS)) continue;
    const delta = newS - oldS;

    if (delta < -threshold) {
      blocks.push({ composite: c, old: oldS, new: newS, delta, reason: 'regression' });
    } else if (requireImprovement && delta <= 0) {
      blocks.push({ composite: c, old: oldS, new: newS, delta, reason: 'requireImprovement' });
    }
  }
  return { ok: blocks.length === 0, baseline: false, blocks };
}

function formatBlock(b, current, previous) {
  const dom = current.dominant?.[b.composite];
  const oldRaw = previous?.scanMetrics?.[dom];
  const newRaw = current.scanMetrics?.[dom];
  const sign = b.delta >= 0 ? '+' : '';
  const head = b.reason === 'requireImprovement'
    ? `audit: BLOCKED — ${b.composite} did not improve ${b.old.toFixed(1)} -> ${b.new.toFixed(1)} (${sign}${b.delta.toFixed(1)}) [requireImprovement]`
    : `audit: BLOCKED — ${b.composite} dropped ${b.old.toFixed(1)} -> ${b.new.toFixed(1)} (${sign}${b.delta.toFixed(1)}).`;
  const tail = (dom && Number.isFinite(oldRaw) && Number.isFinite(newRaw))
    ? ` Dominant metric: ${dom} ${fmt(oldRaw)} -> ${fmt(newRaw)}.`
    : (dom ? ` Dominant metric: ${dom}.` : '');
  return head + tail;
}

function fmt(n) {
  if (!Number.isFinite(n)) return String(n);
  return Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args.repoRoot || findRepoRoot());
  const auditDir = resolve(repoRoot, '.audit');
  const configPath  = resolve(auditDir, 'audit.config.json');
  const resultsPath = resolve(auditDir, 'audit.results.json');

  const config = loadJson(configPath);
  if (!config) err2(`audit: missing ${configPath}. Run /audit-init.`);
  if (!config.baselines) err2('audit: config.baselines missing. Run /audit-init.');

  let scanMetrics;
  try {
    scanMetrics = await scan(repoRoot);
  } catch (e) {
    if (e.code === 'AUDIT_BIN_MISSING') err2(e.message);
    err2(`audit: scan failed: ${e.message}`);
  }

  const composites = computeComposites(scanMetrics, config.baselines);
  const current = {
    timestamp: new Date().toISOString(),
    composites: {
      architecture:    composites.architecture,
      maintainability: composites.maintainability,
      testability:     composites.testability,
      health:          composites.health,
    },
    dominant: composites.dominant,
    contributions: composites.contributions,
    scaleByLOC: composites.scaleByLOC,
    scanMetrics,
  };

  const previous = loadJson(resultsPath);
  const verdict = evaluate({ current, previous, config });

  if (verdict.baseline) {
    if (!args.noUpdate) {
      atomicWriteJson(resultsPath, current);
      console.log(`audit: baseline established. health=${current.composites.health} architecture=${current.composites.architecture} maintainability=${current.composites.maintainability} testability=${current.composites.testability}`);
    } else {
      console.log('audit: no baseline yet — run with --update (or /audit-init) to create one.');
    }
    process.exit(0);
  }

  if (!verdict.ok) {
    for (const b of verdict.blocks) {
      console.error(formatBlock(b, current, previous));
    }
    process.exit(1);
  }

  // Pass.
  if (args.update) {
    atomicWriteJson(resultsPath, current);
    console.log(`audit: pass + baseline updated. health=${current.composites.health} (was ${previous.composites.health})`);
  } else {
    console.log(`audit: pass. health=${current.composites.health} architecture=${current.composites.architecture} maintainability=${current.composites.maintainability} testability=${current.composites.testability}`);
  }
  process.exit(0);
}

// Run main only when invoked as entry point, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => err2(`audit: ${e.stack || e.message}`));
}
