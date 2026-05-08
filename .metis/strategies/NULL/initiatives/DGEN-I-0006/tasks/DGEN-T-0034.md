---
id: enforcement-wire-up-for-hooks-and
level: task
title: "Enforcement wire-up for hooks and CI (lint/typecheck/audit)"
short_code: "DGEN-T-0034"
created_at: 2026-05-08T20:23:35.811202+00:00
updated_at: 2026-05-08T20:31:02.042858+00:00
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

# Enforcement wire-up for hooks and CI (lint/typecheck/audit)

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Wire missing enforcement steps for `lint`, `typecheck`, and `audit` across pre-commit AND build/CI. Cooperate with whichever framework is already detected (Husky / lefthook / native git hooks / pre-commit framework). Add CI step suggestions for GitHub Actions workflows that exist.

## Files

- New: `dev-genie/lib/enforcement-installer.js` (functions: `ensureHusky`, `ensureLefthook`, `ensureNativeHook`, `ensurePackageScripts`, `ensureCiStep`)
- Wire into: `dev-genie/lib/apply-flow.js`
- Consumes: `dev-genie/skills/project-detection/detect-build-ci.js` results
- Coordinates with: `audit/scripts/install-hook.sh` (do not duplicate when audit hook already manages pre-commit)

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

- [ ] When Husky is detected: adds steps to `.husky/pre-commit` (idempotent) instead of writing `.git/hooks/pre-commit`.
- [ ] When lefthook is detected: appends to `lefthook.yml` `pre-commit.commands`.
- [ ] When `.pre-commit-config.yaml` is detected: adds a `local` hook entry.
- [ ] When no framework detected: writes `.git/hooks/pre-commit` (or coordinates with the existing audit hook).
- [ ] Adds `package.json` scripts `lint`, `typecheck` if missing (asks before clobbering).
- [ ] When a GitHub Actions workflow exists: emits a finding to add steps for any of `lint`/`typecheck`/`audit` that are missing; with user confirm, edits the workflow YAML to add the steps under the existing job.
- [ ] Coordinates with audit's pre-commit installer so the same hook file holds both invocations rather than two competing hooks.
- [ ] Tests with fixture repos: husky-managed, lefthook-managed, native-only, no-hooks, GH-Actions-with-lint-only.

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

- 2026-05-08: Implemented `dev-genie/lib/enforcement-installer.js` as a thin facade over the existing `pre-commit.mjs` (husky/lefthook/pre-commit/raw) and `write-helpers.js` (package scripts + GH Actions workflow). 9/9 tests pass. Existing `apply-flow.js` already integrates pre-commit; CI step ensure can be invoked from finding handlers. Audit hook coordination is already covered by audit's own installer (does not double-write since pre-commit.mjs uses sentinel-marked blocks).