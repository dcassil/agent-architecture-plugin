---
id: dogfood-dev-genie-on-a-fresh-empty
level: task
title: "Dogfood dev-genie on a fresh empty repo"
short_code: "DGEN-T-0015"
created_at: 2026-05-08T18:21:13.299412+00:00
updated_at: 2026-05-08T18:24:11.220108+00:00
parent: DGEN-I-0003
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0003
---

# Dogfood dev-genie on a fresh empty repo

## Parent Initiative

[[DGEN-I-0003]]

## Objective

Dogfood the dev-genie bootstrap on a fresh empty repo (a temp directory). Walk through the `/dev-genie-init` flow as documented and verify the end state matches the initiative's success criteria.

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

- [ ] Create a fresh empty git repo in a temp directory.
- [ ] Manually walk through the steps in `/dev-genie-init` (project-detection then orchestration registry) against that repo.
- [ ] End state contains: an architecture chosen (or explicitly skipped), `.audit/audit.config.json` and `.audit/audit.results.json` seeded, `.git/hooks/pre-commit` installed (or equivalent).
- [ ] Document any friction or gaps observed in the task's Status Updates section, with file paths/notes for follow-up.
- [ ] Clean up temp repo after verification.

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

### 2026-05-08 — Dogfood run

- Created fresh empty git repo at `/tmp/dev-genie-dogfood.*`.
- Ran project-detection heuristics: emitted `project_kind: greenfield`, `suggested_architecture: null`, `confidence: n/a`, `notes: Empty repo, ask user for architecture`. Output matches the spec in `dev-genie/skills/project-detection/SKILL.md`.
- Walked the orchestration registry per `dev-genie/skills/orchestration/SKILL.md`:
  - **guardrails**: install-check passed (plugin reachable). Simulated `/scaffold-architecture node-api` by copying `eslint.config.mjs` + `tsconfig.json` from `guardrails/architectures/node-api/`. Post-setup verification passed.
  - **audit**: install-check passed. Seeded `.audit/audit.config.json`, `.audit/audit.results.json`, and `.git/hooks/pre-commit`. Post-setup verification passed.
- Final-state checklist: all four items satisfied (architecture chosen, audit config + results, pre-commit hook installed).
- Cleaned up the temp repo.

### Observations / follow-ups

- The dogfood used placeholder content for `.audit/audit.results.json` and the pre-commit hook because the real `/audit-init` requires installing `dependency-cruiser` and `scc` via npm/brew, which in a real bootstrap should pause for user consent. The orchestration command already specifies that pause; no change needed.
- No friction observed in the registry flow itself. The "skip scaffolding" path for greenfield-but-user-declines was not exercised; left as an informal verify-by-reading.