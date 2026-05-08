---
id: author-existing-config-detection
level: task
title: "Author existing-config-detection SKILL and integrate agent-config"
short_code: "DGEN-T-0035"
created_at: 2026-05-08T20:23:37.312540+00:00
updated_at: 2026-05-08T20:32:04.068833+00:00
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

# Author existing-config-detection SKILL and integrate agent-config

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Author a new `dev-genie/skills/existing-config-detection/SKILL.md` that documents the detection contract (input: repo path; output: structured detection report) and instructs callers to invoke `detect-config.js` + `detect-build-ci.js` + new `detect-agent-config.js`. Extend the existing `detect()` aggregator so the report shape matches the design (`agentConfigs`, `lintConfigs.extendsChain`, `typeConfigs.extendsChain`, `formatConfigs`, `hookConfigs`, `ciConfigs`, `packageScripts`, `auditState`).

## Files

- New: `dev-genie/skills/existing-config-detection/SKILL.md`
- Edit: `dev-genie/skills/project-detection/detect-config.js` to ensure all design-spec keys are present on output
- The SKILL.md may symlink or reference the existing modules under `project-detection/`

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

- [ ] `dev-genie/skills/existing-config-detection/SKILL.md` exists with frontmatter `name`, `description`, and a "How to run" section describing input/output contract and listing each report key.
- [ ] Aggregated `detect()` output has all of: `agentConfigs`, `lintConfigs[].extendsChain`, `lintConfigs[].effectiveRules`, `typeConfigs[].extendsChain`, `typeConfigs[].effectiveOptions`, `formatConfigs`, `hookConfigs.{husky,lefthook,nativePreCommit,preCommitFramework}`, `ciConfigs[]`, `packageScripts`, `auditState.{hasDir,hasBaseline,hasHook}`.
- [ ] Audit-state probe correctly reports `hasDir=true, hasBaseline=true, hasHook=true` on this repo (which already has `.audit/` baseline + hook).
- [ ] `lintConfigs[].extendsChain` resolves at least one level of `extends` for legacy and flat configs; falls back to `eslint --print-config` when static parse fails (already partially in `eslint-effective-config.js`).
- [ ] Skill instructs the agent to call the modules and never modify the repo.

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

- 2026-05-08: Authored `dev-genie/skills/existing-config-detection/SKILL.md` documenting input/output contract. Extended `detect-config.js` so `hooks` exposes `{husky, lefthook, nativePreCommit, preCommitFramework}` flags, `audit` exposes `{hasDir, hasBaseline, hasHook}`, and the report includes `agentConfigs` + `packageScripts` mirror. Verified against this repo: `audit.hasDir/hasBaseline/hasHook = true`.