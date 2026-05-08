---
id: author-plugin-json-manifests-for
level: task
title: "Author plugin.json manifests for audit and dev-genie"
short_code: "DGEN-T-0016"
created_at: 2026-05-08T19:12:03.051840+00:00
updated_at: 2026-05-08T19:13:26.485848+00:00
parent: DGEN-I-0004
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0004
---

# Author plugin.json manifests for audit and dev-genie

## Parent Initiative

[[DGEN-I-0004]]

## Objective

Create `audit/.claude-plugin/plugin.json` and `dev-genie/.claude-plugin/plugin.json` manifests so Claude Code recognizes both directories as installable plugins. Mirror the structure of the existing `guardrails/.claude-plugin/plugin.json`.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/.claude-plugin/plugin.json` exists with `name: "audit"`, version, description scoped to composite scoring + pre-commit hook, author block, and relevant keywords.
- [ ] `dev-genie/.claude-plugin/plugin.json` exists with `name: "dev-genie"`, version, description scoped to umbrella bootstrap (`/dev-genie-init`, ecosystem orchestration), author block, and relevant keywords.
- [ ] Both files are valid JSON.
- [ ] Author block matches `guardrails`: name "Daniel Cassil", email "me@danielcassil.com".

## Implementation Notes

### Technical Approach
- Reference `guardrails/.claude-plugin/plugin.json` for required fields (`name`, `version`, `description`, `author`, `keywords`).
- `audit` description should reference: composite scoring, pre-commit hook, ESLint/TS/test/security check aggregation. Keywords: `audit`, `quality`, `pre-commit`, `eslint`, `typescript`, `scoring`.
- `dev-genie` description should reference: umbrella plugin, `/dev-genie-init` orchestration, project detection, installs guardrails+audit. Keywords: `dev-genie`, `bootstrap`, `orchestration`, `scaffold`.
- Start version at `0.1.0` for both (new manifests) unless prior history says otherwise.

### Dependencies
None. Blocks DGEN-T-0017.

## Status Updates

- 2026-05-08: Created `audit/.claude-plugin/plugin.json` and `dev-genie/.claude-plugin/plugin.json`. Both validated with `python3 -m json.tool`. Author/keywords/version match plan. Acceptance criteria met.