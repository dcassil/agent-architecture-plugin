---
id: build-audit-plugin-with-composite
level: initiative
title: "Build audit plugin with composite scoring and pre-commit hook"
short_code: "DGEN-I-0002"
created_at: 2026-05-08T17:52:24.129657+00:00
updated_at: 2026-05-08T18:20:10.592962+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: L
strategy_id: NULL
initiative_id: build-audit-plugin-with-composite
---

# Build audit plugin with composite scoring and pre-commit hook

## Context

The vision calls for an enforcement layer that measures code quality and blocks commits that regress it. Reference implementations in `../code-audit` (TypeScript scoring package) and `../ultra-metis` (brownfield evaluator) demonstrate the depcruise + scc → composite score pipeline; we are porting the *minimum viable* version into a self-contained Claude Code plugin at `audit/`. Composite definitions are intentionally hard-coded in the plugin so scores are comparable across projects; user config only carries baselines, the regression threshold, and stored last-run results.

## Goals & Non-Goals

**Goals:**
- A new `audit/` plugin that, when installed in a host repo, can:
  - Scan the repo with dependency-cruiser (with complexity reporting enabled) and scc.
  - Reduce raw output to four composites: **health**, **architecture**, **maintainability**, **testability**, using hard-coded weighted formulas adapted from `code-audit/packages/scoring`.
  - Persist last-run scores under `.audit/` in the host repo.
  - Install a pre-commit hook that re-scans, compares against last-stored scores, and blocks the commit when any composite drops by more than the configured `regressionThreshold`.
  - Optional `requireImprovement` mode that blocks unless scores rise.
- Block messages name the composite, the delta, and the dominant raw metric.
- Plugin includes a setup skill/command that walks the agent through installing tooling, seeding `.audit/audit.config.json`, taking a baseline scan, and registering the hook.

**Non-Goals:**
- No CI integration in this initiative — pre-commit only.
- No language coverage beyond what depcruise + scc support out of the box.
- No dashboards, history beyond "last run", or remote score storage.
- No coupling to `dev-genie/` or `guardrails/` (this plugin must stand alone).

## Detailed Design

**Composites (hard-coded, adapted from `code-audit/packages/scoring/src/calculator.ts`):**

- `architecture` = 0.40·cycles + 0.35·depth + 0.25·roots
- `maintainability` = 0.35·avgLoc + 0.35·p90Loc + 0.25·edges + 0.05·orphan
- `testability` = 0.30·fan + 0.25·avgComplexity + 0.20·maxComplexity + 0.15·circularRate + 0.10·depth
- `health` = 0.30·architecture + 0.30·maintainability + 0.30·testability + 0.10·scaleByLOC

Complexity inputs come from depcruise's metrics output (cyclomatic complexity per module).

**Files added to host repo by setup:**
- `.audit/audit.config.json` — baselines (good/bad cutoffs per raw metric), `regressionThreshold` (default 5), `requireImprovement` (default false).
- `.audit/audit.results.json` — last-run composite scores + raw scan metrics.
- `.git/hooks/pre-commit` — plain shell hook that invokes the audit script (no husky dependency).

**Files inside the plugin:**
- `audit/scripts/audit.mjs` — the scanner: shells out to depcruise and scc, parses JSON, computes composites, compares, writes results, exits 0/1 with actionable message.
- `audit/scripts/install-hook.sh` — idempotent installer for the pre-commit hook.
- `audit/skills/audit-setup/SKILL.md` — instructs the agent to install tools, seed config, take baseline, install hook.
- `audit/commands/audit-init.md` — slash command wrapping the setup flow.
- `audit/commands/audit-run.md` — manual scan command for ad-hoc checks.

**Hook flow:** stage → hook runs `audit.mjs` → re-scans → loads previous results → compares → blocks (exit 1, prints offending composite/delta/metric) or updates `.audit/audit.results.json` and lets commit proceed.

## Alternatives Considered

- **husky for hook management** — rejected: forces a package.json dependency on the host project, breaking zero-friction adoption for non-JS repos.
- **Per-project tunable composite weights** — rejected: makes scores incomparable across projects and invites users to tune their way out of failing scores.
- **Block on absolute score thresholds** — rejected: blocks any commit on already-low codebases. Regression-relative is more pragmatic; `requireImprovement` mode covers the refactor case.
- **Add eslint/lizard for complexity** — rejected after confirming depcruise can emit complexity; keeps tool footprint to two binaries.

## Implementation Plan

1. Port composite calculator (TS → plain JS/mjs, no external deps).
2. Build scanner: depcruise + scc invocation, JSON parsing, ScanMetrics reduction.
3. Wire compare-and-block logic + actionable error messages.
4. Build hook installer + setup skill + slash commands.
5. Dogfood on this repo (install audit on `gaurd-rails-boilerplate` itself, take baseline, attempt a regressing edit, verify block).