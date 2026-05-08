---
id: implement-compare-and-block-logic
level: task
title: "Implement compare-and-block logic with actionable error messages"
short_code: "DGEN-T-0007"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:17:22.468291+00:00
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

# Implement compare-and-block logic with actionable error messages

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Wire the scanner (DGEN-T-0006) and calculator (DGEN-T-0005) together inside `audit/scripts/audit.mjs` to compare current composite scores against the previous run stored in `.audit/audit.results.json`, enforce the `regressionThreshold` (and optional `requireImprovement`), and exit 0/1 with actionable, targeted error messages.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/scripts/audit.mjs` is the executable entry point invoked by the pre-commit hook.
- [ ] On run: loads `.audit/audit.config.json`, scans repo, computes composites, loads previous `.audit/audit.results.json` (if present), compares, and either updates results + exits 0 OR exits 1 with a block message.
- [ ] First-ever run (no prior results) writes baseline and exits 0 with a "baseline established" message.
- [ ] Block triggers when any composite drops by more than `regressionThreshold` (default 5 points) compared to the last stored value.
- [ ] When `requireImprovement: true`, block also triggers if any composite is unchanged or lower.
- [ ] Block message format names: composite that regressed, old vs new score, delta, and the dominant raw metric pulled from calculator output. Example: `audit: BLOCKED — maintainability dropped 78.3 → 71.1 (-7.2). Dominant metric: p90Loc rose 240 → 410.`
- [ ] When the run passes, the results file is updated atomically (write-temp-then-rename) so a crash mid-write doesn't corrupt the baseline.
- [ ] Supports `--no-update` (just check, don't write results — used by hook) and `--update` (write baseline — used by audit-run / audit-init).
- [ ] Integration test at `audit/scripts/audit.test.mjs` simulates: no baseline → pass+write; unchanged scan → pass; regressed scan → block with correct message.

## Implementation Notes

### Technical Approach
- Compare per-composite, not aggregate health-only, so any of the four can trigger a block.
- Atomic write: `fs.writeFileSync(tmp, ...); fs.renameSync(tmp, target)`.
- Exit codes: 0 success, 1 regression block, 2 internal/config error (so the hook can distinguish actionable failure vs broken setup).
- Persist not just composite scores but the raw `ScanMetrics` so future runs can report which raw metric drove a delta.

### Dependencies
- DGEN-T-0005 (calculator) and DGEN-T-0006 (scanner) must be in place.

### Risk Considerations
- `requireImprovement` traps on unchanged scans. Document in audit-setup skill that it is only intended for active refactor work and not steady-state.
- Stale results after large refactors: provide a `--update` escape hatch to re-baseline manually.

## Status Updates

- 2026-05-08: Implemented `audit/scripts/audit.mjs` as the executable entry point. Loads `.audit/audit.config.json`, invokes scanner+composite, compares per-composite vs `.audit/audit.results.json`.
- Pure `evaluate({current, previous, config})` exported for unit tests; full main() runs only when invoked as entry point (guarded via `import.meta.url === file://${process.argv[1]}`).
- Atomic write (write-temp + rename) on results update. `--no-update` (hook) vs `--update` (audit-run) flags supported. Exit codes: 0 pass / baseline, 1 regression block, 2 internal/config error.
- Block-message format matches the spec: `audit: BLOCKED — maintainability dropped 78.3 -> 71.1 (-7.2). Dominant metric: p90Loc 240 -> 410.`
- 6 tests in `audit.test.mjs` pass: baseline, unchanged, within-threshold, regression block, requireImprovement on unchanged, requireImprovement passes on improvement.