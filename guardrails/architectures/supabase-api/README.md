---
id: ARCH-TS-SUPABASE-API
level: architecture_catalog_entry
title: "Supabase API (Edge Functions + Postgres + RLS)"
short_code: "ARCH-TS-SUPABASE-API"
language: typescript
project_type: supabase-api
---

# Supabase API (Edge Functions + Postgres + RLS)

## Overview

- **Pattern Name**: Database-as-API with thin Edge Function shim. Postgres is the source of truth — schema, constraints, RLS policies, RPC functions. Edge Functions handle only what SQL+RLS cannot (third-party calls, webhooks, complex orchestration).
- **Best For**: Apps where data access dominates and authorization can be expressed as row-level policy. Small teams that don't want to operate a backend service.
- **Avoid When**: Heavy domain logic that doesn't fit in SQL/PLpgSQL — use the standalone `node-api` pattern. Long-running jobs (Edge Functions have execution limits).

## Structure

### Folder Layout

```
supabase/
  config.toml
  migrations/                 # SQL migrations — single source of truth for schema
    20260101000000_init.sql
    20260201000000_add_invoices.sql
  seed.sql                    # Local-dev seed data
  functions/                  # Deno-based Edge Functions
    _shared/
      cors.ts
      supabase-client.ts      # Service-role client factory
      env.ts                  # zod-validated env
      errors.ts
    <function-name>/
      index.ts                # Entry: serve(handler)
      handler.ts              # Logic, testable
      schema.ts               # zod request/response schemas
  tests/
    rls/                      # pgTAP / SQL tests for RLS policies
    functions/                # Deno tests for Edge Functions
types/
  database.ts                 # Generated from `supabase gen types`
```

### Layers

1. **Schema** (`migrations/*.sql`) — tables, constraints, indexes, triggers.
2. **RLS policies** (in migrations) — authorization. Every table has RLS enabled.
3. **RPC functions** (`CREATE FUNCTION` in migrations) — server-side business logic callable from PostgREST.
4. **Edge Functions** (`functions/<name>/`) — thin shims for things SQL can't do: external API calls, webhooks, signed URLs, custom auth flows.
5. **Generated types** (`types/database.ts`) — consumed by clients; never edited by hand.

### Module Boundaries

- Migrations are append-only. Never edit a shipped migration; write a new one.
- Each Edge Function is self-contained — its `index.ts` boots, its `handler.ts` is pure-ish and unit-testable.
- `_shared/` holds cross-function utilities; functions MUST NOT import from sibling functions.

## Dependency Rules

- Schema/RLS MUST exist for every table — no table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Privileged work (bypassing RLS) MUST use the service-role client and MUST live only inside Edge Functions, never in client bundles.
- Edge Function `<name>/index.ts` MAY import `_shared/*` and `<name>/*`. MUST NOT import from a sibling function (`functions/<other>/*`).
- All env access MUST go through `_shared/env.ts`.
- Service-role keys MUST come from env; MUST NOT be inlined.
- Client-facing code MUST use the anon key + RLS, never service-role.

## Naming Conventions

- Migrations: `YYYYMMDDHHMMSS_snake_case_description.sql`.
- Tables: snake_case plural (`invoices`, `user_profiles`).
- RLS policies: `<action>_<who>_<table>` (e.g., `select_owner_invoices`).
- RPC functions: snake_case verb-led (`create_invoice_for_user`).
- Edge Function dirs: kebab-case (`stripe-webhook`, `send-magic-link`).
- TS files inside functions: kebab-case.
- Branded ids in TS: `UserId = string & { __brand: 'UserId' }`.

## Anti-Patterns

- **Tables without RLS** — anon key gets full access. Always `ENABLE ROW LEVEL SECURITY` in the same migration that creates the table.
- **Service-role key in browser code** — total auth bypass. Service-role lives only in Edge Functions / server contexts.
- **Hand-edited `database.ts`** — drifts from schema. Always regenerate via `supabase gen types`.
- **Editing existing migrations** — breaks reproducibility. Add a new migration instead.
- **Business logic split between Edge Function and DB trigger** — hard to reason about. Pick one home per concern.
- **Direct `Deno.env.get(...)`** outside `_shared/env.ts`.
- **Cross-function imports** between `functions/<a>/` and `functions/<b>/`.

## Quality Expectations

- **Required tools**: `deno check`, `deno lint`, `deno fmt`, `supabase db lint`, `supabase test db` (pgTAP).
- **Type safety**: `strict: true`, `noUncheckedIndexedAccess: true`. Database types regenerated on every schema change.
- **RLS coverage**: every table has a pgTAP test asserting both allowed and denied access.
- **Migrations**: must be reversible OR explicitly documented as forward-only.
- **Secret hygiene**: no service-role key, JWT secret, or third-party key checked into the repo.

## Rules Seed Data

Encoded in `eslint.config.mjs` (Edge Function TS):

- `no-restricted-imports` — block `Deno.env.get` outside `_shared/env.ts`; block sibling-function imports; block service-role client imports outside server-only paths.
- `no-restricted-syntax` — forbid `export *`; forbid direct `Deno.env.get(...)` calls outside the env module.
- `max-lines` 200 / 150 warn.
- `complexity` ≤ 10, `max-depth` ≤ 4, `max-params` ≤ 4.
- `no-console` warn (Edge Functions log to platform; structured logger preferred).
- `@typescript-eslint/no-floating-promises` error.
- `@typescript-eslint/no-explicit-any` error.

Database-side rules (enforced by review checklist + pgTAP):

- Every `CREATE TABLE` migration in `supabase/migrations/` MUST be paired with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one policy.
- RPC functions MUST declare `SECURITY DEFINER` only when intentional, with a comment explaining why.

## Required Peer Dependencies

```
eslint @eslint/js typescript-eslint globals
# Edge Functions run on Deno; tsc/eslint here cover IDE & CI checks for the TS sources.
```
