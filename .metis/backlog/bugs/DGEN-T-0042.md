---
id: bug-pre-commit-installer-rejects
level: task
title: "Bug: pre-commit installer rejects `simple-git-hooks + lint-staged` system from universal baseline"
short_code: "DGEN-T-0042"
created_at: 2026-05-08T20:25:01.046264+00:00
updated_at: 2026-05-08T20:25:01.046264+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/backlog"
  - "#bug"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Bug: pre-commit installer rejects `simple-git-hooks + lint-staged` system from universal baseline

## Objective

Teach the pre-commit installer (`dev-genie/scripts/lib/pre-commit.mjs` `installPreCommitHooks`) to handle `system: "simple-git-hooks + lint-staged"` — that is the system named in the universal baseline (`dev-genie/baselines/universal.json` enforcementPoints) and the apply-flow currently throws `unknown system "simple-git-hooks + lint-staged"`, so every existing-repo init logs 1 error per repo.

DGEN-T-0027's refactor already added *detection* for simple-git-hooks; this is the missing *install* path.

## Source

DGEN-T-0029 dogfood — both synthesized repos hit this on auto-critical apply.

## Fix sketch

- Recognize the compound system name (split on `+`, trim, allow either or both halves).
- Install path for `simple-git-hooks`: write/merge `package.json#simple-git-hooks` with a `pre-commit` entry (e.g. `"npx lint-staged"` or chained commands), idempotently. Run `npx simple-git-hooks` to materialize the git hook (or instruct user).
- Install path for `lint-staged`: merge `package.json#lint-staged` with the requested commands per glob (likely `"*.{ts,tsx,js,mjs}": ["eslint --fix"]`), idempotently.
- Reuse the sentinel-block strategy used for husky/raw hooks where applicable.

## Acceptance criteria

- [ ] `installPreCommitHooks(repo, { system: 'simple-git-hooks + lint-staged', commands })` succeeds on a repo with no prior pre-commit setup.
- [ ] Idempotent — re-run is a no-op.
- [ ] Existing user `simple-git-hooks` / `lint-staged` config is merged, not overwritten, unless caller passes an allow-overwrite flag.
- [ ] Smoke test in `pre-commit.test.mjs`.

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

*To be added during implementation*