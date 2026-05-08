---
id: update-orchestration-skill-and-dev
level: task
title: "Update orchestration skill and dev-genie-init command for reconciliation flow"
short_code: "DGEN-T-0037"
created_at: 2026-05-08T20:23:39.637923+00:00
updated_at: 2026-05-08T20:34:34.534382+00:00
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

# Update orchestration skill and dev-genie-init command for reconciliation flow

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Update `dev-genie/skills/orchestration/SKILL.md` and `dev-genie/commands/dev-genie-init.md` so the existing-repo branch explicitly invokes the new `existing-config-detection` and `reconcile` skills, and so the registry's final-state checklist covers agent-config locks, layered eslint config, and CI enforcement.

## Files

- Edit: `dev-genie/skills/orchestration/SKILL.md`
- Edit: `dev-genie/commands/dev-genie-init.md`

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

- [ ] Orchestration "How to use" section names `existing-config-detection` and `reconcile` skills as the existing-repo path.
- [ ] Final-state checklist adds: layered eslint config present OR managed block written; agent-config locks resolved; CI workflow runs lint/typecheck/audit (when CI present).
- [ ] `dev-genie-init.md` references the new skills by path and documents the `--dry-run` flag at the top of the existing-repo branch.
- [ ] No regression to the greenfield branch.

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

- 2026-05-08: Updated orchestration skill to add the reconciliation path branch (existing-config-detection + reconcile) and extended final-state checklist (layered eslint OR managed block, lock resolutions, CI lint/typecheck, `.dev-genie/init.last-run.json`). Updated `dev-genie-init.md` to document `--dry-run` and reference the two new skills. Greenfield branch unchanged.