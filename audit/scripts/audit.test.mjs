// node --test audit/scripts/audit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './audit.mjs';

const baseConfig = { regressionThreshold: 5, requireImprovement: false };

const prev = {
  composites: { architecture: 80, maintainability: 75, testability: 70, health: 75 },
  scanMetrics: { avgLoc: 100, p90Loc: 200 },
};

test('evaluate: no previous -> baseline', () => {
  const r = evaluate({ current: { composites: { architecture: 80, maintainability: 75, testability: 70, health: 75 } }, previous: null, config: baseConfig });
  assert.equal(r.baseline, true);
  assert.equal(r.ok, true);
});

test('evaluate: unchanged scan -> pass', () => {
  const r = evaluate({
    current: { composites: { architecture: 80, maintainability: 75, testability: 70, health: 75 } },
    previous: prev,
    config: baseConfig,
  });
  assert.equal(r.ok, true);
  assert.equal(r.blocks.length, 0);
});

test('evaluate: small drop within threshold -> pass', () => {
  const r = evaluate({
    current: { composites: { architecture: 78, maintainability: 73, testability: 70, health: 74 } },
    previous: prev,
    config: baseConfig,
  });
  assert.equal(r.ok, true);
});

test('evaluate: drop >5 on maintainability -> block', () => {
  const r = evaluate({
    current: { composites: { architecture: 80, maintainability: 65, testability: 70, health: 75 } },
    previous: prev,
    config: baseConfig,
  });
  assert.equal(r.ok, false);
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0].composite, 'maintainability');
  assert.equal(r.blocks[0].reason, 'regression');
  assert.ok(r.blocks[0].delta < -5);
});

test('evaluate: requireImprovement blocks unchanged scan', () => {
  const r = evaluate({
    current: { composites: { architecture: 80, maintainability: 75, testability: 70, health: 75 } },
    previous: prev,
    config: { regressionThreshold: 5, requireImprovement: true },
  });
  assert.equal(r.ok, false);
  // All four are unchanged or non-improving
  assert.ok(r.blocks.length >= 1);
  assert.equal(r.blocks[0].reason, 'requireImprovement');
});

test('evaluate: requireImprovement passes on strict improvement', () => {
  const r = evaluate({
    current: { composites: { architecture: 81, maintainability: 76, testability: 71, health: 76 } },
    previous: prev,
    config: { regressionThreshold: 5, requireImprovement: true },
  });
  assert.equal(r.ok, true);
});
