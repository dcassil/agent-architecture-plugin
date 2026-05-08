---
id: bug-report-summary-counts-desync
level: task
title: "Bug: report summary counts desync from rendered group counts after apply"
short_code: "DGEN-T-0043"
created_at: 2026-05-08T20:25:02.339418+00:00
updated_at: 2026-05-08T21:27:13.089787+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#task"
  - "#bug"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Bug: report summary counts desync from rendered group counts after apply

## Objective

Reconcile the post-apply summary counts in `dev-genie/lib/apply-flow.js` / `report.js` so the headline `applied/skipped/errors` matches the rendered group counts. Observed during DGEN-T-0029 dogfood: after `auto-critical`, the summary line and the per-group rendered counts disagreed.

## Likely cause

`applyFindings` is counting at one grain (per-finding) while the report renderer summarizes at a different grain (per-group, or after deduping by category). Or: findings with `present` status are filtered in one path and not the other.

## Acceptance criteria

- [ ] Summary `applied + skipped + errors` equals the total rendered findings for the run.
- [ ] Summary breakdowns by severity/category match `formatReport` output.
- [ ] Unit test asserts the invariant on a synthesized findings list.

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

## Acceptance Criteria

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

### 2026-05-08 — Fixed

Root cause was in `dev-genie/lib/report.js` — the `formatReport` body filters out `status:'present'` findings before rendering per-severity groups, but its trailing summary line called `formatSummaryCounts(findings, c)` against the *unfiltered* list. Result: a baseline with one `present` and four gaps would render groups summing to 4, then print `Summary: 5 findings`. Apply-flow's own `applied/skipped/errors` accounting was correct (and is now covered by tests).

**Fix:**
- `formatSummaryCounts` is now called with `filtered` (the rendered subset). Headline label changed from "findings" → "gaps" so it's clear what the count represents.
- Present-count is still surfaced in the parenthetical breakdown via a new `{ presentCount }` opt, so users can still see how many baseline matches existed.

**Acceptance criteria:**
- [x] Summary `applied + skipped + errors` equals total actionable — covered by 3 mode-specific invariant tests in `apply-flow-counts.test.mjs`.
- [x] Summary breakdowns match `formatReport` body — new test parses the rendered output and asserts headline gap-count equals Σ per-severity counts.
- [x] Unit tests assert invariants on synthesized findings — yes, 6 tests total.

**Files changed:**
- `dev-genie/lib/report.js` — fix summary to count rendered subset; add `presentCount` opt.
- `dev-genie/lib/apply-flow-counts.test.mjs` — new (6 cases covering apply-all, auto-critical, dry-run, all-present, toJSON consistency, and formatReport headline invariant).

**Test run:** `node --test dev-genie/lib/*.test.mjs dev-genie/scripts/lib/*.test.mjs` → 64/64 pass.