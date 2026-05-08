---
id: bug-tsconfig-json-patch-in-apply
level: task
title: "Bug: tsconfig JSON-Patch in apply-flow mangles `include` globs (`src/**/*` → `src*`)"
short_code: "DGEN-T-0041"
created_at: 2026-05-08T20:24:59.627392+00:00
updated_at: 2026-05-08T21:23:00.175308+00:00
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

# Bug: tsconfig JSON-Patch in apply-flow mangles `include` globs (`src/**/*` → `src*`)

## Objective

Fix the tsconfig JSON-Patch applier in `dev-genie/lib/apply-flow.js` so that mutating one `compilerOptions` field does not corrupt unrelated `include` glob entries. Observed: patching `/compilerOptions/strict` rewrote `"include": ["src/**/*"]` → `["src*"]`, and `["src/**/*","app/**/*"]` → `["src*","app*"]`. Globs with `**/*` are being eaten somewhere in the patch path.

## Source

DGEN-T-0029 dogfood on both synthesized repos. Reproducible on every `auto-critical` apply that touches tsconfig.

## Likely cause

The JSONC-aware reader/writer probably treats `/**` as a comment marker even inside a string literal during a strip-or-restore step. `apply-flow.js` re-stringifies after mutation, so any string-vs-comment confusion in the read or write path corrupts the array.

## Repro

1. Sample tsconfig: `{ "compilerOptions": { "strict": false }, "include": ["src/**/*"] }`.
2. Run apply with a finding that flips `strict: true`.
3. Diff the result — `include` is mangled.

## Acceptance criteria

- [ ] Patching `compilerOptions` preserves all other top-level keys byte-for-byte except for explicit format normalization (indent/trailing newline).
- [ ] Strings containing `/*` or `*/` are never treated as comment delimiters.
- [ ] Test case covers: tsconfig with `**/*` in include, tsconfig with comments, tsconfig with trailing commas (JSONC).
- [ ] Idempotent re-apply leaves tsconfig identical.

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

Root cause: `parseJsonc` in `dev-genie/lib/apply-flow.js` used `raw.replace(/\/\*[\s\S]*?\*\//g, '')` which is string-blind. In `"src/**/*"` the substring `/**/` (chars 4–7) matched the comment regex and got stripped, yielding `"src*"`. Same for `"app/**/*"`.

Fix: replaced the regex stripper with a character-by-character `stripJsonc` state machine that:
- copies string literals verbatim (handling `\\` and `\"` escapes), and
- only strips `//` and `/* … */` comments outside strings.

The trailing-comma normalizer is still a regex but now runs over already-stripped output so glob strings cannot collide with it.

**Acceptance criteria:**
- [x] Patching `compilerOptions` preserves all other top-level keys — covered by "preserves include globs" test.
- [x] Strings containing `/*` or `*/` are never treated as comment delimiters — covered by "block comments but not when inside strings" + escape test.
- [x] Tests cover globs, JSONC comments, trailing commas — yes.
- [x] Idempotent re-apply leaves tsconfig identical — verified.

**Files changed:**
- `dev-genie/lib/apply-flow.js` — replace regex `parseJsonc` stripper with state-machine `stripJsonc`; export both for tests.
- `dev-genie/lib/apply-flow-jsonc.test.mjs` — new (9 cases).

**Test run:** `node --test dev-genie/lib/*.test.mjs dev-genie/scripts/lib/*.test.mjs` → 54/54 pass.