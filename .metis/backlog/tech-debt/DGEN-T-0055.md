---
id: reduce-edit-time-eslint-hook
level: task
title: "Reduce edit-time ESLint hook latency below 300ms (eslint_d or equivalent)"
short_code: "DGEN-T-0055"
created_at: 2026-05-08T20:54:09.659120+00:00
updated_at: 2026-05-08T20:54:09.659120+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/backlog"
  - "#tech-debt"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Reduce edit-time ESLint hook latency below 300ms (eslint_d or equivalent)

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[Parent Initiative]]

## Objective **[REQUIRED]**

Bring per-edit lint hook latency from ~1.2s (current cold-start ESLint) to under 300ms so the `PostToolUse` hook from DGEN-I-0008 can be defaulted on without eroding agent throughput.

## Context

DGEN-T-0049 measured `guardrails/scripts/lint-edited-file.sh` against `BeeLine-Frontend` (ESLint v8.57.1, Next.js). Per-invocation wall time: min 1130ms, median ~1247ms, max 2620ms across 10 samples on a 9-line `.tsx`. A 163-line file landed in the same band (~1180ms). Hook overhead minus eslint is ~14ms (no-op path), so the ~1.2s is entirely Node + ESLint cold start. Target is <300ms; >1s is a blocker for default-on per DGEN-I-0008.

## Acceptance Criteria

- [ ] Hook p95 wall time on a representative TS/TSX edit in `BeeLine-Frontend` (or comparable Next.js repo) is under 300ms.
- [ ] Hook still hard-fails (non-zero exit) on lint violations.
- [ ] Greenfield no-op path (no eslint installed) remains under 50ms and exits 0.
- [ ] Mitigation works without requiring a global daemon install (or, if a daemon is required, the install is automated by the guardrails scaffold).

## Technical Debt Impact

- **Current Problems**: Cold-start ESLint dominates; cannot default the hook on without imposing >1s tax per file edit.
- **Benefits of Fixing**: Unlocks defaulting Q3 to "yes" in `universal-guard-rails`, which is the discoverability win this initiative is aimed at.
- **Risk Assessment**: Without mitigation, the hook ships opt-in only; teams that don't read the prompt carefully will miss the inner-loop signal entirely.

## Implementation Notes

### Technical Approach (candidates)

1. **`eslint_d`** (preferred). Long-lived daemon, ~50–150ms per call. Script change: try `node_modules/.bin/eslint_d` first, fall back to `eslint`. Scaffold adds `eslint_d` as a devDependency.
2. **Persistent ESLint worker via Node IPC** — bespoke daemon. More code, fewer deps. Reject unless `eslint_d` has a blocker.
3. **`--cache`** — does not help the edit-the-same-file workflow; rejected on its own but cheap to add alongside (1).

### Dependencies

- DGEN-I-0008 still in `active`. This task gates moving Q3 from opt-in to default.

## Backlog Item Details **[CONDITIONAL: Backlog Item]**

{Delete this section when task is assigned to an initiative}

### Type
- [ ] Bug - Production issue that needs fixing
- [ ] Feature - New functionality or enhancement  
- [ ] Tech Debt - Code improvement or refactoring
- [ ] Chore - Maintenance or setup work

### Priority
- [ ] P0 - Critical (blocks users/revenue)
- [ ] P1 - High (important for user experience)
- [ ] P2 - Medium (nice to have)
- [ ] P3 - Low (when time permits)

### Impact Assessment **[CONDITIONAL: Bug]**
- **Affected Users**: {Number/percentage of users affected}
- **Reproduction Steps**: 
  1. {Step 1}
  2. {Step 2}
  3. {Step 3}
- **Expected vs Actual**: {What should happen vs what happens}

### Business Justification **[CONDITIONAL: Feature]**
- **User Value**: {Why users need this}
- **Business Value**: {Impact on metrics/revenue}
- **Effort Estimate**: {Rough size - S/M/L/XL}

### Technical Debt Impact **[CONDITIONAL: Tech Debt]**
- **Current Problems**: {What's difficult/slow/buggy now}
- **Benefits of Fixing**: {What improves after refactoring}
- **Risk Assessment**: {Risks of not addressing this}

## Acceptance Criteria **[REQUIRED]**

- [ ] {Specific, testable requirement 1}
- [ ] {Specific, testable requirement 2}
- [ ] {Specific, testable requirement 3}

## Test Cases **[CONDITIONAL: Testing Task]**

{Delete unless this is a testing task}

### Test Case 1: {Test Case Name}
- **Test ID**: TC-001
- **Preconditions**: {What must be true before testing}
- **Steps**: 
  1. {Step 1}
  2. {Step 2}
  3. {Step 3}
- **Expected Results**: {What should happen}
- **Actual Results**: {To be filled during execution}
- **Status**: {Pass/Fail/Blocked}

### Test Case 2: {Test Case Name}
- **Test ID**: TC-002
- **Preconditions**: {What must be true before testing}
- **Steps**: 
  1. {Step 1}
  2. {Step 2}
- **Expected Results**: {What should happen}
- **Actual Results**: {To be filled during execution}
- **Status**: {Pass/Fail/Blocked}

## Documentation Sections **[CONDITIONAL: Documentation Task]**

{Delete unless this is a documentation task}

### User Guide Content
- **Feature Description**: {What this feature does and why it's useful}
- **Prerequisites**: {What users need before using this feature}
- **Step-by-Step Instructions**:
  1. {Step 1 with screenshots/examples}
  2. {Step 2 with screenshots/examples}
  3. {Step 3 with screenshots/examples}

### Troubleshooting Guide
- **Common Issue 1**: {Problem description and solution}
- **Common Issue 2**: {Problem description and solution}
- **Error Messages**: {List of error messages and what they mean}

### API Documentation **[CONDITIONAL: API Documentation]**
- **Endpoint**: {API endpoint description}
- **Parameters**: {Required and optional parameters}
- **Example Request**: {Code example}
- **Example Response**: {Expected response format}

## Implementation Notes **[CONDITIONAL: Technical Task]**

{Keep for technical tasks, delete for non-technical. Technical details, approach, or important considerations}

### Technical Approach
{How this will be implemented}

### Dependencies
{Other tasks or systems this depends on}

### Risk Considerations
{Technical risks and mitigation strategies}

## Status Updates **[REQUIRED]**

*To be added during implementation*