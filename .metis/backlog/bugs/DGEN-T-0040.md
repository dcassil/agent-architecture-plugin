---
id: bug-apply-flow-eslint-managed
level: task
title: "Bug: apply-flow eslint managed-block appends second `export default` to flat config"
short_code: "DGEN-T-0040"
created_at: 2026-05-08T20:24:57.948401+00:00
updated_at: 2026-05-08T21:21:32.637860+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#task"
  - "#bug"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Bug: apply-flow eslint managed-block appends second `export default` to flat config

## Objective

Fix the eslint managed-block writer in `dev-genie/lib/apply-ensure.js` (originally in apply-flow.js) so it does not append a second `export default [...]` to a flat config that already has one. Currently it does, producing an invalid module — `eslint --print-config` then fails, the comparator reads "no rules", and the next dry-run silently shows the fix as still needed (breaking idempotency).

## Source

Surfaced during DGEN-T-0029 dogfood on synthesized Next.js + Node API repos. Both repos hit this on `auto-critical` mode.

## Repro

1. Init a repo with a working flat `eslint.config.mjs` exporting a default array.
2. Run `node dev-genie/bin/dev-genie-init.mjs --repo <path> --arch node-api --mode auto-critical`.
3. Inspect `eslint.config.mjs` — it now has two `export default` statements.
4. Re-run with `--mode dry-run` — same critical findings reappear.

## Fix sketch

The managed-block strategy needs to not be a sibling `export default`. Options: (a) merge the override object into the existing default-exported array via AST edit, (b) write a separate `eslint.config.dev-genie.mjs` and instruct the user to import-and-spread it, (c) wrap the user's existing default in a known sentinel and append to its tail. (a) is most invisible to the user; (b) is most robust against future-edit drift.

## Acceptance criteria

- [ ] Apply followed by dry-run shows no remaining critical findings for the same rules (idempotency).
- [ ] Resulting `eslint.config.{mjs,js,cjs}` is a valid module (`node --check` passes; `eslint --print-config` returns the merged rules).
- [ ] Re-applying is a no-op (no duplicate sentinels).
- [ ] Smoke test added covering: fresh apply, idempotent re-apply, removal/rewrite of managed block.

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

### 2026-05-08 — Fixed

Replaced `writeEslintManagedBlock` body in `dev-genie/lib/apply-flow.js` to route flat-config writes through the existing `writeLayeredEslintConfig` (option b/c hybrid: separate `eslint.config.guardrails.mjs` + entry-point proxy with `.dev-genie.bak` backup). The dispatcher API is unchanged so callers (single-rule path at apply-flow.js:321 and batched path at apply-flow.js:494) need no edits.

Bonus: the new writer also strips any pre-existing managed-block sentinels from the entry file on first run, so repos already corrupted by the old buggy writer self-heal.

**Acceptance criteria:**
- [x] Apply followed by dry-run shows no remaining critical findings — covered by idempotent re-apply test (entry+layered files byte-identical on second call).
- [x] Resulting `eslint.config.{mjs,js,cjs}` is a valid module — `node --check` runs in tests; entry file has exactly one default export (proxy form).
- [x] Re-applying is a no-op — verified in test "re-apply is idempotent".
- [x] Smoke test added — `dev-genie/lib/apply-flow-eslint.test.mjs` (4 cases: fresh apply, idempotent re-apply, legacy-corruption strip, missing config).

**Files changed:**
- `dev-genie/lib/apply-flow.js` — import layered writer; rewrite `writeEslintManagedBlock`; export it for tests.
- `dev-genie/lib/apply-flow-eslint.test.mjs` — new (regression coverage).

**Test run:** `node --test dev-genie/lib/*.test.mjs` → 36/36 pass.