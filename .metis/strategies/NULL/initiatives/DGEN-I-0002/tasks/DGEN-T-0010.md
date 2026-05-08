---
id: author-audit-init-and-audit-run
level: task
title: "Author audit-init and audit-run slash commands"
short_code: "DGEN-T-0010"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:19:02.606436+00:00
parent: DGEN-I-0002
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0002
---

# Author audit-init and audit-run slash commands

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Author the two user-facing slash commands for the audit plugin: `audit/commands/audit-init.md` (one-shot wrapper around the audit-setup skill) and `audit/commands/audit-run.md` (manual ad-hoc scan that updates the baseline).

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/commands/audit-init.md` exists with proper Claude Code slash-command frontmatter and instructs the agent to invoke the `audit-setup` skill end-to-end.
- [ ] `audit/commands/audit-run.md` exists and instructs the agent to run `node audit/scripts/audit.mjs --update` from the repo root, then summarize the resulting composite scores and the most-changed raw metrics for the user.
- [ ] `audit-run.md` calls out that this command intentionally rewrites the baseline (use it after intentional refactors), distinguishing it from the silent `--no-update` invocation done by the pre-commit hook.
- [ ] Both commands handle the "audit not installed" case by suggesting `/audit-init`.
- [ ] Output formatting in `audit-run.md` instructs the agent to print a compact table: composite | previous | current | delta.

## Implementation Notes

### Technical Approach
- Follow the slash-command file format used elsewhere in this repo (e.g., `guardrails/commands/scaffold-architecture.md`).
- Keep the commands thin — they delegate to the skill / script rather than re-implementing logic.

### Dependencies
- DGEN-T-0009 (audit-setup skill) for `audit-init`.
- DGEN-T-0007 (audit.mjs `--update` flag) for `audit-run`.

### Risk Considerations
- Confusion between `audit-run` (rewrites baseline) and the hook (read-only check): make the difference loud in the `audit-run.md` description and in the command's printed output.

## Status Updates

- 2026-05-08: Authored `audit/commands/audit-init.md` (delegates to `audit-setup` skill, asks before privileged installs, handles already-installed case) and `audit/commands/audit-run.md` (rewrites baseline, prints compact 4x4 composite table previous/current/delta, surfaces dominant metric, loudly distinguishes itself from the read-only hook). Format mirrors `guardrails/commands/scaffold-architecture.md`.