---
id: inventory-guardrails-contents-and
level: task
title: "Inventory guardrails contents and audit path references"
short_code: "DGEN-T-0001"
created_at: 2026-05-08T18:02:23.697270+00:00
updated_at: 2026-05-08T18:14:50.536341+00:00
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

# Inventory guardrails contents and audit path references

## Parent Initiative

[[DGEN-I-0001]]

## Objective

Produce a complete inventory of everything currently inside `guardrails/` and identify every path reference, import, or instruction that assumes the old single-plugin repo root rather than the new plugin-local root. This is the prerequisite information-gathering pass that drives the manifest, README, and smoke-test work in the rest of the initiative.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] Inventory document (can be inline notes in this task's Status Updates) listing every subdirectory under `guardrails/`: `architectures/` (node-api, react-next-vercel-webapp, supabase-api, supabase-node-rag), the `scaffold-architecture` command file, and all skills (`universal-guard-rails`, `guard-rails-catalog`, the four `arch-*` skills).
- [ ] List of every file inside `guardrails/` that contains a path reference, with the exact reference string and a note on whether it is plugin-local-correct or assumes the old root.
- [ ] Each problematic reference is tagged with the proposed plugin-local rewrite (no edits performed yet — that is downstream work in DGEN-T-0002 / DGEN-T-0003).
- [ ] Confirmation that no file in `guardrails/` reaches outside its own directory (no `../` escapes, no references to sibling plugins `dev-genie/` or `audit/`).

## Implementation Notes

### Technical Approach

1. Walk `guardrails/` and record the tree.
2. Grep for path-shaped tokens: `architectures/`, `skills/`, `commands/`, `./`, `../`, repo-root-style absolute references, and any hardcoded `gaurd-rails-boilerplate` or old-repo names.
3. Open the `scaffold-architecture` command and each skill's `SKILL.md` and check for embedded paths in instructions.
4. Capture findings in this task's Status Updates section as a checklist consumed by DGEN-T-0002 and DGEN-T-0003.

### Dependencies

None. This task unblocks DGEN-T-0002 and DGEN-T-0003.

### Risk Considerations

Risk of missing a reference embedded in skill prose rather than in code; mitigate by reading every `SKILL.md` end-to-end, not just grepping.

## Status Updates

### 2026-05-08 — Inventory complete

**Tree under `guardrails/`:**
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- `architectures/README.md`
- `architectures/node-api/{README.md, eslint.config.mjs, tsconfig.json}`
- `architectures/react-next-vercel-webapp/{README.md, eslint.config.mjs, tsconfig.json}`
- `architectures/supabase-api/{README.md, eslint.config.mjs, tsconfig.json}`
- `architectures/supabase-node-rag/{README.md, eslint.config.mjs, tsconfig.json}`
- `commands/scaffold-architecture.md`
- `skills/universal-guard-rails/SKILL.md`
- `skills/guard-rails-catalog/SKILL.md`
- `skills/arch-next-vercel/SKILL.md`
- `skills/arch-node-api/SKILL.md`
- `skills/arch-supabase-api/SKILL.md`
- `skills/arch-supabase-node-rag/SKILL.md`

**Boundary check:** No file in `guardrails/` references `../` outside its own directory; the only `../` tokens are intra-`architectures/` cross-references and lint-glob patterns. No references to `dev-genie/` or `audit/`.

**Path / scope reference audit:**

| File | Line(s) | Reference | Verdict | Proposed rewrite (downstream tasks) |
|---|---|---|---|---|
| `.claude-plugin/plugin.json` | 2 | `"name": "guard-rails-boilerplate"` | Umbrella-flavored (old single-plugin repo name) | Rename to `guardrails` (plugin-scoped). T-0002. |
| `.claude-plugin/plugin.json` | 4 | description: "Architecture pattern catalog with strict ESLint + TypeScript guard rails..." | OK in scope but should explicitly disclaim audit/dev-genie concerns | Tighten description, add disclaimer. T-0002. |
| `.claude-plugin/marketplace.json` | 2,9 | `"name": "guard-rails-boilerplate"` (twice) | Same as above | Rename to `guardrails`. T-0002. |
| `commands/scaffold-architecture.md` | 6 | "scaffolding a project from the guard-rails-boilerplate catalog" | Old umbrella name | "from the guardrails plugin's architecture catalog". T-0003 (prose). |
| `commands/scaffold-architecture.md` | 21 | "The catalog lives at the root of this repo under `architectures/<pattern>/`. If you can't find it relative to the current working directory, ask the user for the path to the `gaurd-rails-boilerplate` repo." | Assumes old single-plugin repo root; mentions old repo name | Rewrite: catalog lives inside this plugin at `${CLAUDE_PLUGIN_ROOT}/architectures/<pattern>/` (or "this plugin's `architectures/<pattern>/` directory"). Drop the old-repo fallback. T-0003. |
| `architectures/README.md` | 17-19 | Lists only 3 patterns; missing `supabase-node-rag` | Stale, not a path bug but scope-relevant | Add `supabase-node-rag/` to the list. T-0003. |
| `architectures/react-next-vercel-webapp/README.md` | 16 | "see `../node-api/`" | Intra-`architectures/` link, plugin-local-correct | No change. |
| `architectures/supabase-api/eslint.config.mjs` | 54-56 | `'../*/index.ts'` etc. | ESLint glob pattern — not a filesystem path | No change. |
| `skills/*/SKILL.md` (all six) | various | `architectures/<name>/`, `_shared/`, `lib/server/*`, etc. | Plugin-local or describing target-project layout | No path change. T-0003 may tighten description sentences for scope clarity. |
| `skills/guard-rails-catalog/SKILL.md` | 8 | "This project is a catalog of TypeScript architecture patterns" | Implies guardrails IS the project, not one plugin among siblings | Rephrase: "This plugin is a catalog..." T-0003. |
| `skills/guard-rails-catalog/SKILL.md` | 19 | "Patterns live under `architectures/<name>/` in this repo." | "in this repo" implies single-plugin repo | "in this plugin." T-0003. |

**Top-level README:** No `guardrails/README.md` exists yet. T-0003 must create one.

**No file in `guardrails/` reaches outside its own directory. Confirmed.**

Inventory complete; T-0002 and T-0003 unblocked.