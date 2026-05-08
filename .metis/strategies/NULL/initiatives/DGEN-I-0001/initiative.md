---
id: extract-guardrails-into-standalone
level: initiative
title: "Extract guardrails into standalone plugin"
short_code: "DGEN-I-0001"
created_at: 2026-05-08T17:52:24.129657+00:00
updated_at: 2026-05-08T18:20:09.418423+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: S
strategy_id: NULL
initiative_id: extract-guardrails-into-standalone
---

# Extract guardrails into standalone plugin

## Context

The original `gaurd-rails-boilerplate` repo was a single Claude Code plugin holding architecture scaffolds, a `scaffold-architecture` command, and skills. We are now splitting the repo into multiple sibling plugins under one umbrella (`dev-genie/`, `guardrails/`, `audit/`). The existing plugin contents have been moved into `guardrails/` but it has not yet been verified to load and function as a standalone plugin in its new location, nor has its self-description been updated to reflect that it is now one of several plugins rather than the whole project.

## Goals & Non-Goals

**Goals:**
- `guardrails/` loads as an independent Claude Code plugin without depending on anything outside its own directory.
- All existing skills (`universal-guard-rails`, `guard-rails-catalog`, the four `arch-*` skills), the `scaffold-architecture` command, and the `architectures/` content continue to work as they did before the move.
- Plugin manifest (name, description, README) reflects that this plugin owns the architecture/scaffold/lint-rule concern only.

**Non-Goals:**
- No new architectures, skills, or rules. Pure relocation + manifest cleanup.
- No coupling to `audit/` or `dev-genie/`.

## Detailed Design

1. Audit `guardrails/` for any path references that assumed the old root and rewrite them to be plugin-local.
2. Add/update the plugin manifest expected by Claude Code at `guardrails/` root.
3. Update the README/SKILL.md descriptions to scope the plugin to architecture + lint/type rules.
4. Smoke-test by invoking the `scaffold-architecture` command and one `arch-*` skill against a throwaway target dir.

## Alternatives Considered

- **Leave guardrails as the umbrella** and add audit as a sub-feature. Rejected: violates the "small composable plugins" principle in the vision and forces users who only want audit to install scaffolds they don't need.

## Implementation Plan

1. Inventory current `guardrails/` contents and references.
2. Add manifest + scoped README.
3. Smoke-test load + one command + one skill.
4. Mark complete when the plugin works standalone.