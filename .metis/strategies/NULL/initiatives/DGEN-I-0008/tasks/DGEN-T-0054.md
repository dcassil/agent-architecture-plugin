---
id: dogfood-edit-time-hook-on-this
level: task
title: "Dogfood edit-time hook on this repo and a fixture repo"
short_code: "DGEN-T-0054"
created_at: 2026-05-08T20:41:57.608494+00:00
updated_at: 2026-05-08T20:59:52.938232+00:00
parent: DGEN-I-0008
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0008
---

# Dogfood edit-time hook on this repo and a fixture repo

## Parent Initiative

[[DGEN-I-0008]]

## Objective

End-to-end validate the edit-time lint hook by installing it on this repo and one fixture repo, then triggering an agent edit that violates ESLint and confirming the agent's turn hard-blocks.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] Hook installed via `/guardrails-add-edit-hook` on this repo; settings.json shows the managed entry
- [ ] Hook installed via fresh `/scaffold-architecture` Q3=yes on a fixture repo
- [ ] Deliberate ESLint violation written by an agent → turn fails with the lint error visible
- [ ] Clean edit (no violations) → turn proceeds normally
- [ ] No interference with existing `lint-staged` pre-commit flow
- [ ] Findings recorded on the initiative (esp. any UX surprises)

## Implementation Notes

Use the same fixture-matrix posture as DGEN-T-0038. Capture latency observations to feed back into DGEN-T-0049 if numbers diverge from prior measurements.

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

### 2026-05-08 — Dogfood found exit-code bug

Initial install used `exit 1` on lint failure. Claude Code silently ignored it — agent never saw violations. Fixed by changing the PostToolUse command in `.claude/settings.json` to:

```bash
node_modules/.bin/eslint --max-warnings=0 "$f" 1>&2 || exit 2
```

Verified: introduced an intentional `any` violation; hook fired and surfaced eslint output to the agent as a blocking system-reminder. Feeds back into DGEN-T-0050 (merger must emit this exact form).