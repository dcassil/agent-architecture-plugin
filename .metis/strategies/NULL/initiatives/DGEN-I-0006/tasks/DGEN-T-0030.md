---
id: agent-config-scanner-with-lock
level: task
title: "Agent-config scanner with lock parsing"
short_code: "DGEN-T-0030"
created_at: 2026-05-08T20:23:31.203473+00:00
updated_at: 2026-05-08T20:27:21.313527+00:00
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

# Agent-config scanner with lock parsing

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[DGEN-I-0006]]

## Objective

Add an agent-config scanner module that detects known agent files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules/*.md`, `.windsurfrules`, `.claude/`) and parses any "lock" declarations they contain (e.g. "do not modify `eslint.config.*`"). Output is consumed by the comparator/reconcile flow so that "absent-and-file-locked" findings can be classified.

## Files

- New: `dev-genie/skills/project-detection/detect-agent-config.js` (or `dev-genie/lib/agent-config.js`)
- Wire into: `dev-genie/skills/project-detection/detect-config.js` (top-level `detect()` returns `agentConfigs` array)
- Tests: `dev-genie/skills/project-detection/detect-agent-config.test.mjs`

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

- [ ] Scanner detects all of: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.windsurfrules`, every `.cursor/rules/*.md`, every `.claude/**/*.md`.
- [ ] For each file returns `{ path, rawContent, rules: string[], locks: { pattern, reason, sourceLine }[] }`.
- [ ] Lock parser recognizes phrases like "do not modify X", "never edit X", "X is locked", "do not change X", and code-fenced "locked: [glob, ...]" blocks. Patterns may be globs or filenames.
- [ ] Result merged into `detect-config.js` `detect()` output as `agentConfigs`.
- [ ] Unit tests cover: no agent files, plain CLAUDE.md with no locks, CLAUDE.md with explicit lock on `eslint.config.*`, multiple agent files with overlapping locks, `.cursor/rules/` directory.

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

- 2026-05-08: Implemented `detect-agent-config.js` (root files + `.cursor/rules/` + `.claude/`), phrase-based + fenced `locked:` parser, `findLockForPath` glob helper. Wired into `detect-config.js`. 8/8 unit tests pass.