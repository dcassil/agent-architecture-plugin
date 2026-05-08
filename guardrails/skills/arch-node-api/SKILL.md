---
name: arch-node-api
description: Use when scaffolding or enforcing a standalone Node.js HTTP API with layered architecture (routes → handlers → services → repositories → infra). Provides the spec and exact copy steps for the node-api boilerplate.
---

# Node.js HTTP API — `node-api`

Source: `architectures/node-api/` (README.md, eslint.config.mjs, tsconfig.json). Framework-agnostic (Fastify / Express / Hono).

## What it provides

- **Spec** — layered architecture with explicit one-direction dependencies.
- **`eslint.config.mjs`**:
  - `no-restricted-imports` blocks `repositories/*` from `handlers/*`, blocks `fastify|express|hono` from `services/*` & `repositories/*`, blocks `process.env` outside `config/env.ts`.
  - `no-restricted-syntax` forbids `export *`.
  - `max-lines` 200 / 150-warn; `complexity` ≤ 10; `max-depth` ≤ 4; `max-params` ≤ 4.
  - `no-console` error — use the configured logger.
  - `@typescript-eslint/no-floating-promises`, `no-explicit-any`.
- **`tsconfig.json`** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

## Layers (outer → inner)

`routes/` → `handlers/` → `services/` → `repositories/` → `infra/`. Each layer imports only the one directly below (plus `schemas`/`errors`/`types`).

## Key rules

- `services/` MUST NOT import HTTP framework code.
- `repositories/` MUST NOT import `handlers/` or HTTP types.
- All env via `config/env.ts`. All API errors are domain errors mapped through `errors/httpMapper.ts`.
- Integration tests hit a real DB (Testcontainers), not mocks.

## Copy steps

```bash
SRC=<path-to-this-repo>/architectures/node-api
cp "$SRC/eslint.config.mjs" "$SRC/tsconfig.json" ./
```

Adjust import-boundary path globs in `eslint.config.mjs` if your `src/` layout differs.

## Peer deps

```bash
npm i -D eslint eslint_d @eslint/js typescript-eslint globals
```

## When NOT to use

API tightly coupled to a Next.js render lifecycle (use `arch-next-vercel` route handlers). CRUD-on-Postgres with no business logic (use `arch-supabase-api`).
