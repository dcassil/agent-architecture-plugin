---
id: dogfood-matrix-on-fixture-repos
level: task
title: "Dogfood matrix on fixture repos"
short_code: "DGEN-T-0038"
created_at: 2026-05-08T20:23:40.759188+00:00
updated_at: 2026-05-08T20:35:36.892866+00:00
parent: DGEN-I-0006
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0006
---

# Dogfood matrix on fixture repos

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Run the dev-genie reconciliation flow against five fixture shapes and document results. Fixtures live under `dev-genie/scripts/fixtures/` and are created on the fly by the test harness.

## Files

- New: `dev-genie/scripts/dogfood-matrix.mjs` (creates fixture repos in a temp dir, runs `bin/dev-genie-init.mjs --dry-run --json` against each, asserts expected findings)
- New: `dev-genie/scripts/fixtures/` (templates: `greenfield/`, `claude-locked/`, `vercel-style-guide/`, `claude-locked-and-vercel/`, `husky-managed/`)

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

- [ ] Matrix script runs the five fixtures and asserts: greenfield → all rules absent-unlocked; claude-locked → eslint rules become `absent-locked`; vercel-style-guide → at least one rule classified `already-present-equivalent` or `weaker`; combined → mix of locked + present; husky-managed → enforcement plan targets `.husky/pre-commit`.
- [ ] Idempotent re-run on each fixture produces zero new findings (uses `init.last-run.json`).
- [ ] Documents results in `dev-genie/scripts/dogfood-matrix.results.md` (committed).
- [ ] Records any blocker encountered (e.g. missing `eslint --print-config` runtime in fixture).

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

- 2026-05-08: Implemented `dev-genie/scripts/dogfood-matrix.mjs` covering 5 fixture shapes (greenfield / claude-locked / vercel-style-guide / claude-locked-and-vercel / husky-managed). All 14 assertions pass. Documented results in `dev-genie/scripts/dogfood-matrix.results.md`.