---
id: build-dev-genie-meta-plugin
level: initiative
title: "Build dev-genie meta-plugin bootstrap"
short_code: "DGEN-I-0003"
created_at: 2026-05-08T17:52:24.129657+00:00
updated_at: 2026-05-08T18:24:11.758652+00:00
parent: DGEN-V-0001
blocked_by: [DGEN-I-0001, DGEN-I-0002]
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: M
strategy_id: NULL
initiative_id: build-dev-genie-meta-plugin
---

# Build dev-genie meta-plugin bootstrap

## Context

`dev-genie/` is the umbrella plugin users discover first. Its only job is to instruct the agent to install and wire up the underlying sub-plugins (`guardrails/`, `audit/`, future ones) for a given project. It owns no scoring logic, no scaffolds, and no per-stack rules — those live in the sub-plugins. This initiative is blocked on the first two because there is nothing to bootstrap until `guardrails/` is standalone and `audit/` exists.

## Goals & Non-Goals

**Goals:**
- A `dev-genie/` plugin with a single discoverable setup command (e.g. `/dev-genie-init`) that:
  - Detects basic project type (greenfield vs. existing, primary language/stack if obvious).
  - Walks the agent through installing `guardrails` and `audit` plugins (or confirms they're already installed).
  - Invokes each sub-plugin's own setup flow in the right order (guardrails first if scaffolding, audit second to take baseline against the result).
  - Leaves the project with: guardrails skills active, an architecture chosen (or skipped), `.audit/` seeded, pre-commit hook installed.
- A skill (`dev-genie/skills/orchestration/SKILL.md`) that documents the install order and dependencies between sub-plugins so future plugins can be added by extending one list.

**Non-Goals:**
- No re-implementing sub-plugin behavior. dev-genie delegates.
- No auto-installing third-party tools beyond what sub-plugins request.
- No project-type auto-detection beyond simple heuristics (presence of `package.json`, `Cargo.toml`, etc.).

## Detailed Design

- `dev-genie/commands/dev-genie-init.md` — the entry-point slash command.
- `dev-genie/skills/orchestration/SKILL.md` — declares the ordered list of sub-plugins, each with: install check, setup-command invocation, post-setup verification.
- `dev-genie/skills/project-detection/SKILL.md` — small heuristics skill the orchestration skill calls.
- The sub-plugin registry is a hard-coded list inside the orchestration skill (not a config file): adding a new sub-plugin = editing one markdown file.

## Alternatives Considered

- **Make dev-genie a single big plugin** with guardrails + audit folded in. Rejected per the vision's composability principle.
- **Auto-install plugins via shell** without agent involvement. Rejected: the Claude Code plugin install flow is user-mediated; trying to bypass it fights the harness.

## Implementation Plan

1. Define the orchestration skill (sub-plugin list + ordering rules).
2. Build the project-detection skill.
3. Write the `/dev-genie-init` command that drives both.
4. Dogfood on a fresh empty repo: run init, end up with a working stack + guardrails + audit baseline + hook.