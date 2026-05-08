// node --test audit/scripts/lib/scanner.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { reduce } from './scanner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('reduce: produces all twelve ScanMetrics fields from fixtures', async () => {
  const dc = JSON.parse(await readFile(resolve(__dirname, '__fixtures__/depcruise.sample.json'), 'utf8'));
  const sc = JSON.parse(await readFile(resolve(__dirname, '__fixtures__/scc.sample.json'),       'utf8'));
  const m = reduce(dc, sc);

  for (const k of ['cycles','depth','roots','avgLoc','p90Loc','edges','orphan','fan','avgComplexity','maxComplexity','circularRate','totalLoc']) {
    assert.ok(k in m, `missing ${k}`);
    assert.equal(typeof m[k], 'number', `${k} not number`);
    assert.ok(Number.isFinite(m[k]), `${k} not finite`);
  }

  // Fixture sanity: 5 modules, 4 edges total, 2 in cycle (c<->d), 1 orphan.
  assert.equal(m.totalLoc, 500);
  assert.ok(m.circularRate > 0, 'circularRate should be > 0');
  assert.ok(m.orphan > 0, 'orphan should be > 0');
  assert.equal(m.maxComplexity, 12);
});

test('reduce: deterministic across runs', async () => {
  const dc = JSON.parse(await readFile(resolve(__dirname, '__fixtures__/depcruise.sample.json'), 'utf8'));
  const sc = JSON.parse(await readFile(resolve(__dirname, '__fixtures__/scc.sample.json'),       'utf8'));
  const a = reduce(dc, sc);
  const b = reduce(dc, sc);
  assert.deepEqual(a, b);
});

test('reduce: empty inputs do not crash', () => {
  const m = reduce({ modules: [] }, []);
  assert.equal(typeof m.totalLoc, 'number');
  assert.equal(m.totalLoc, 0);
});

test('reduce: prefers scc per-file Complexity over depcruise complexity', () => {
  const dc = { modules: [{ source: 'a.ts', dependencies: [], complexity: 12 }] };
  const sc = [{
    Name: 'JavaScript', Code: 100, Count: 2,
    Files: [
      { Filename: 'a.js', Code: 60, Complexity: 30 },
      { Filename: 'b.js', Code: 40, Complexity: 10 },
    ],
  }];
  const m = reduce(dc, sc);
  assert.equal(m.maxComplexity, 30);
  assert.equal(m.avgComplexity, 20);
});

test('reduce: falls back to depcruise complexity when scc lacks Complexity', () => {
  const dc = { modules: [{ source: 'a.ts', dependencies: [], complexity: 7 }] };
  const sc = [{ Name: 'TypeScript', Code: 80, Count: 1, Files: [{ Filename: 'a.ts', Code: 80 }] }];
  const m = reduce(dc, sc);
  assert.equal(m.maxComplexity, 7);
  assert.equal(m.avgComplexity, 7);
});
