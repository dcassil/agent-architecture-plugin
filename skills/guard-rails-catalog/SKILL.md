---
name: guard-rails-catalog
description: Use when starting a new TypeScript project, choosing an architecture, or asking which boilerplate to copy. Indexes the architecture pattern catalog (Next.js + Vercel, Node API, Supabase) and routes to the right per-architecture skill.
---

# Guard Rails Boilerplate Catalog

This project is a **catalog of TypeScript architecture patterns**. Each pattern ships a `README.md` (the architecture spec) plus starter `eslint.config.mjs` and `tsconfig.json` that encode the rules into automated checks.

## Available architectures

| Pattern | When to use | Skill |
|---|---|---|
| `react-next-vercel-webapp` | Vercel-hosted product webapp; UI + thin BFF in one repo | `arch-next-vercel` |
| `node-api` | Standalone backend service with real domain logic, layered (routes → handlers → services → repos) | `arch-node-api` |
| `supabase-api` | Data-access-dominant app; Postgres + RLS as the API; Edge Functions for the rest | `arch-supabase-api` |

Patterns live under `architectures/<name>/` in this repo.

## Shared philosophy (all patterns)

- Strict TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`.
- Enforced module boundaries via `no-restricted-imports` (no deep imports, no cross-feature imports).
- No `export *` re-export barrels — they hide coupling.
- File caps: warn ~150 lines, error ~200 (relaxed for tests).
- Complexity caps: cyclomatic ≤ 10, depth ≤ 4, params ≤ 4.
- No `any`; consistent type imports; no `console` in committed code.

## How to choose

1. Pure frontend / marketing + app on Vercel → **arch-next-vercel**.
2. Backend with non-trivial domain logic, deployable to container/Lambda → **arch-node-api**.
3. CRUD-heavy app where authorization fits as RLS policy → **arch-supabase-api**.

If unsure, ask the user about: hosting target, where domain logic lives, and whether they need a separate backend.

## How to apply a pattern

Use the `/scaffold-architecture` command, or invoke the architecture-specific skill which contains exact copy steps and peer-dep install commands.

## Adding a new pattern

Each entry follows the Cadre `architecture_catalog_entry` format: Overview, Structure, Dependency Rules, Naming Conventions, Anti-Patterns, Quality Expectations, Rules Seed Data. New patterns must ship `eslint.config.mjs` + `tsconfig.json` matching the spec.
