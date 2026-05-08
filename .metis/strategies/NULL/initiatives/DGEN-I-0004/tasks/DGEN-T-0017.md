---
id: create-root-marketplace-json-and
level: task
title: "Create root marketplace.json and remove nested guardrails marketplace"
short_code: "DGEN-T-0017"
created_at: 2026-05-08T19:12:03.051840+00:00
updated_at: 2026-05-08T19:13:42.285063+00:00
parent: DGEN-I-0004
blocked_by: [DGEN-T-0016]
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0004
---

# Create root marketplace.json and remove nested guardrails marketplace

## Parent Initiative

[[DGEN-I-0004]]

## Objective

Create the repo-root `.claude-plugin/marketplace.json` listing all three plugins (`dev-genie`, `guardrails`, `audit`) so adding this repo as a Claude Code marketplace surfaces the full ecosystem. Delete the now-redundant `guardrails/.claude-plugin/marketplace.json` per the initiative's design decision.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `.claude-plugin/marketplace.json` exists at repo root.
- [ ] Marketplace `name` is `dev-genie`; `owner` block matches author info from plugin.json files.
- [ ] `plugins` array lists `dev-genie` first, then `guardrails`, then `audit`, each with `source` as a relative path (`./dev-genie`, `./guardrails`, `./audit`) and an accurate description.
- [ ] `guardrails/.claude-plugin/marketplace.json` is deleted.
- [ ] Root `marketplace.json` is valid JSON.

## Implementation Notes

### Technical Approach
- Use the JSON shape from the initiative's Detailed Design as the template.
- Descriptions should be one-liners summarizing each plugin's scope (consistent with their plugin.json descriptions).
- `dev-genie` listed first so users discover it as the entry point.

### Dependencies
- DGEN-T-0016 (manifests must exist so source paths resolve to valid plugins).

## Status Updates

- 2026-05-08: Created `/.claude-plugin/marketplace.json` listing dev-genie, guardrails, audit (in that order). Deleted `guardrails/.claude-plugin/marketplace.json`. Root JSON validated.