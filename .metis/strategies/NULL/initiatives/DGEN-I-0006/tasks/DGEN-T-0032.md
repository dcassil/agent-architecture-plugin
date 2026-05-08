---
id: layered-eslint-config-writer
level: task
title: "Layered eslint config writer (eslint.config.guardrails.mjs)"
short_code: "DGEN-T-0032"
created_at: 2026-05-08T20:23:33.508971+00:00
updated_at: 2026-05-08T20:28:50.842907+00:00
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

# Layered eslint config writer (eslint.config.guardrails.mjs)

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Add a layered eslint config writer that emits `eslint.config.guardrails.mjs` which imports/extends the user's existing eslint config and appends dev-genie's enforced rule overrides. With user opt-in, rewrite the user's eslint config entry to import the layered file. This is preferred over the existing managed-block approach when the user's config is dynamic, in TypeScript, or extends a third-party preset deeply.

## Files

- New: `dev-genie/lib/eslint-layered-writer.js`
- Tests: `dev-genie/lib/eslint-layered-writer.test.mjs`
- Wire into: `dev-genie/lib/apply-flow.js` as alternate path next to `writeEslintManagedBlock`

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

- [ ] Writes `eslint.config.guardrails.mjs` that `import`s the user's primary eslint config (resolved by detection) and re-exports `[...userConfig, { rules: { ... } }]`.
- [ ] When the existing config is `.eslintrc*` legacy format, falls back to the managed-block path and notes the limitation in the report.
- [ ] Has a `rewriteEntryPoint` option that, when true, rewrites/replaces the user's eslint config to a one-liner that re-exports the layered file (with a backup written alongside).
- [ ] Default: do NOT rewrite the entry point; instead instruct the user to `npx eslint --config eslint.config.guardrails.mjs` or wire the package script.
- [ ] Tests cover: flat config with default export, flat config with named export, legacy `.eslintrc.json` (falls back), TS eslint config (`.ts`).

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

- 2026-05-08: Implemented `dev-genie/lib/eslint-layered-writer.js` with flat-config layering, legacy fallback, and optional `rewriteEntryPoint` (backs up original). 5/5 tests pass. Wiring into `apply-flow.js` covered in T-0036.