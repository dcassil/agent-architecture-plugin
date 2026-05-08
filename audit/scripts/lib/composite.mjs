// audit/scripts/lib/composite.mjs
//
// Composite scoring calculator for the audit plugin.
// Ported from ../code-audit/packages/scoring/src/calculator.ts (and scoringFns.ts).
// Plain ES module, zero dependencies, Node 18+.
//
// ScanMetrics shape (JSDoc):
// @typedef {Object} ScanMetrics
// @property {number} cycles          - circular dependency rate (cyclesPerModule)
// @property {number} depth           - max dependency depth
// @property {number} roots           - root-module ratio (rootsPerModule)
// @property {number} avgLoc          - average LOC per module
// @property {number} p90Loc          - 90th percentile LOC per file
// @property {number} edges           - edges per module
// @property {number} orphan          - orphan-module ratio
// @property {number} fan             - max fan-in + max fan-out
// @property {number} avgComplexity   - average cyclomatic complexity
// @property {number} maxComplexity   - max cyclomatic complexity
// @property {number} circularRate    - modules-in-cycles / total modules
// @property {number} totalLoc        - total lines of code

// Baselines: { metricKey: { good, bad } }. "good" is the value at which the
// raw metric scores 100; "bad" is the value at which it scores 0. Linear interp
// between, clamped at the edges.
//
// computeComposites() expects baselines for: cycles, depth, roots, avgLoc,
// p90Loc, edges, orphan, fan, avgComplexity, maxComplexity, circularRate.

// ----- scoring primitives (mirror scoringFns.ts) -----

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** Lower raw value -> higher score. */
export function scoreLowerBetter(value, good, bad) {
  if (bad <= good) return 0;
  const t = (value - good) / (bad - good);
  return Math.round((1 - clamp01(t)) * 10000) / 100;
}

/** Higher raw value -> higher score. */
export function scoreHigherBetter(value, bad, good) {
  if (good <= bad) return 0;
  const t = (value - bad) / (good - bad);
  return Math.round(clamp01(t) * 10000) / 100;
}

/** Log-scaled bonus on totalLoc — small repos score 100, large repos decline. */
export function scoreScaleByLOC(loc) {
  if (loc <= 5_000) return 100;
  if (loc >= 150_000) return 20;
  const lo = Math.log10(5_000);
  const hi = Math.log10(150_000);
  const x = Math.log10(Math.max(1, loc));
  const t = clamp01((x - lo) / (hi - lo));
  const score = 100 - t * 80;
  return Math.round(score * 100) / 100;
}

function bl(baselines, key) {
  const b = baselines && baselines[key];
  return b ? { good: b.good, bad: b.bad } : { good: 0, bad: 1 };
}

// ----- composite weights (calculator.ts lines 19, 42, 69, 92-93) -----

export const WEIGHTS = Object.freeze({
  // architecture: line 19 of calculator.ts
  architecture: { cycles: 0.40, depth: 0.35, roots: 0.25 },
  // maintainability: line 42
  maintainability: { avgLoc: 0.35, p90Loc: 0.35, edges: 0.25, orphan: 0.05 },
  // testability: line 69
  testability: { fan: 0.30, avgComplexity: 0.25, maxComplexity: 0.20, circularRate: 0.15, depth: 0.10 },
  // health: lines 92-93
  health: { architecture: 0.30, maintainability: 0.30, testability: 0.30, scaleByLOC: 0.10 },
});

// ----- main entry point -----

/**
 * Compute composite scores from a ScanMetrics input.
 * @param {ScanMetrics} scan
 * @param {Object} baselines - { metricKey: {good, bad} }
 * @returns {{
 *   architecture: number, maintainability: number, testability: number, health: number,
 *   contributions: Object<string, Object<string, number>>,
 *   dominant: { architecture: string, maintainability: string, testability: string, health: string }
 * }}
 */
export function computeComposites(scan, baselines) {
  // Normalize each raw metric to 0-100.
  const sCycles        = scoreLowerBetter(scan.cycles,        bl(baselines, 'cycles').good,        bl(baselines, 'cycles').bad);
  const sDepth         = scoreLowerBetter(scan.depth,         bl(baselines, 'depth').good,         bl(baselines, 'depth').bad);
  const sRoots         = scoreHigherBetter(scan.roots,        bl(baselines, 'roots').bad,          bl(baselines, 'roots').good);
  const sAvgLoc        = scoreLowerBetter(scan.avgLoc,        bl(baselines, 'avgLoc').good,        bl(baselines, 'avgLoc').bad);
  const sP90Loc        = scoreLowerBetter(scan.p90Loc,        bl(baselines, 'p90Loc').good,        bl(baselines, 'p90Loc').bad);
  const sEdges         = scoreLowerBetter(scan.edges,         bl(baselines, 'edges').good,         bl(baselines, 'edges').bad);
  const sOrphan        = scoreLowerBetter(scan.orphan,        bl(baselines, 'orphan').good,        bl(baselines, 'orphan').bad);
  const sFan           = scoreLowerBetter(scan.fan,           bl(baselines, 'fan').good,           bl(baselines, 'fan').bad);
  const sAvgCx         = scoreLowerBetter(scan.avgComplexity, bl(baselines, 'avgComplexity').good, bl(baselines, 'avgComplexity').bad);
  const sMaxCx         = scoreLowerBetter(scan.maxComplexity, bl(baselines, 'maxComplexity').good, bl(baselines, 'maxComplexity').bad);
  const sCirc          = scoreLowerBetter(scan.circularRate,  bl(baselines, 'circularRate').good,  bl(baselines, 'circularRate').bad);
  const scaleByLOC     = scoreScaleByLOC(scan.totalLoc);

  const W = WEIGHTS;

  const contributions = {
    architecture:    { cycles: sCycles, depth: sDepth, roots: sRoots },
    maintainability: { avgLoc: sAvgLoc, p90Loc: sP90Loc, edges: sEdges, orphan: sOrphan },
    testability:    { fan: sFan, avgComplexity: sAvgCx, maxComplexity: sMaxCx, circularRate: sCirc, depth: sDepth },
  };

  const architecture = round2(
    W.architecture.cycles * sCycles +
    W.architecture.depth  * sDepth  +
    W.architecture.roots  * sRoots
  );
  const maintainability = round2(
    W.maintainability.avgLoc * sAvgLoc +
    W.maintainability.p90Loc * sP90Loc +
    W.maintainability.edges  * sEdges  +
    W.maintainability.orphan * sOrphan
  );
  const testability = round2(
    W.testability.fan           * sFan   +
    W.testability.avgComplexity * sAvgCx +
    W.testability.maxComplexity * sMaxCx +
    W.testability.circularRate  * sCirc  +
    W.testability.depth         * sDepth
  );
  const health = round2(
    W.health.architecture    * architecture    +
    W.health.maintainability * maintainability +
    W.health.testability     * testability     +
    W.health.scaleByLOC      * scaleByLOC
  );

  // Dominant metric per composite: the one whose normalized score is LOWEST,
  // weighted (i.e. that pulled the composite down the most).
  const dominant = {
    architecture:    pickDominant(contributions.architecture,    W.architecture),
    maintainability: pickDominant(contributions.maintainability, W.maintainability),
    testability:     pickDominant(contributions.testability,     W.testability),
    health:          pickDominantHealth({ architecture, maintainability, testability, scaleByLOC }, W.health),
  };

  return { architecture, maintainability, testability, health, contributions, dominant, scaleByLOC };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// The dominant metric is the one contributing the LARGEST gap-from-perfect,
// weighted: weight * (100 - score). Higher gap == bigger drag on composite.
function pickDominant(scores, weights) {
  let best = null;
  let bestGap = -Infinity;
  for (const k of Object.keys(scores)) {
    const w = weights[k] ?? 0;
    const gap = w * (100 - scores[k]);
    if (gap > bestGap) {
      bestGap = gap;
      best = k;
    }
  }
  return best;
}

function pickDominantHealth(parts, weights) {
  let best = null;
  let bestGap = -Infinity;
  for (const k of Object.keys(parts)) {
    const w = weights[k] ?? 0;
    const gap = w * (100 - parts[k]);
    if (gap > bestGap) {
      bestGap = gap;
      best = k;
    }
  }
  return best;
}
