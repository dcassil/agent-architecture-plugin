---
id: init-dev-genie-into-existing-repos
level: initiative
title: "Init dev-genie into existing repos: detect, compare, and reconcile config"
short_code: "DGEN-I-0005"
created_at: 2026-05-08T19:15:48.221718+00:00
updated_at: 2026-05-08T19:15:48.221718+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/discovery"


exit_criteria_met: false
estimated_complexity: M
strategy_id: NULL
initiative_id: init-dev-genie-into-existing-repos
---

# Init dev-genie into existing repos Initiative

## Context **[REQUIRED]**

Today `/dev-genie-init` has been dogfooded primarily on greenfield/empty repos. Real-world adoption means dropping it into an **existing codebase** that already has *some* config: an `eslint.config.*` (or legacy `.eslintrc`), a `tsconfig.json`, possibly a `.prettierrc`, possibly Husky/lefthook/pre-commit, possibly CI build steps, and possibly partial audit config.

Naively overwriting these would destroy user work and erode trust. Skipping them entirely means dev-genie's guard rails aren't actually enforced. We need an **init-into-existing-repo** flow that detects what exists, compares it against dev-genie's recommended baseline, surfaces gaps and weaknesses, and asks before changing anything.

## Goals & Non-Goals **[REQUIRED]**

**Goals:**
- Detect existing lint/type/format/hook/CI config in a target repo without modifying it.
- Compare detected config against the recommended dev-genie baseline (from the relevant `arch-*` skill + universal-guard-rails) and produce a diff/report: missing rules, weaker-than-recommended rules, conflicting rules.
- For each gap, present a clear suggestion ("your eslint allows `any` — recommend enabling `@typescript-eslint/no-explicit-any: error`") and ask before applying.
- Verify lint/typecheck run on **build** and **pre-commit**; offer to wire them up if missing (Husky/lefthook/pre-commit, package.json scripts, CI step).
- Detect whether audit config (`.audit/`, audit pre-commit hook, composite scoring baseline) exists; offer to add the missing pieces.
- Never silently overwrite user config. Every change is opt-in.

**Non-Goals:**
- Auto-fixing existing lint violations in user code (only config changes).
- Migrating legacy `.eslintrc` → flat config automatically (detect + recommend, but don't rewrite).
- Supporting non-TypeScript repos in this initiative (Python/Go/etc. are future work).
- Replacing the existing greenfield `/dev-genie-init` flow — this extends it.

## Detailed Design **[REQUIRED]**

High-level flow for `/dev-genie-init` when run in a non-empty repo:

1. **Detect** — scan for: `eslint.config.*`, `.eslintrc*`, `tsconfig*.json`, `.prettierrc*`, `package.json` scripts, `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, CI files (`.github/workflows/*`, etc.), `.audit/` directory and audit hook.
2. **Classify architecture** — reuse existing `project-detection` skill to pick the right `arch-*` baseline (next-vercel, node-api, supabase-api).
3. **Compare** — load the recommended config from the selected `arch-*` skill + `universal-guard-rails`; diff against detected config. Produce a structured report (rule-by-rule: present/missing/weaker/conflicting).
4. **Propose** — for each finding, generate a human-readable suggestion with rationale and the exact change. Group by severity (critical / recommended / optional).
5. **Confirm + apply** — ask per group (or per finding for high-impact changes). Only apply approved changes. Leave a summary of what changed and what was skipped.
6. **Wire enforcement** — verify `lint` + `typecheck` (and `audit` if installed) run on pre-commit and on build/CI. Offer to add missing hooks/scripts.

Key design questions to resolve during decomposition:
- How is the "recommended baseline" expressed so it's diffable? (Inline in skills as today, or extracted into a machine-readable config file the comparator reads?)
- Do we run the user's existing eslint to learn its *effective* config (`eslint --print-config`) rather than parsing the file? This handles `extends` chains correctly.
- How granular should confirmation prompts be? (Per-rule is noisy; per-group risks bundling unwanted changes.)

## Alternatives Considered **[REQUIRED]**

- **Overwrite everything**: fastest, but destroys user work — rejected.
- **Refuse to init when config exists**: safe but useless for the actual adoption case — rejected.
- **Detect-only / report-only mode**: useful as a sub-mode, but doesn't deliver the "set up guard rails" value alone. Likely included as a `--dry-run` flag.

## Implementation Plan **[REQUIRED]**

To be decomposed into tasks. Likely shape:
1. Detection module (filesystem + parse + `eslint --print-config`).
2. Baseline extraction — make recommended config queryable from `arch-*` skills.
3. Comparator + report generator.
4. Interactive confirm/apply flow in `/dev-genie-init`.
5. Pre-commit / build / CI enforcement detection + wire-up.
6. Audit-config reconciliation.
7. Dogfood on 1–2 real existing repos.

## Requirements **[CONDITIONAL: Requirements-Heavy Initiative]**

{Delete if not a requirements-focused initiative}

### User Requirements
- **User Characteristics**: {Technical background, experience level, etc.}
- **System Functionality**: {What users expect the system to do}
- **User Interfaces**: {How users will interact with the system}

### System Requirements
- **Functional Requirements**: {What the system should do - use unique identifiers}
  - REQ-001: {Functional requirement 1}
  - REQ-002: {Functional requirement 2}
- **Non-Functional Requirements**: {How the system should behave}
  - NFR-001: {Performance requirement}
  - NFR-002: {Security requirement}

## Use Cases **[CONDITIONAL: User-Facing Initiative]**

{Delete if not user-facing}

### Use Case 1: {Use Case Name}
- **Actor**: {Who performs this action}
- **Scenario**: {Step-by-step interaction}
- **Expected Outcome**: {What should happen}

### Use Case 2: {Use Case Name}
- **Actor**: {Who performs this action}
- **Scenario**: {Step-by-step interaction}
- **Expected Outcome**: {What should happen}

## Architecture **[CONDITIONAL: Technically Complex Initiative]**

{Delete if not technically complex}

### Overview
{High-level architectural approach}

### Component Diagrams
{Describe or link to component diagrams}

### Class Diagrams
{Describe or link to class diagrams - for OOP systems}

### Sequence Diagrams
{Describe or link to sequence diagrams - for interaction flows}

### Deployment Diagrams
{Describe or link to deployment diagrams - for infrastructure}

## Detailed Design **[REQUIRED]**

{Technical approach and implementation details}

## UI/UX Design **[CONDITIONAL: Frontend Initiative]**

{Delete if no UI components}

### User Interface Mockups
{Describe or link to UI mockups}

### User Flows
{Describe key user interaction flows}

### Design System Integration
{How this fits with existing design patterns}

## Testing Strategy **[CONDITIONAL: Separate Testing Initiative]**

{Delete if covered by separate testing initiative}

### Unit Testing
- **Strategy**: {Approach to unit testing}
- **Coverage Target**: {Expected coverage percentage}
- **Tools**: {Testing frameworks and tools}

### Integration Testing
- **Strategy**: {Approach to integration testing}
- **Test Environment**: {Where integration tests run}
- **Data Management**: {Test data strategy}

### System Testing
- **Strategy**: {End-to-end testing approach}
- **User Acceptance**: {How UAT will be conducted}
- **Performance Testing**: {Load and stress testing}

### Test Selection
{Criteria for determining what to test}

### Bug Tracking
{How defects will be managed and prioritized}

## Alternatives Considered **[REQUIRED]**

{Alternative approaches and why they were rejected}

## Implementation Plan **[REQUIRED]**

{Phases and timeline for execution}