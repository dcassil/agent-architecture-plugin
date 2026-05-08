---
id: extend-scanner-mjs-to-capture-per
level: task
title: "Extend scanner.mjs to capture per-file complexity from scc"
short_code: "DGEN-T-0044"
created_at: 2026-05-08T20:39:26.686063+00:00
updated_at: 2026-05-08T20:47:27.858881+00:00
parent: DGEN-I-0007
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/active"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0007
---

# Extend scanner.mjs to capture per-file complexity from scc

## Parent Initiative

[[DGEN-I-0007]]

## Objective

Modify `audit/scripts/lib/scanner.mjs` to invoke scc with the per-file/complexity-emitting flags (e.g. `--by-file --format=json`), parse the per-file `Complexity` field, and reduce into `avgComplexity` (mean) and `maxComplexity` (max) on the returned `ScanMetrics`. Today these fields are 0/absent, so the maintainability composite is missing one of its three intended signals.

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

## Acceptance Criteria

## Acceptance Criteria

- [ ] Scanner returns non-zero `avgComplexity` and `maxComplexity` on this repo
- [ ] Existing scanner outputs (totalLoc, avgLoc, file counts, depcruise-derived fields) are unchanged
- [ ] If the installed scc version doesn't support the needed flags, surface a clear error and document required version (update audit-setup SKILL prereqs if needed)
- [ ] Per-file aggregation only — no per-function work
- [ ] `audit/scripts/lib/scanner.test.mjs` updated for the new fields and passing

## Files
- `audit/scripts/lib/scanner.mjs` (primary)
- `audit/scripts/lib/scanner.test.mjs`

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

## Status Updates

### 2026-05-08 — implementation
- `runScc` now invokes scc with `--by-file --format json .` (bumped maxBuffer to 256MB to absorb the larger payload).
- `reduce()` collects per-file `Complexity` from each language's `Files[]` and computes `avgComplexity = mean`, `maxComplexity = max`. Depcruise per-module complexity remains as a fallback when scc lacks a Complexity signal (preserves the existing fixture-based test, which has no scc Complexity).
- Smoke-run on this repo: `avgComplexity=5.62`, `maxComplexity=139`, `totalLoc=14168` (LOC fields unchanged in shape).
- Tests: existing 3 still pass (fallback path covers depcruise=12 fixture). Added 2 new cases — `prefers scc per-file Complexity` and `falls back to depcruise when scc lacks Complexity`. All 5 pass.
- scc 3.6.0 (homebrew) supports `--by-file` + per-file `Complexity`. No version-prereq doc update needed for the macOS dev path; if other environments pin scc, we can revisit in audit-setup later.
- Per-function aggregation remains out of scope (per task non-goals).