---
id: author-audit-setup-skill
level: task
title: "Author audit-setup skill"
short_code: "DGEN-T-0009"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:18:37.016463+00:00
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

# Author audit-setup skill

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Create `audit/skills/audit-setup/SKILL.md` — the agentic skill that walks an AI agent (or developer) through the full one-time setup of the audit plugin in a host repo: install required binaries, seed `.audit/audit.config.json`, take a baseline scan, and install the pre-commit hook.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/skills/audit-setup/SKILL.md` exists with proper Claude Code skill frontmatter (name, description, when to invoke).
- [ ] Description includes trigger phrases: "set up audit", "install audit plugin", "configure code audit", "add pre-commit quality gate".
- [ ] Skill instructs the agent in numbered steps:
  1. Verify Node 18+ is available; abort with install instructions if not.
  2. Install `dependency-cruiser` and `scc` (document both global and project-local install paths; pick project-local when the host repo has a package.json, otherwise global).
  3. Create `.audit/` directory in the host repo and seed `.audit/audit.config.json` with default baselines (good/bad cutoffs per raw metric) and `regressionThreshold: 5`, `requireImprovement: false`.
  4. Run `node audit/scripts/audit.mjs --update` to take the baseline.
  5. Run `bash audit/scripts/install-hook.sh` to install the pre-commit hook.
  6. Verify the hook by staging a no-op change and running the hook directly.
- [ ] Skill includes a default-baselines block (good/bad cutoff values for each raw metric in `ScanMetrics`) the agent can drop into the seeded config.
- [ ] Skill calls out the `requireImprovement` flag and when to use it (active refactor campaigns only).
- [ ] Skill notes the `.audit/audit.results.json` file should be committed to source control so all developers share the same baseline.

## Implementation Notes

### Technical Approach
- Mirror the structure of existing `guardrails/skills/*/SKILL.md` files for consistency with the rest of the repo.
- Provide the default baselines inline as a code-fenced JSON block.

### Dependencies
- DGEN-T-0007 (audit.mjs) and DGEN-T-0008 (install-hook.sh) must exist for the skill's instructions to be runnable.

### Risk Considerations
- Cross-platform install: scc is distributed as a Go binary with platform-specific download URLs. Prefer `brew install scc` / `go install` paths and document fallback.
- Don't over-prescribe binary install method — let the agent pick based on host repo's package manager / OS.

## Status Updates

- 2026-05-08: Authored `audit/skills/audit-setup/SKILL.md` with Claude Code skill frontmatter (name, description with all required trigger phrases, when_to_invoke).
- 7-step procedure: Node 18+ check, depcruise + scc install (project-local vs global decision tree, brew/go install paths for scc), create `.audit/` and seed config with default baselines (inline JSON block), `--update` baseline scan, install hook via `install-hook.sh`, verify by running hook directly, commit `.audit/` files.
- Calls out `requireImprovement` as refactor-only; documents that `.audit/audit.results.json` must be committed; reminds that the hook is read-only.