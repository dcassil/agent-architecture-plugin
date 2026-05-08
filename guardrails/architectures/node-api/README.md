---
id: ARCH-TS-NODE-API
level: architecture_catalog_entry
title: "TypeScript Node.js HTTP API (Layered Service)"
short_code: "ARCH-TS-NODE-API"
language: typescript
project_type: node-api
---

# TypeScript Node.js HTTP API (Layered Service)

## Overview

- **Pattern Name**: Layered service — `routes → handlers → services → repositories → infra`. Framework-agnostic; works with Fastify, Express, or Hono.
- **Best For**: Standalone backend services owning their own domain logic and persistence. Deployable to a container, Lambda, or Fly/Render. Teams that want clear separation between transport and domain.
- **Avoid When**: Tight coupling to a webapp's render lifecycle (use Next.js route handlers). Pure CRUD on Postgres with no business logic (consider Supabase / PostgREST instead).

## Structure

### Folder Layout

```
src/
  app.ts                   # HTTP framework wiring; no business logic
  server.ts                # Process bootstrap (listen, signals)
  config/
    env.ts                 # zod-validated env, single source of truth
  routes/                  # Route registration (paths → handlers)
  handlers/                # Request/response shape; calls services
  services/                # Domain logic; pure where possible
  repositories/            # DB access; no HTTP knowledge
  infra/
    db.ts
    logger.ts
    queue.ts
  schemas/                 # zod request/response schemas
  errors/                  # Domain error classes + HTTP mapper
  types/                   # Shared types, branded ids
tests/
  unit/
  integration/
package.json
tsconfig.json
eslint.config.mjs
```

### Layers (outer → inner)

1. **Routes** — declarative path-to-handler mapping. No logic.
2. **Handlers** — parse/validate input, call services, format response.
3. **Services** — domain logic, orchestration, transactions.
4. **Repositories** — data access, SQL/ORM calls. No HTTP types.
5. **Infra** — DB clients, loggers, external clients. Singletons.

### Module Boundaries

- Each layer imports only the layer directly below (or `infra`/`schemas`/`errors`/`types`).
- `services/` MUST NOT import from HTTP framework (`fastify`, `express`, `hono`).
- `repositories/` MUST NOT import `handlers/` or HTTP request/response types.
- `routes/` MUST NOT import `repositories/` directly.

## Dependency Rules

- `app.ts` MAY import `routes/`, `infra/`.
- `routes/` MAY import `handlers/`, `schemas/`.
- `handlers/` MAY import `services/`, `schemas/`, `errors/`, `types/`. MUST NOT import `repositories/` directly.
- `services/` MAY import `repositories/`, `infra/`, `errors/`, `types/`. MUST NOT import HTTP libraries.
- `repositories/` MAY import `infra/`, `types/`. MUST NOT import `services/`, `handlers/`.
- All env access MUST go through `config/env.ts`.
- All errors crossing the HTTP boundary MUST be domain error classes mapped via `errors/httpMapper.ts`.

## Naming Conventions

- Files: kebab-case (`user-service.ts`, `invoice-repository.ts`).
- Service classes/functions: `<Domain>Service` or `create<Domain>Service` factory.
- Repository: `<Domain>Repository`.
- Handlers: `<verb><Domain>Handler` (e.g., `getUserHandler`).
- Errors: `<Domain>Error` extending a base `AppError`.
- Schemas: `<Domain>Schema` (zod).
- Branded ids: `UserId = string & { __brand: 'UserId' }`.

## Anti-Patterns

- **DB calls in handlers** — couples HTTP shape to persistence. Always go through a service.
- **Throwing raw `Error`** at API boundaries — yields opaque 500s. Use domain errors with HTTP mapping.
- **Synchronous logging in hot paths** — use a buffered logger (pino).
- **Singleton DB clients in module top-level** without lifecycle hooks — breaks tests; inject via factory.
- **Catch-all `try/catch` that swallows errors** — let the framework error handler do its job.
- **Direct `process.env`** outside `config/env.ts`.

## Quality Expectations

- **Required tools**: `tsc --noEmit`, `eslint`, `prettier`, `vitest`/`jest`.
- **Type safety**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Test coverage**: ≥ 80% on `services/`, ≥ 60% overall. Integration tests hit a real DB (Testcontainers) — no mocks for the data layer.
- **Latency budget**: p95 < 200ms on key endpoints (define per service).
- **Logging**: structured JSON; every request gets a correlation id.

## Rules Seed Data

Encoded in `eslint.config.mjs`:

- `no-restricted-imports` — block `repositories/*` from `handlers/*`; block `fastify|express|hono` from `services/*` and `repositories/*`; block `process.env` outside `config/env.ts`.
- `no-restricted-syntax` — forbid `export *`.
- `max-lines` 200 / 150 warn.
- `complexity` ≤ 10, `max-depth` ≤ 4, `max-params` ≤ 4.
- `no-console` error — must use the configured logger.
- `@typescript-eslint/no-floating-promises` — surface unhandled async.
- `@typescript-eslint/no-explicit-any` error.

## Required Peer Dependencies

```
eslint @eslint/js typescript-eslint globals
```
