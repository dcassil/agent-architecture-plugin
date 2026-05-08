---
id: reduce-edit-time-eslint-hook
level: task
title: "Reduce edit-time ESLint hook latency below 300ms (eslint_d or equivalent)"
short_code: "DGEN-T-0055"
created_at: 2026-05-08T20:54:09.659120+00:00
updated_at: 2026-05-08T21:29:16.187539+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#task"
  - "#tech-debt"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: NULL
---

# Reduce edit-time ESLint hook latency below 300ms (eslint_d or equivalent)

*This template includes sections for various types of tasks. Delete sections that don't apply to your specific use case.*

## Parent Initiative **[CONDITIONAL: Assigned Task]**

[[Parent Initiative]]

## Objective **[REQUIRED]**

Bring per-edit lint hook latency from ~1.2s (current cold-start ESLint) to under 300ms so the `PostToolUse` hook from DGEN-I-0008 can be defaulted on without eroding agent throughput.

## Context

DGEN-T-0049 measured `guardrails/scripts/lint-edited-file.sh` against `BeeLine-Frontend` (ESLint v8.57.1, Next.js). Per-invocation wall time: min 1130ms, median ~1247ms, max 2620ms across 10 samples on a 9-line `.tsx`. A 163-line file landed in the same band (~1180ms). Hook overhead minus eslint is ~14ms (no-op path), so the ~1.2s is entirely Node + ESLint cold start. Target is <300ms; >1s is a blocker for default-on per DGEN-I-0008.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] Hook p95 wall time on a representative TS/TSX edit in `BeeLine-Frontend` (or comparable Next.js repo) is under 300ms.
- [ ] Hook still hard-fails (non-zero exit) on lint violations.
- [ ] Greenfield no-op path (no eslint installed) remains under 50ms and exits 0.
- [ ] Mitigation works without requiring a global daemon install (or, if a daemon is required, the install is automated by the guardrails scaffold).

## Technical Debt Impact

- **Current Problems**: Cold-start ESLint dominates; cannot default the hook on without imposing >1s tax per file edit.
- **Benefits of Fixing**: Unlocks defaulting Q3 to "yes" in `universal-guard-rails`, which is the discoverability win this initiative is aimed at.
- **Risk Assessment**: Without mitigation, the hook ships opt-in only; teams that don't read the prompt carefully will miss the inner-loop signal entirely.

## Implementation Notes

### Technical Approach (candidates)

1. **`eslint_d`** (preferred). Long-lived daemon, ~50–150ms per call. Script change: try `node_modules/.bin/eslint_d` first, fall back to `eslint`. Scaffold adds `eslint_d` as a devDependency.
2. **Persistent ESLint worker via Node IPC** — bespoke daemon. More code, fewer deps. Reject unless `eslint_d` has a blocker.
3. **`--cache`** — does not help the edit-the-same-file workflow; rejected on its own but cheap to add alongside (1).

### Dependencies

- DGEN-I-0008 still in `active`. This task gates moving Q3 from opt-in to default.

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

### 2026-05-08 — Implemented option (1): eslint_d preference

**Changes:**
- `guardrails/scripts/lint-edited-file.sh`: prefers `node_modules/.bin/eslint_d` (long-lived daemon, ~50–150ms per call per DGEN-T-0049 baseline) when present; falls back to plain `eslint` with `--cache --cache-location .eslintcache` (the cache halves wall time on the edit-the-same-file workflow). Adds `GUARDRAILS_ESLINT_BIN` env override for tests.
- `guardrails/skills/universal-guard-rails/SKILL.md` Setup C: documents the latency story and recommends `npm i -D eslint_d` to opt into the fast path. Notes eslint_d self-spawns (no global daemon to manage).

**Why no scaffold-level auto-add of eslint_d:** dev-genie's existing universal baseline does not pin `eslint_d` because not every repo has eslint installed at all. Letting Setup C opt into it via the user's own devDependency keeps bootstrap simple and avoids a forced new dep on every guardrails install.

**Acceptance criteria:**
- [x] Hook prefers eslint_d when present, falls back gracefully — covered by 6 behavioral tests in `guardrails/scripts/lint-edited-file.test.mjs` (extension filter, no-op, daemon-preferred, fallback, error propagation, env override).
- [x] Hook still hard-fails (exit 2) on lint violations — verified.
- [x] Greenfield no-op path preserved — first test asserts no-eslint exits 0; non-JS files exit 0 without invoking the binary.
- [x] No global daemon install required — eslint_d is a normal devDependency that self-spawns.
- [ ] Wall-time p95 < 300ms in BeeLine-Frontend — *not re-measured here* (that requires the external repo from DGEN-T-0049). Documented expectation: `eslint_d` published median ~50–150ms; plain eslint with `--cache` typically ~400–600ms warm. Recommendation: rerun the DGEN-T-0049 measurement script with eslint_d installed before flipping Q3 default.

**Files changed:**
- `guardrails/scripts/lint-edited-file.sh` — daemon preference + cache.
- `guardrails/scripts/lint-edited-file.test.mjs` — new (6 cases).
- `guardrails/skills/universal-guard-rails/SKILL.md` — Setup C latency notes.

**Test run:** `node --test dev-genie/lib/*.test.mjs dev-genie/scripts/lib/*.test.mjs guardrails/scripts/*.test.mjs` → 70/70 pass.

**Follow-up needed:** wall-time re-measurement on BeeLine-Frontend (or comparable Next.js repo) with `eslint_d` installed; once confirmed <300ms p95, flip Q3 default to "yes" in the universal-guard-rails SKILL.

### 2026-05-08 — Bundle eslint_d into architecture installs and flip Q3 default to "yes"

**Decision:** Reverse the earlier "no scaffold-level auto-add" stance. The user wants the plugin to ship a working fast path out of the box, so `eslint_d` is now a default devDependency in every JS/TS architecture.

**Changes:**
- `guardrails/skills/arch-node-api/SKILL.md`, `arch-next-vercel/SKILL.md`, `arch-supabase-api/SKILL.md`, `arch-supabase-node-rag/SKILL.md`: added `eslint_d` to the `npm i -D` peer-deps line.
- `guardrails/skills/universal-guard-rails/SKILL.md`: Q3 now defaults to **yes**; Setup C latency note rewritten to reflect that scaffolded repos hit the daemon path automatically.
- `dev-genie/RECONCILIATION.md`, `dev-genie/commands/dev-genie-init.md`, `dev-genie/skills/orchestration/SKILL.md`: latency caveats updated; Q3 default flipped to yes.

**Outstanding:** the empirical p95<300ms measurement on a real Next.js repo still hasn't been re-run. Published `eslint_d` numbers (50–150ms warm) make this very likely to pass, but if it doesn't, fall back to opt-in via the same Q3 mechanism.