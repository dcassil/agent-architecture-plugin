---
id: port-composite-calculator-to-plain
level: task
title: "Port composite calculator to plain JS module"
short_code: "DGEN-T-0005"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:15:15.632718+00:00
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

# Port composite calculator to plain JS module

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Port the composite scoring calculator from `../code-audit/packages/scoring/src/calculator.ts` (and its supporting `rawMetrics.ts` / `scoringFns.ts`) into a self-contained, dependency-free ES module at `audit/scripts/lib/composite.mjs`. The module must compute the four hard-coded composites (architecture, maintainability, testability, health) from a normalized `ScanMetrics` input using the exact weights specified in the initiative.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/scripts/lib/composite.mjs` exports a `computeComposites(scanMetrics, baselines)` function returning `{architecture, maintainability, testability, health}` plus the per-raw-metric normalized contributions.
- [ ] Weights match the initiative spec exactly: architecture = 0.40 cycles + 0.35 depth + 0.25 roots; maintainability = 0.35 avgLoc + 0.35 p90Loc + 0.25 edges + 0.05 orphan; testability = 0.30 fan + 0.25 avgComplexity + 0.20 maxComplexity + 0.15 circularRate + 0.10 depth; health = 0.30 architecture + 0.30 maintainability + 0.30 testability + 0.10 scaleByLOC.
- [ ] Each raw metric is normalized to a 0-100 score via good/bad cutoffs from the baselines argument (linear interpolation, clamped).
- [ ] Module is plain Node.js ESM with zero npm dependencies and runs under Node 18+.
- [ ] Calculator output also includes the dominant raw metric per composite (the metric whose normalized contribution most reduced the composite) for use in error messages.
- [ ] Unit tests at `audit/scripts/lib/composite.test.mjs` cover known-good fixtures, boundary clamping, and dominant-metric selection. Tests run via plain `node --test`.

## Implementation Notes

### Technical Approach
- Read `../code-audit/packages/scoring/src/calculator.ts`, `rawMetrics.ts`, and `scoringFns.ts` for reference. Translate to plain JS, dropping TypeScript types and any project-specific helpers.
- Define a JSDoc shape for `ScanMetrics`: `{cycles, depth, roots, avgLoc, p90Loc, edges, orphan, fan, avgComplexity, maxComplexity, circularRate, totalLoc}`.
- Hard-code weights as named constants at the top of the file. No config-driven weight tuning (per initiative non-goals).
- `scaleByLOC` term: log-scaled bonus on `totalLoc` (mirror code-audit behavior).

### Dependencies
None. This is the foundation for DGEN-T-0006 and DGEN-T-0007.

### Risk Considerations
- Weight drift from reference: keep a comment near each weight constant pointing to the line in `calculator.ts` it was derived from.
- Floating-point determinism: round composites to 2 decimal places at the output boundary so re-scans of identical code yield identical numbers.

## Status Updates

- 2026-05-08: Implemented `audit/scripts/lib/composite.mjs` (zero-dep ESM) with `computeComposites()`, exported scoring primitives (`scoreLowerBetter`, `scoreHigherBetter`, `scoreScaleByLOC`) and frozen `WEIGHTS` constant. Weights match initiative spec exactly (architecture 0.40/0.35/0.25, maintainability 0.35/0.35/0.25/0.05, testability 0.30/0.25/0.20/0.15/0.10, health 0.30/0.30/0.30/0.10).
- Dominant-metric selection picks the metric with the largest weighted gap-from-100 (most drag on the composite).
- 8 unit tests in `composite.test.mjs` pass via `node --test`: scoring primitives, perfect/terrible/clamped inputs, dominant-metric selection, weight-spec assertion, deterministic re-runs.