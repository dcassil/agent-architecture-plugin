// node --test audit/scripts/lib/composite.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeComposites,
  scoreLowerBetter,
  scoreHigherBetter,
  scoreScaleByLOC,
  WEIGHTS,
} from './composite.mjs';

const DEFAULT_BASELINES = {
  cycles:        { good: 0,    bad: 0.1 },
  depth:         { good: 4,    bad: 15  },
  roots:         { good: 0.10, bad: 0   },
  avgLoc:        { good: 100,  bad: 400 },
  p90Loc:        { good: 200,  bad: 600 },
  edges:         { good: 2,    bad: 10  },
  orphan:        { good: 0,    bad: 0.2 },
  fan:           { good: 5,    bad: 40  },
  avgComplexity: { good: 5,    bad: 25  },
  maxComplexity: { good: 10,   bad: 60  },
  circularRate:  { good: 0,    bad: 0.1 },
};

const PERFECT = {
  cycles: 0, depth: 4, roots: 0.10, avgLoc: 100, p90Loc: 200,
  edges: 2, orphan: 0, fan: 5, avgComplexity: 5, maxComplexity: 10,
  circularRate: 0, totalLoc: 1000,
};

const TERRIBLE = {
  cycles: 1, depth: 30, roots: 0, avgLoc: 800, p90Loc: 1200,
  edges: 50, orphan: 0.5, fan: 200, avgComplexity: 80, maxComplexity: 200,
  circularRate: 0.5, totalLoc: 200_000,
};

test('scoreLowerBetter: perfect/terrible/clamped', () => {
  assert.equal(scoreLowerBetter(0, 0, 10), 100);
  assert.equal(scoreLowerBetter(10, 0, 10), 0);
  assert.equal(scoreLowerBetter(-5, 0, 10), 100); // clamp
  assert.equal(scoreLowerBetter(99, 0, 10), 0);   // clamp
  assert.equal(scoreLowerBetter(5, 0, 10), 50);   // mid
});

test('scoreHigherBetter: perfect/terrible/clamped', () => {
  assert.equal(scoreHigherBetter(10, 0, 10), 100);
  assert.equal(scoreHigherBetter(0, 0, 10), 0);
  assert.equal(scoreHigherBetter(5, 0, 10), 50);
});

test('scoreScaleByLOC: small repos -> 100, huge repos -> 20', () => {
  assert.equal(scoreScaleByLOC(100), 100);
  assert.equal(scoreScaleByLOC(5_000), 100);
  assert.equal(scoreScaleByLOC(150_000), 20);
  assert.equal(scoreScaleByLOC(1_000_000), 20);
  const mid = scoreScaleByLOC(27_386);
  assert.ok(mid > 20 && mid < 100);
});

test('computeComposites: perfect input -> 100s', () => {
  const r = computeComposites(PERFECT, DEFAULT_BASELINES);
  assert.equal(r.architecture, 100);
  assert.equal(r.maintainability, 100);
  assert.equal(r.testability, 100);
  assert.equal(r.health, 100);
});

test('computeComposites: terrible input -> low scores', () => {
  const r = computeComposites(TERRIBLE, DEFAULT_BASELINES);
  assert.ok(r.architecture < 10, `architecture=${r.architecture}`);
  assert.ok(r.maintainability < 10, `maintainability=${r.maintainability}`);
  assert.ok(r.testability < 10, `testability=${r.testability}`);
  assert.ok(r.health < 30, `health=${r.health}`); // health gets a partial scale boost
});

test('computeComposites: dominant metric selection', () => {
  // Make only avgLoc bad, everything else perfect. avgLoc should dominate maintainability.
  const scan = { ...PERFECT, avgLoc: 400 };
  const r = computeComposites(scan, DEFAULT_BASELINES);
  assert.equal(r.dominant.maintainability, 'avgLoc');
});

test('computeComposites: weights match initiative spec', () => {
  assert.equal(WEIGHTS.architecture.cycles, 0.40);
  assert.equal(WEIGHTS.architecture.depth,  0.35);
  assert.equal(WEIGHTS.architecture.roots,  0.25);
  assert.equal(WEIGHTS.maintainability.avgLoc, 0.35);
  assert.equal(WEIGHTS.maintainability.p90Loc, 0.35);
  assert.equal(WEIGHTS.maintainability.edges,  0.25);
  assert.equal(WEIGHTS.maintainability.orphan, 0.05);
  assert.equal(WEIGHTS.testability.fan,           0.30);
  assert.equal(WEIGHTS.testability.avgComplexity, 0.25);
  assert.equal(WEIGHTS.testability.maxComplexity, 0.20);
  assert.equal(WEIGHTS.testability.circularRate,  0.15);
  assert.equal(WEIGHTS.testability.depth,         0.10);
  assert.equal(WEIGHTS.health.architecture,    0.30);
  assert.equal(WEIGHTS.health.maintainability, 0.30);
  assert.equal(WEIGHTS.health.testability,     0.30);
  assert.equal(WEIGHTS.health.scaleByLOC,      0.10);
});

test('computeComposites: deterministic / idempotent', () => {
  const a = computeComposites(PERFECT, DEFAULT_BASELINES);
  const b = computeComposites(PERFECT, DEFAULT_BASELINES);
  assert.deepEqual(a, b);
});
