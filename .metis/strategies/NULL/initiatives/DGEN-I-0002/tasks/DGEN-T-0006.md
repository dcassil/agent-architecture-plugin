---
id: build-scanner-depcruise-scc
level: task
title: "Build scanner: depcruise + scc invocation and ScanMetrics reduction"
short_code: "DGEN-T-0006"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:16:30.481017+00:00
parent: DGEN-I-0002
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0002
---

# Build scanner: depcruise + scc invocation and ScanMetrics reduction

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Implement the scan portion of `audit/scripts/audit.mjs`: shell out to `dependency-cruiser` (with metrics/complexity reporting enabled) and `scc`, parse their JSON output, and reduce both into a single normalized `ScanMetrics` object suitable for the composite calculator (DGEN-T-0005).

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/scripts/lib/scanner.mjs` exports an async `scan(repoRoot)` function that returns a `ScanMetrics` object with all twelve fields consumed by `computeComposites`.
- [ ] depcruise is invoked with `--output-type json` and complexity metrics enabled; missing/uninstalled binary produces a clear `audit: dependency-cruiser not found, run audit-init` error.
- [ ] scc is invoked with `--format json`; missing binary produces a clear `audit: scc not found, run audit-init` error.
- [ ] Reducer extracts: cyclic-edge count (cycles), max dependency depth (depth), root module count (roots), avg/p90 LOC per file (avgLoc, p90Loc), total edge count (edges), orphan-module ratio (orphan), max fan-in/out (fan), avg/max cyclomatic complexity (avgComplexity, maxComplexity), circular-import rate (circularRate), and total LOC (totalLoc).
- [ ] Scanner is deterministic: two consecutive runs against unchanged source produce byte-identical `ScanMetrics`.
- [ ] Smoke test at `audit/scripts/lib/scanner.test.mjs` runs the scanner against a tiny fixture project under `audit/scripts/lib/__fixtures__/` and asserts the metric shape.

## Implementation Notes

### Technical Approach
- Use `node:child_process` `execFile` with explicit args (no shell interpolation).
- Resolve binaries by `which` first; if absent, surface the install hint rather than crashing.
- Parse depcruise output's `modules[]` for dependency graph metrics and `summary.violations` for cycle data; parse `modules[].dependencies[].cycle` for circular detection.
- Parse scc output for LOC; cross-reference with depcruise module list to compute `circularRate = modulesInCycles / totalModules`.
- Compute p90 LOC via simple sort + percentile (no stats deps).

### Dependencies
- DGEN-T-0005 (composite calculator) defines the `ScanMetrics` shape this task must produce.

### Risk Considerations
- depcruise complexity reporting requires its TypeScript/Babel parsers; document the install footprint in the setup skill (DGEN-T-0009).
- Large repos: depcruise can be slow. Surface a "scanning..." log line and capture wall-clock time in the results file so future regressions in scan time are visible.

## Status Updates

- 2026-05-08: Implemented `audit/scripts/lib/scanner.mjs` with async `scan(repoRoot, opts)`. Uses `execFile` (no shell) to invoke depcruise (`--output-type json --metrics --no-config`) and scc (`--format json`). Missing-binary check via `which` produces the spec-required `audit: <bin> not found, run audit-init` error.
- Pure `reduce(dc, sc)` function exported separately for testability — produces all twelve ScanMetrics fields from raw outputs.
- Smoke test `scanner.test.mjs` runs `reduce()` over fixtures in `__fixtures__/` and asserts shape, determinism, and empty-input safety. 3/3 tests pass.
- `_meta` field on result includes wallMs scan time per the "scan-time visibility" risk note.