---
id: dogfood-run-init-on-2-real
level: task
title: "Dogfood: run init on 2 real existing repos (one Next.js, one Node API) and capture findings"
short_code: "DGEN-T-0029"
created_at: 2026-05-08T19:17:48.360851+00:00
updated_at: 2026-05-08T19:38:24.351963+00:00
parent: DGEN-I-0005
blocked_by: []
archived: true

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0005
---

# Dogfood: run init on 2 real existing repos (one Next.js, one Node API) and capture findings

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0005]]

## Objective **[REQUIRED]**

{Clear statement of what this task accomplishes}

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

### 2026-05-08 — Dogfood run

Dogfooded `dev-genie/bin/dev-genie-init.mjs` against two synthesized "real-but-imperfect" repos under `/tmp/dev-genie-dogfood/`:

- **node-api-sample**: package.json + tsconfig (`strict:false`) + flat eslint.config.mjs (`no-explicit-any:warn`, `no-unused-vars:warn`, no TS-promise rules), no hooks/CI/audit. `npm install` run; `eslint --print-config` works.
- **nextjs-sample**: same shape with jsx + `allowJs:true`, single weak rule.

## Dogfood Results

### Repo 1: node-api-sample (`--arch node-api`)

**Before (dry-run):** 54 findings — 5 critical / 42 recommended / 7 optional. Buckets: missing=44, weaker=3, conflicting=3, present=4.
- Critical: pre-commit hook missing; `@typescript-eslint/no-floating-promises` missing; `@typescript-eslint/no-misused-promises` missing; `@typescript-eslint/no-explicit-any` weaker (warn vs error); tsconfig `strict` weaker (false vs true).

**auto-critical:**
- `eslint`: wrote managed override block (3 rules).
- `tsconfig:strict`: updated to `true`.
- `enforcement:pre-commit`: **ERROR** — `installPreCommitHooks: unknown system "simple-git-hooks + lint-staged"`.
- Result: applied=4, skipped=45, errors=1.

**After (dry-run):** 54 findings — 4 critical reported, missing=45, weaker=1, present=5. Critical findings did **not** decrease as expected:
- 3 eslint critical findings reappeared as `[MISSING]` (rather than `[PRESENT]`) because the managed-block append produced an invalid eslint config (see Issue #1).
- pre-commit critical persists due to Issue #2.
- `tsconfig:strict` correctly transitioned from `weaker` to `present` (idempotent for that path).

### Repo 2: nextjs-sample (`--arch react-next-vercel-webapp`)

**Before (dry-run):** 50 findings — 3 critical / 40 recommended / 7 optional. Critical: pre-commit missing; `no-explicit-any` weaker; `tsconfig.strict` weaker.

**auto-critical:**
- `eslint`: wrote managed override block (1 rule).
- `tsconfig:strict`: updated to `true`.
- `enforcement:pre-commit`: **ERROR** (same as repo 1).
- Result: applied=2, skipped=40, errors=1.

**After (dry-run):** Summary still reports `3 critical` in the totals but only 2 critical findings are rendered (pre-commit + `no-explicit-any` now `[MISSING]`). Same root cause as Issue #1 — broken eslint file means `--print-config` fails and dev-genie reads "unset" instead of the managed value.

### Issues found (do NOT fix in this task — log as follow-ups)

1. **Managed-block append produces invalid `eslint.config.mjs`** (CRITICAL bug). The override block adds a second top-level `export default [...]` to a file that already has one. ESM modules can only have one default export, so `eslint --print-config` fails (`Oops! Something went wrong! :(`), and on subsequent runs dev-genie sees rules as `unset` — the apply silently no-ops. Fix idea: detect existing default export and either (a) splice the managed block into the exported array, or (b) emit the managed block as a separate `*.mjs` file referenced via `extends` / re-export, or (c) rewrite the user's `export default` to a named const and re-export the concatenation. Worth adding a post-write sanity check that runs `eslint --print-config` after applying.

2. **Pre-commit hook installer rejects its own baseline mechanism.** The baselines specify `"mechanism":"simple-git-hooks + lint-staged"`, but `installPreCommitHooks` throws `unknown system "simple-git-hooks + lint-staged"`. Either the installer needs cases for combined mechanisms (split on `+`) or the baseline should use a single canonical token.

3. **tsconfig `include` array gets corrupted on JSON-Patch update.** Both repos saw `"include": ["src/**/*"]` rewritten to `"include": ["src*"]` (and `["src/**/*","app/**/*"]` → `["src*","app*"]`) after the strict-flag patch. Glob `**/*` is being lost — probably a stringify/escape bug in the JSON patcher (or it's mishandling forward-slash-followed-by-asterisk). The patch only targeted `/compilerOptions/strict`, so this is collateral damage. Verify with: write tsconfig with `"include":["src/**/*"]`, run auto-critical, diff.

4. **Summary totals desync from rendered groups.** After auto-critical on nextjs-sample, summary header still reads `5 critical / 3 critical` while the rendered CRITICAL section lists fewer. Counts appear to come from a different pass than the rendering. Minor, but confusing.

5. **Idempotency claim is not yet verifiable** because of issues 1–3 — the third dry-run does not show "0 critical" as it should. Once #1 is fixed, re-run this dogfood to confirm.

### Suggested follow-ups

- New task: fix managed-block writer in `dev-genie/lib/eslint-applier` (or equivalent) to produce a valid single-default-export module; add post-apply validation via `eslint --print-config`.
- New task: extend `installPreCommitHooks` to handle combined mechanisms (or normalize baselines).
- New task: investigate JSON-Patch implementation for tsconfig — string `**/*` glob preservation.
- After fixes, redo this dogfood scenario as a regression test (could be scripted under `dev-genie/scripts/`).

### Cleanup
`/tmp/dev-genie-dogfood/` removed after run.