---
id: smoke-test-marketplace-json
level: task
title: "Smoke-test marketplace JSON validity and source paths"
short_code: "DGEN-T-0018"
created_at: 2026-05-08T19:12:03.051840+00:00
updated_at: 2026-05-08T19:13:54.135748+00:00
parent: DGEN-I-0004
blocked_by: [DGEN-T-0017]
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0004
---

# Smoke-test marketplace JSON validity and source paths

## Parent Initiative

[[DGEN-I-0004]]

## Objective

Verify the new manifests and root marketplace are well-formed and internally consistent. Per the initiative caller's guidance, a full Claude Code interactive install test is not required — JSON validity plus path/name consistency is sufficient.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] All three `plugin.json` files parse as valid JSON.
- [ ] Root `.claude-plugin/marketplace.json` parses as valid JSON.
- [ ] Every `source` path in the root marketplace resolves to a directory containing `.claude-plugin/plugin.json`.
- [ ] Each marketplace entry's `name` matches the `name` field in the corresponding `plugin.json`.
- [ ] Nested `guardrails/.claude-plugin/marketplace.json` is gone.

## Implementation Notes

### Technical Approach
- Run `python -m json.tool <file>` on each JSON file.
- For each marketplace plugin entry, verify `<repo>/<source>/.claude-plugin/plugin.json` exists and that its `name` field equals the entry's `name`.
- Record results in Status Updates.

### Dependencies
- DGEN-T-0017.

## Status Updates

- 2026-05-08: Smoke test passed. All 4 JSON files parse cleanly. All 3 marketplace entries resolve to existing `.claude-plugin/plugin.json` files with matching `name` fields (dev-genie, guardrails, audit). Nested `guardrails/.claude-plugin/marketplace.json` confirmed deleted.