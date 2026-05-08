---
id: idempotent-settings-json-merger
level: task
title: "Idempotent settings.json merger for hooks.PostToolUse"
short_code: "DGEN-T-0050"
created_at: 2026-05-08T20:41:53.182528+00:00
updated_at: 2026-05-08T20:51:34.339254+00:00
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

# Idempotent settings.json merger for hooks.PostToolUse

## Parent Initiative

[[DGEN-I-0008]]

## Objective

Build an idempotent merger that adds the edit-time-lint entry to `.claude/settings.json` `hooks.PostToolUse[]` without overwriting existing user hooks. Mirror the sentinel-block pattern used by the audit plugin's pre-commit installer.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] Creates `.claude/settings.json` if absent (with only the managed hook entry)
- [ ] If the file exists, appends a new entry to `hooks.PostToolUse[]` rather than replacing the array
- [ ] Identifies the managed entry via a stable marker (e.g. command path or sentinel comment) so re-runs are no-ops
- [ ] Removes/updates the managed entry cleanly on re-run (no duplicates)
- [ ] Preserves user-authored entries and surrounding JSON formatting where feasible
- [ ] Unit-tested against fixtures: missing file, empty hooks, existing unrelated PostToolUse entries, prior managed entry

## Implementation Notes

Reuse the existing managed-block / lock-resolution patterns from DGEN-T-0031/DGEN-T-0036. JSON does not support comments — use a structural marker (the `command` path) as the idempotency key.

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

### 2026-05-08 — Post-completion correction (from DGEN-T-0054 dogfood)

The settings.json `PostToolUse` command must redirect eslint stdout to stderr and exit `2` (not `1`) for Claude Code to surface the failure to the agent. Update the merged command from:

```bash
node_modules/.bin/eslint --max-warnings=0 "$f"
```

to:

```bash
node_modules/.bin/eslint --max-warnings=0 "$f" 1>&2 || exit 2
```

Reason: Claude Code silently ignores exit 1 on PostToolUse hooks — agent never saw the lint error. Exit 2 + stderr surfaces the output as a blocking system-reminder. Verified via intentional `any` violation.

Action: re-run merger on installed repos, or document a one-line patch in `/guardrails-add-edit-hook` (DGEN-T-0052).