---
id: ARCH-TS-NEXT-VERCEL
level: architecture_catalog_entry
title: "TypeScript Next.js Webapp on Vercel (App Router)"
short_code: "ARCH-TS-NEXT-VERCEL"
language: typescript
project_type: react-next-vercel-webapp
---

# TypeScript Next.js Webapp on Vercel (App Router)

## Overview

- **Pattern Name**: Next.js App Router with feature-sliced UI and a thin server-action layer.
- **Best For**: Vercel-hosted product webapps that mix server-rendered marketing pages, authenticated app shells, and serverless API routes. Small-to-mid teams that want one repo for UI + BFF.
- **Avoid When**: Pure static sites (use plain Next export or Astro); heavy backend domain logic (split into a dedicated Node API instead — see `../node-api/`).

## Structure

### Folder Layout

```
app/                       # App Router routes (server components by default)
  (marketing)/             # Route group: public pages
  (app)/                   # Route group: authenticated app
  api/                     # Route handlers (server-only)
  layout.tsx
  page.tsx
components/
  ui/                      # Pure presentational, reusable across features
  <feature>/               # Feature-scoped components
features/
  <feature>/
    actions.ts             # Server actions
    queries.ts             # Server-only data fetching
    schema.ts              # Zod schemas
    components/
    types.ts
lib/
  auth/                    # Auth client + server helpers
  db/                      # DB client (Drizzle/Prisma) — server-only
  env.ts                   # Validated env (zod) — fail fast
  http.ts
hooks/                     # Client hooks only
public/
styles/
tests/
middleware.ts
next.config.mjs
```

### Layers (outer → inner)

1. **Routing / Pages** (`app/`) — server components, layouts, route handlers. No business logic.
2. **Features** (`features/<name>/`) — domain slices. Server actions, queries, schemas live here.
3. **UI primitives** (`components/ui/`) — presentational, no data fetching, no `"use server"`.
4. **Lib / Infra** (`lib/`) — env, db, auth, third-party clients. Pure modules.

### Module Boundaries

- `components/ui/*` MUST be presentational — no imports from `features/`, `lib/db`, or `lib/auth/server`.
- `features/<a>/*` MUST NOT import from `features/<b>/*`. Cross-feature sharing goes through `lib/` or a shared `components/ui` primitive.
- `app/*` is a thin composition layer — delegate to `features/` for behavior.

## Dependency Rules

- `app/` MAY import `features/`, `components/`, `lib/`.
- `features/` MAY import `lib/`, `components/ui/`. MUST NOT import `app/`.
- `components/ui/` MUST NOT import `features/`, `lib/db`, `lib/auth/server`, or any module marked `server-only`.
- `lib/db`, `lib/auth/server` MUST be `import 'server-only'` at the top.
- Client components (`"use client"`) MUST NOT import server-only modules.
- All env access MUST go through `lib/env.ts` (validated). MUST NOT use `process.env.*` directly outside `lib/env.ts`.

## Naming Conventions

- Route handler files: `app/**/route.ts`. Page files: `page.tsx`. Layout files: `layout.tsx`.
- Server actions: end with `Action` (e.g., `createInvoiceAction`) and live in `features/*/actions.ts`.
- Zod schemas: end with `Schema` (e.g., `InvoiceSchema`).
- Hooks: `useXxx` in `hooks/` or co-located in client component folders.
- Components: PascalCase files, one component per file for screen-level components.
- Types: PascalCase, prefer `interface` for object shapes, `type` for unions/aliases.

## Anti-Patterns

- **Direct `process.env`** outside `lib/env.ts` — bypasses validation; values become `undefined` at runtime.
- **Cross-feature imports** — turns features into a tangled graph; refactor shared logic into `lib/` instead.
- **Server-only code in client components** — leaks DB credentials / breaks build. Always mark with `import 'server-only'`.
- **`fetch` without revalidation strategy** — Next caches aggressively; specify `cache` / `next.revalidate` explicitly.
- **Barrel `index.ts` re-exports across feature boundaries** — defeats tree-shaking and hides coupling.
- **Business logic in `app/page.tsx`** — should delegate to a feature module.

## Quality Expectations

- **Required tools**: `tsc --noEmit`, `eslint`, `next lint`, `prettier`.
- **Type safety**: `strict: true`, `noUncheckedIndexedAccess: true`.
- **Test coverage**: ≥ 70% on `features/` business logic (Vitest / Jest).
- **Bundle**: per-route JS budget — warn at 200KB gzipped first-load.
- **Lighthouse perf**: ≥ 90 on key routes.

## Rules Seed Data

Encoded in `eslint.config.mjs`:

- `no-restricted-imports` — block `features/*` cross-imports and `process.env` outside `lib/env.ts`.
- `no-restricted-syntax` — forbid `export *` (re-export barrels).
- `max-lines` — 200 hard, 150 warn (500 in tests).
- `complexity` ≤ 10, `max-depth` ≤ 4, `max-params` ≤ 4.
- `@typescript-eslint/no-explicit-any` error.
- `@typescript-eslint/consistent-type-imports` error.
- `react-hooks/rules-of-hooks` + `react-hooks/exhaustive-deps`.

## Required Peer Dependencies

```
eslint @eslint/js typescript-eslint globals
eslint-plugin-react eslint-plugin-react-hooks
@next/eslint-plugin-next
```
