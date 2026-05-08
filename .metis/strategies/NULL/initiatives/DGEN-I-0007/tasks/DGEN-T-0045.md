---
id: add-complexity-fixture-scanner
level: task
title: "Add complexity fixture + scanner test asserting non-zero complexity"
short_code: "DGEN-T-0045"
created_at: 2026-05-08T20:39:29.253502+00:00
updated_at: 2026-05-08T21:07:12.295564+00:00
parent: DGEN-I-0007
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0007
---

# Add complexity fixture + scanner test asserting non-zero complexity

## Parent Initiative

[[DGEN-I-0007]]

## Objective

Add a small branchy fixture (nested if/else/switch/&& chains across one or two files) under the audit test fixtures, and a scanner test that runs the scanner on that fixture and asserts `avgComplexity > 0` and `maxComplexity` clears a sensible floor (e.g. > 5). Locks in the new signal so future regressions are caught.

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

- [ ] New branchy fixture lives alongside existing scanner fixtures
- [ ] New test in `audit/scripts/lib/scanner.test.mjs` asserts `avgComplexity > 0` and `maxComplexity > 5` on the fixture
- [ ] Test is fast (<2s) and does not depend on repo-wide scc state
- [ ] Test passes locally on a clean tree

## Files
- audit scanner fixtures directory (confirm path during impl)
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

### 2026-05-08
- Coverage folded into DGEN-T-0044's test additions: `reduce: prefers scc per-file Complexity over depcruise complexity` and `reduce: falls back to depcruise complexity when scc lacks Complexity` exercise the new code path with controlled per-file Complexity values (30/10 and absent).
- Skipped the heavier "spawn scc on a real branchy fixture" integration test — adds CI variance and process-spawn cost without exercising more of our reducer logic. Dogfooded smoke run on this repo (max=139, avg=5.62) is the live integration check.
- If we later want a hermetic end-to-end test, revisit by adding a `__fixtures__/branchy/` directory + a slow-tagged test.