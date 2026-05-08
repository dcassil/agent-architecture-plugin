---
id: fenced-block-writer-for-agent
level: task
title: "Fenced-block writer for agent config files"
short_code: "DGEN-T-0031"
created_at: 2026-05-08T20:23:32.365401+00:00
updated_at: 2026-05-08T20:28:03.629979+00:00
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

# Fenced-block writer for agent config files

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Implement a fenced-block writer for agent config files that wraps dev-genie's contributions in `<!-- dev-genie:guardrails:begin -->` / `<!-- dev-genie:guardrails:end -->` markers. Re-runs replace the block contents in place; never touch text outside the fence.

## Files

- New: `dev-genie/lib/agent-config-writer.js`
- Tests: `dev-genie/lib/agent-config-writer.test.mjs`
- Consumed by: `dev-genie/lib/apply-flow.js`

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

- [ ] `writeAgentBlock(filePath, body)` creates the file with the fenced block if absent.
- [ ] If file exists with no fence, appends the fenced block after the last newline.
- [ ] If fence already exists, replaces only the contents between the markers, preserving surrounding text exactly.
- [ ] Idempotent: writing the same body twice produces no diff and returns `{ ok: true, changed: false }`.
- [ ] Provides `liftLock(filePath, lockPattern)` helper that comments out or rewrites a detected lock line referencing a given pattern (used when user picks "lift-permanently").
- [ ] Tests cover: new file, existing file no fence, existing fence with same content (no-op), existing fence with different content (replace), file with multiple unrelated HTML comments.

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

- 2026-05-08: Implemented `dev-genie/lib/agent-config-writer.js` with `writeAgentBlock` (create/append/replace/noop) and `liftLock` helper. 7/7 tests pass.