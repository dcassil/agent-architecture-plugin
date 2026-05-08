---
id: author-reconcile-skill-with-prompt
level: task
title: "Author reconcile SKILL with prompt UX and lock resolution"
short_code: "DGEN-T-0036"
created_at: 2026-05-08T20:23:38.539507+00:00
updated_at: 2026-05-08T20:33:31.195451+00:00
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

# Author reconcile SKILL with prompt UX and lock resolution

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Author `dev-genie/skills/reconcile/SKILL.md` that documents the prompt UX (per-group default, per-finding for critical and locks), the lock-resolution choices (skip / lift-temporarily / lift-permanently-and-update-agent-config), and how it consumes the detection report + baseline to produce the plan. The skill is the human-facing wrapper around `lib/compare-config.js`, `lib/report.js`, and `lib/apply-flow.js`.

## Files

- New: `dev-genie/skills/reconcile/SKILL.md`
- Edit: `dev-genie/lib/apply-flow.js` to add lock-resolution branch when a finding is `absent-and-file-locked`

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

- [ ] `dev-genie/skills/reconcile/SKILL.md` exists with frontmatter and explains: classifications (equivalent / weaker / conflicting / absent-unlocked / absent-locked), severity tiers (critical / recommended / optional), prompt cadence rules.
- [ ] Documents the three lock resolutions and their effect on the agent file (no change / temp-lift no-write / replace fenced block + rewrite lock language).
- [ ] `apply-flow.js` recognizes `classification === 'absent-locked'` and routes to a lock-resolution prompt, then either skips, proceeds, or proceeds AND calls `liftLock()` from the agent-config-writer.
- [ ] The skill cross-links to `existing-config-detection` and to `apply-flow.js`.
- [ ] No new third-party deps added.

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

- 2026-05-08: Authored `dev-genie/skills/reconcile/SKILL.md`. Added lock-resolution branch to `apply-flow.js`: looks up `findLockForPath` for each finding's target, prompts in interactive mode (skip / lift-temp / lift-perm) and defaults to skip in non-interactive modes. `lift-perm` calls `liftLock()` to comment out the lock language post-apply. Module loads cleanly.