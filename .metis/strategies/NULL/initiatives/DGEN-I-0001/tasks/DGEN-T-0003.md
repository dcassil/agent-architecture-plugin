---
id: scope-readme-and-skill-md
level: task
title: "Scope README and SKILL.md descriptions to guardrails plugin"
short_code: "DGEN-T-0003"
created_at: 2026-05-08T18:02:23.697270+00:00
updated_at: 2026-05-08T18:16:12.148574+00:00
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

# Scope README and SKILL.md descriptions to guardrails plugin

## Parent Initiative

[[DGEN-I-0001]]

## Objective

Rewrite the `guardrails/` README and every `SKILL.md` description so they describe this plugin as one of several siblings under the dev-genie umbrella, scoped strictly to architecture scaffolds, the `scaffold-architecture` command, and per-stack lint/type guard-rail skills. Remove or rephrase any wording inherited from the original single-plugin repo that implies guardrails owns the whole project, the audit concern, or the dev-genie bootstrap concern.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `guardrails/README.md` opens by stating this is the guardrails plugin within the dev-genie ecosystem and lists its concerns (architectures, scaffold command, guard-rail skills).
- [ ] README explicitly disclaims responsibilities owned by `audit/` (static-analysis, scoring, pre-commit hook) and `dev-genie/` (umbrella bootstrap).
- [ ] Each `SKILL.md` (`universal-guard-rails`, `guard-rails-catalog`, four `arch-*` skills) has a description sentence that is accurate at the plugin scope and uses plugin-local paths only.
- [ ] No prose in README or any `SKILL.md` references the old repo root, sibling plugins' internals, or files outside `guardrails/`.
- [ ] Path references flagged in DGEN-T-0001 that live in prose (not manifest) are corrected here.

## Implementation Notes

### Technical Approach

1. Pull the prose-level findings from DGEN-T-0001's inventory.
2. Rewrite `guardrails/README.md` top-to-bottom to match the scoped description from DGEN-I-0001 ("architecture + lint/type rules only").
3. Walk each skill's `SKILL.md` and tighten the description and any referenced paths.
4. Re-grep for the old repo name and umbrella terms to confirm clean scoping.

### Dependencies

- DGEN-T-0001 (inventory).
- Can run in parallel with DGEN-T-0002, but final smoke-test (DGEN-T-0004) should follow both.

### Risk Considerations

Skill descriptions are how the agent decides when to invoke a skill — over-trimming can break discoverability. Mitigation: keep trigger keywords from the original descriptions intact while removing scope-creep claims.

## Status Updates

### 2026-05-08 — Prose scoping complete

- Created `guardrails/README.md` (new file) opening with "The guardrails plugin is one plugin in the dev-genie ecosystem"; lists scope (architectures, scaffold command, guard-rail skills) and explicitly disclaims `audit/` (static-analysis/scoring) and `dev-genie/` (umbrella bootstrap) responsibilities. Includes layout diagram and typical flow.
- `commands/scaffold-architecture.md`:
  - Replaced "scaffolding a project from the guard-rails-boilerplate catalog" with "from the guardrails plugin's architecture catalog".
  - Replaced the "catalog lives at the root of this repo... ask user for path to gaurd-rails-boilerplate repo" instruction with a plugin-local resolution rule using `${CLAUDE_PLUGIN_ROOT}/architectures/<pattern>/`. Removed the old-repo fallback.
- `architectures/README.md`: added missing `supabase-node-rag/` pattern to the listed patterns.
- `skills/guard-rails-catalog/SKILL.md`:
  - Replaced "This project is a catalog..." with "This plugin (the `guardrails` plugin in the dev-genie ecosystem) is a catalog..."
  - Replaced "Patterns live under `architectures/<name>/` in this repo." with "...in this plugin."
- Other `SKILL.md` files (`universal-guard-rails`, `arch-next-vercel`, `arch-node-api`, `arch-supabase-api`, `arch-supabase-node-rag`): descriptions and trigger keywords already accurate at plugin scope; references to `architectures/<name>/` are plugin-local; no edits needed. Trigger keywords preserved (no over-trimming risk).
- Final grep for `gaurd-rails-boilerplate`, `guard-rails-boilerplate`, "in this repo", "this project is" inside `guardrails/`: zero matches.