---
id: capture-cyclomatic-complexity-via
level: initiative
title: "Capture cyclomatic complexity via scc and feed it into the audit composite"
short_code: "DGEN-I-0007"
created_at: 2026-05-08T20:27:15.697167+00:00
updated_at: 2026-05-08T21:07:14.841556+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: S
strategy_id: NULL
initiative_id: capture-cyclomatic-complexity-via
---

# Capture cyclomatic complexity via scc and feed it into the audit composite Initiative

## Context

The audit composite (`audit/scripts/lib/composite.mjs`) accepts `avgComplexity` and `maxComplexity` as inputs to the maintainability score, and the `ScanMetrics` shape declared in `audit/scripts/lib/scanner.mjs` includes them — but the scanner currently only invokes `dependency-cruiser` (architecture/fan-out metrics) and `scc` (LOC/file-count metrics). **Neither produces cyclomatic complexity.** depcruise doesn't compute it; scc has had a `--by-file --complexity` mode that emits per-file complexity counts (it is a heuristic, not a true CFG-based McCabe number, but it's repo-wide and language-agnostic — which is exactly what the rest of audit relies on).

Result: `avgComplexity` and `maxComplexity` are currently 0 (or absent), so the maintainability composite is missing one of its three intended signals. The audit currently catches LOC bloat and fan-out, but not deeply nested / branchy code.

## Goals & Non-Goals

**Goals:**
- Extend the scc invocation in `audit/scripts/lib/scanner.mjs` to capture per-file complexity and reduce it into `avgComplexity` and `maxComplexity` on the `ScanMetrics` object.
- Verify `computeComposites` already weighs these fields (it does — confirm and tune the `good`/`bad` baselines in `.audit/audit.config.json`).
- Re-baseline `.audit/audit.results.json` so existing repos absorb the new signal without a spurious regression block.
- Add a smoke test that asserts complexity > 0 on a known-branchy fixture.

**Non-Goals:**
- Replacing scc with a language-specific complexity tool (escomplex/eslint-complexity/radon). scc's heuristic is good enough and stays language-agnostic.
- Per-function complexity (scc is per-file). Function-level surfacing is a future enhancement.
- Reweighting the composite formula — only filling in the missing input.

## Detailed Design

1. **Scanner change** — invoke scc with the complexity-emitting flags (likely `--by-file --format=json` and inspect the `Complexity` field per file). Aggregate to `avgComplexity = mean(file.complexity)` and `maxComplexity = max(file.complexity)`. Keep totalLoc/avgLoc derivation unchanged.
2. **Verify scc version** — confirm the version pinned/used by audit emits Complexity. Update `audit-setup` SKILL prereqs if a newer scc is required.
3. **Composite tuning** — pick `good`/`bad` thresholds for `avgComplexity` (e.g. good=3, bad=15) and `maxComplexity` (e.g. good=10, bad=40) in `audit.config.json`. Validate by running on this repo and a synthesized branchy fixture.
4. **Re-baseline** — update `.audit/audit.results.json` (same pattern used for DGEN-I-0005's metric drop).
5. **Tests** — add to `audit/scripts/lib/scanner.test.mjs`: assert avgComplexity/maxComplexity > 0 on a fixture with `if/else if/switch/&&` chains.

## Implementation Plan

To be decomposed. Likely 3–4 small tasks: scanner change, threshold/config tuning + rebaseline, fixture + tests, dogfood.

## Requirements **[CONDITIONAL: Requirements-Heavy Initiative]**

{Delete if not a requirements-focused initiative}

### User Requirements
- **User Characteristics**: {Technical background, experience level, etc.}
- **System Functionality**: {What users expect the system to do}
- **User Interfaces**: {How users will interact with the system}

### System Requirements
- **Functional Requirements**: {What the system should do - use unique identifiers}
  - REQ-001: {Functional requirement 1}
  - REQ-002: {Functional requirement 2}
- **Non-Functional Requirements**: {How the system should behave}
  - NFR-001: {Performance requirement}
  - NFR-002: {Security requirement}

## Use Cases **[CONDITIONAL: User-Facing Initiative]**

{Delete if not user-facing}

### Use Case 1: {Use Case Name}
- **Actor**: {Who performs this action}
- **Scenario**: {Step-by-step interaction}
- **Expected Outcome**: {What should happen}

### Use Case 2: {Use Case Name}
- **Actor**: {Who performs this action}
- **Scenario**: {Step-by-step interaction}
- **Expected Outcome**: {What should happen}

## Architecture **[CONDITIONAL: Technically Complex Initiative]**

{Delete if not technically complex}

### Overview
{High-level architectural approach}

### Component Diagrams
{Describe or link to component diagrams}

### Class Diagrams
{Describe or link to class diagrams - for OOP systems}

### Sequence Diagrams
{Describe or link to sequence diagrams - for interaction flows}

### Deployment Diagrams
{Describe or link to deployment diagrams - for infrastructure}

## Detailed Design **[REQUIRED]**

{Technical approach and implementation details}

## UI/UX Design **[CONDITIONAL: Frontend Initiative]**

{Delete if no UI components}

### User Interface Mockups
{Describe or link to UI mockups}

### User Flows
{Describe key user interaction flows}

### Design System Integration
{How this fits with existing design patterns}

## Testing Strategy **[CONDITIONAL: Separate Testing Initiative]**

{Delete if covered by separate testing initiative}

### Unit Testing
- **Strategy**: {Approach to unit testing}
- **Coverage Target**: {Expected coverage percentage}
- **Tools**: {Testing frameworks and tools}

### Integration Testing
- **Strategy**: {Approach to integration testing}
- **Test Environment**: {Where integration tests run}
- **Data Management**: {Test data strategy}

### System Testing
- **Strategy**: {End-to-end testing approach}
- **User Acceptance**: {How UAT will be conducted}
- **Performance Testing**: {Load and stress testing}

### Test Selection
{Criteria for determining what to test}

### Bug Tracking
{How defects will be managed and prioritized}

## Alternatives Considered **[REQUIRED]**

{Alternative approaches and why they were rejected}

## Implementation Plan **[REQUIRED]**

{Phases and timeline for execution}