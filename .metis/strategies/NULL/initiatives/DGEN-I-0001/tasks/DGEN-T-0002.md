---
id: add-claude-code-plugin-manifest-at
level: task
title: "Add Claude Code plugin manifest at guardrails root"
short_code: "DGEN-T-0002"
created_at: 2026-05-08T18:02:23.697270+00:00
updated_at: 2026-05-08T18:16:09.125149+00:00
parent: DGEN-I-0001
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0001
---

# Add Claude Code plugin manifest at guardrails root

## Parent Initiative

[[DGEN-I-0001]]

## Objective

Create the Claude Code plugin manifest at the root of `guardrails/` so the directory loads as an independent plugin in its new sibling-of-`dev-genie` location. The manifest must declare the plugin's name, description, and any required entry points (commands, skills) such that Claude Code recognizes `guardrails/` standalone — without depending on anything outside its own directory.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] Manifest file exists at `guardrails/` root in the format Claude Code expects for plugins.
- [ ] Manifest `name` clearly identifies this as the guardrails plugin (not the umbrella repo).
- [ ] Manifest `description` reflects the scoped concern: architecture scaffolds, the `scaffold-architecture` command, and per-stack lint/type guard-rail skills — and explicitly does NOT claim the audit or dev-genie concerns.
- [ ] All path references inside the manifest are plugin-local (no escapes outside `guardrails/`).
- [ ] Path-reference fixes identified in DGEN-T-0001 are applied to any non-manifest files needed for the plugin to load cleanly.
- [ ] Loading the plugin via Claude Code in an empty test project surfaces the `scaffold-architecture` command and the expected skills.

## Implementation Notes

### Technical Approach

1. Use the inventory from DGEN-T-0001 to enumerate commands and skills the manifest must register.
2. Author the manifest file at `guardrails/` root.
3. Apply any plugin-local path rewrites flagged in DGEN-T-0001 (manifest-adjacent only — README/SKILL.md prose is DGEN-T-0003).
4. Verify by pointing a clean Claude Code session at `guardrails/` and listing available commands/skills.

### Dependencies

- DGEN-T-0001 (inventory and path-reference audit must be complete).

### Risk Considerations

The exact manifest schema Claude Code expects must be confirmed against current plugin docs; if the schema has shifted, follow the version Claude Code is currently running. Mitigation: cross-check against another known-working plugin layout in the user's environment if uncertain.

## Status Updates

### 2026-05-08 — Manifest scoped

- Renamed `.claude-plugin/plugin.json` `name` from `guard-rails-boilerplate` -> `guardrails`. Bumped version to `0.5.0` to mark the relocation. Description now states this is the guardrails plugin in the dev-genie ecosystem and explicitly disclaims audit (static-analysis/scoring) and dev-genie (umbrella bootstrap) concerns.
- Renamed `.claude-plugin/marketplace.json` plugin `name` (both occurrences) to `guardrails`; description tightened to architecture + lint/type rules.
- Commands and skills are auto-discovered by Claude Code from `commands/` and `skills/`; manifest does not need to enumerate them.
- All manifest references are plugin-local; no escapes outside `guardrails/`.
- Smoke verification of plugin load + command/skill discovery is deferred to DGEN-T-0004 per dependency order.