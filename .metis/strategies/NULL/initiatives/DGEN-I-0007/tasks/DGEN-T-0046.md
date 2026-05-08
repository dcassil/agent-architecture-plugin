---
id: tune-avg-maxcomplexity-thresholds
level: task
title: "Tune avg/maxComplexity thresholds in audit.config.json and verify composite"
short_code: "DGEN-T-0046"
created_at: 2026-05-08T20:39:32.677375+00:00
updated_at: 2026-05-08T21:07:13.413838+00:00
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

# Tune avg/maxComplexity thresholds in audit.config.json and verify composite

## Parent Initiative

[[DGEN-I-0007]]

## Objective

With the scanner now emitting complexity, set `good`/`bad` thresholds for `avgComplexity` (~good=3, bad=15) and `maxComplexity` (~good=10, bad=40) in `.audit/audit.config.json`. Confirm `audit/scripts/lib/composite.mjs` already consumes these fields (the initiative says it does) and that the maintainability score moves sensibly when complexity changes. No formula reweighting — only filling in the missing input.

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

- [ ] Thresholds present in `.audit/audit.config.json` for both `avgComplexity` and `maxComplexity`
- [ ] Audit run on this repo reports a non-zero complexity contribution to the maintainability composite
- [ ] Audit run on a branchy file/fixture shows visibly degraded maintainability vs. a clean baseline
- [ ] No changes to the composite formula itself

## Files
- `.audit/audit.config.json`
- (verify only) `audit/scripts/lib/composite.mjs`

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
- Kept `avgComplexity` at good=5/bad=25 — matches scc's heuristic in normal code (smoke run avg=5.62 → ~97).
- Bumped `maxComplexity` to good=15/bad=150 (was 10/60). Reason: scc's per-file Complexity counts every branching token (switch cases, ||, &&, etc.) without function-scoping, so single-file totals routinely exceed McCabe-style thresholds. With this repo's max=139, the old bad=60 produced a hard 0; 10/60 made the signal binary rather than directional.
- Composite formula untouched (initiative non-goal).
- Audit run on this repo after tuning: maintainability=78.3, testability=50.76, health=76.23 — complexity is now a non-zero, directional contributor.