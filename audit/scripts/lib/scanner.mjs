// audit/scripts/lib/scanner.mjs
//
// Scan a repo with dependency-cruiser + scc, reduce both into a normalized
// ScanMetrics object suitable for computeComposites() in composite.mjs.
//
// Plain Node ESM, zero npm deps (uses node:child_process).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileP = promisify(execFile);

// Conservative default: app source roots only. Plugin/tooling dirs (audit/,
// guardrails/, dev-genie/, scripts/) are intentionally excluded — they're
// vendored infrastructure, not the host repo's product code, and including
// them dilutes the composite scores. Configure `srcGlobs` in
// .audit/audit.config.json to override per-architecture (e.g. ["app","lib"]
// for Next.js, ["supabase/functions"] for Supabase Edge).
const DEFAULT_SRC = ['src', 'lib', 'app'];

/**
 * @param {string} repoRoot - absolute path to the host repo
 * @param {{srcGlobs?: string[], depcruiseBin?: string, sccBin?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{
 *   cycles:number, depth:number, roots:number, avgLoc:number, p90Loc:number,
 *   edges:number, orphan:number, fan:number, avgComplexity:number, maxComplexity:number,
 *   circularRate:number, totalLoc:number, _meta: object
 * }>}
 */
export async function scan(repoRoot, opts = {}) {
  const root = resolve(repoRoot);
  const depcruiseBin = opts.depcruiseBin || (await whichOrThrow('depcruise', 'dependency-cruiser'));
  const sccBin       = opts.sccBin       || (await whichOrThrow('scc', 'scc'));

  const srcGlobs = opts.srcGlobs && opts.srcGlobs.length
    ? opts.srcGlobs
    : await pickExistingDirs(root, DEFAULT_SRC);

  if (srcGlobs.length === 0) {
    // Fall back to the whole repo root.
    srcGlobs.push('.');
  }

  const t0 = Date.now();
  const [dc, sc] = await Promise.all([
    runDepcruise(depcruiseBin, root, srcGlobs, opts.timeoutMs ?? 120_000),
    runScc(sccBin, root, srcGlobs, opts.timeoutMs ?? 60_000),
  ]);
  const wallMs = Date.now() - t0;

  const metrics = reduce(dc, sc);
  metrics._meta = {
    wallMs,
    srcGlobs,
    depcruiseBin,
    sccBin,
  };
  return metrics;
}

// ----- binary location -----

async function whichOrThrow(short, hintName) {
  try {
    const { stdout } = await execFileP('which', [short]);
    const path = stdout.trim();
    if (!path) throw new Error('not found');
    return path;
  } catch {
    const err = new Error(
      `audit: ${hintName} not found, run audit-init (or install via: npm i -g ${hintName === 'scc' ? 'scc / brew install scc' : 'dependency-cruiser'})`
    );
    err.code = 'AUDIT_BIN_MISSING';
    throw err;
  }
}

async function pickExistingDirs(root, candidates) {
  const fs = await import('node:fs/promises');
  const exists = [];
  for (const c of candidates) {
    try {
      const st = await fs.stat(resolve(root, c));
      if (st.isDirectory()) exists.push(c);
    } catch { /* skip */ }
  }
  return exists;
}

// ----- runners -----

async function runDepcruise(bin, cwd, globs, timeoutMs) {
  const args = [
    '--output-type', 'json',
    '--no-config',
    '--metrics',
    '--ts-pre-compilation-deps',
    ...globs,
  ];
  let stdout = '';
  try {
    const r = await execFileP(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
    stdout = r.stdout;
  } catch (e) {
    // depcruise exits non-zero when it finds violations. JSON still on stdout.
    if (e.stdout) stdout = e.stdout;
    else throw new Error(`audit: depcruise failed: ${e.message}`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error('audit: depcruise produced non-JSON output');
  }
}

async function runScc(bin, cwd, paths, timeoutMs) {
  // --by-file emits per-file entries (with `Complexity`) inside each language summary.
  // We need them so the reducer can compute avg/max cyclomatic complexity — scc's
  // language-level totals don't preserve the per-file distribution we need for max.
  // Scope scc to the same paths as depcruise so both metric sources see the same code.
  const args = ['--by-file', '--format', 'json', ...(paths && paths.length ? paths : ['.'])];
  const { stdout } = await execFileP(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error('audit: scc produced non-JSON output');
  }
}

// ----- reducer -----

/**
 * Reduce raw depcruise + scc outputs into the ScanMetrics shape.
 * Keep this pure / testable from fixtures.
 */
export function reduce(dc, sc) {
  const modules = Array.isArray(dc?.modules) ? dc.modules : [];
  const totalModules = Math.max(1, modules.length);

  // Edges + fan-in/out
  let totalEdges = 0;
  let maxFanOut = 0;
  const fanInMap = new Map();
  let modulesInCycles = 0;
  for (const m of modules) {
    const deps = Array.isArray(m.dependencies) ? m.dependencies : [];
    totalEdges += deps.length;
    if (deps.length > maxFanOut) maxFanOut = deps.length;
    let inCycle = false;
    for (const d of deps) {
      if (d.resolved) {
        fanInMap.set(d.resolved, (fanInMap.get(d.resolved) || 0) + 1);
      }
      if (Array.isArray(d.cycle) && d.cycle.length > 0) inCycle = true;
      if (d.circular === true) inCycle = true;
    }
    if (inCycle) modulesInCycles += 1;
  }
  let maxFanIn = 0;
  for (const v of fanInMap.values()) if (v > maxFanIn) maxFanIn = v;

  // Roots = modules with zero fan-in (no one imports them) AND non-zero fan-out OR the entry layer.
  // Use depcruise's per-module dependents if present; else compute from fanInMap.
  let totalRoots = 0;
  for (const m of modules) {
    const deps = Array.isArray(m.dependents) ? m.dependents.length : (fanInMap.get(m.source) || 0);
    if (deps === 0) totalRoots += 1;
  }

  // Orphans = modules with no deps and no dependents
  let totalOrphans = 0;
  for (const m of modules) {
    const out = Array.isArray(m.dependencies) ? m.dependencies.length : 0;
    const inn = Array.isArray(m.dependents) ? m.dependents.length : (fanInMap.get(m.source) || 0);
    if (out === 0 && inn === 0) totalOrphans += 1;
  }

  // Depth: depcruise summary.totalCruised + per-module .reaches; fall back to summary if available.
  let maxDepth = 0;
  for (const m of modules) {
    if (typeof m.dependencyDepth === 'number' && m.dependencyDepth > maxDepth) {
      maxDepth = m.dependencyDepth;
    }
    // depcruise --metrics emits "instability" + similar; depth often surfaces as `transitiveDependencies`
    if (Array.isArray(m.reaches)) {
      // length isn't depth, but the longest-chain proxy from depcruise is `--max-depth`. We approximate.
      if (m.reaches.length > maxDepth) maxDepth = Math.min(m.reaches.length, 50);
    }
  }
  // Safety floor — at least 1 if we have modules.
  if (modules.length > 0 && maxDepth === 0) maxDepth = 1;

  // LOC + complexity from scc (--by-file). scc's per-file `Complexity` is a
  // language-agnostic heuristic, not a true CFG-based McCabe number, but it's
  // good enough as a directional signal and works for every language scc supports.
  const langs = Array.isArray(sc) ? sc : (sc?.languageSummary || []);
  let totalLoc = 0;
  let totalFiles = 0;
  const perFileLoc = [];
  const perFileComplexity = [];
  for (const lang of langs) {
    totalLoc += Number(lang.Code || lang.code || 0);
    totalFiles += Number(lang.Count || lang.count || 0);
    const files = Array.isArray(lang.Files) ? lang.Files : (Array.isArray(lang.files) ? lang.files : []);
    for (const f of files) {
      const c = Number(f.Code ?? f.code ?? 0);
      if (c > 0) perFileLoc.push(c);
      const cx = f.Complexity ?? f.complexity;
      if (cx != null && Number.isFinite(Number(cx))) perFileComplexity.push(Number(cx));
    }
  }

  // Prefer scc per-file complexity (real signal). Fall back to depcruise per-module
  // complexity if scc didn't surface any (older scc, or fixtures without Complexity).
  let avgComplexity = 0;
  let maxComplexity = 0;
  if (perFileComplexity.length) {
    avgComplexity = sum(perFileComplexity) / perFileComplexity.length;
    maxComplexity = Math.max(...perFileComplexity);
  } else {
    const dcCx = [];
    for (const m of modules) {
      const cx =
        typeof m.complexity === 'number' ? m.complexity :
        typeof m?.metrics?.cyclomaticComplexity === 'number' ? m.metrics.cyclomaticComplexity :
        null;
      if (cx != null && Number.isFinite(cx)) dcCx.push(cx);
    }
    avgComplexity = dcCx.length ? sum(dcCx) / dcCx.length : 0;
    maxComplexity = dcCx.length ? Math.max(...dcCx) : 0;
  }
  if (perFileLoc.length === 0 && totalFiles > 0) {
    // No per-file detail; approximate distribution as uniform.
    const avg = totalLoc / totalFiles;
    for (let i = 0; i < totalFiles; i++) perFileLoc.push(avg);
  }
  perFileLoc.sort((a, b) => a - b);
  const avgLocPerFile = perFileLoc.length ? sum(perFileLoc) / perFileLoc.length : 0;
  const p90Loc = percentile(perFileLoc, 0.90);

  // Per-module avg LOC: distribute total LOC over module count
  const avgLocPerModule = totalLoc / totalModules;

  // Final ScanMetrics shape consumed by computeComposites
  return {
    cycles:        modulesInCycles / totalModules,         // cyclesPerModule
    depth:         maxDepth,
    roots:         totalRoots / totalModules,              // rootsPerModule (higher = better)
    avgLoc:        round2(avgLocPerModule),
    p90Loc:        round2(p90Loc),
    edges:         totalEdges / totalModules,
    orphan:        totalOrphans / totalModules,
    fan:           maxFanIn + maxFanOut,
    avgComplexity: round2(avgComplexity),
    maxComplexity: maxComplexity,
    circularRate:  modulesInCycles / totalModules,
    totalLoc:      totalLoc,
  };
}

function sum(a) { let s = 0; for (const x of a) s += x; return s; }
function round2(x) { return Math.round(x * 100) / 100; }

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}
