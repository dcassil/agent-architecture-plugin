---
name: arch-supabase-node-rag
description: Use when scaffolding or enforcing a Next.js + Supabase RAG backend (pgvector). Provides the spec — schema/RLS/RPC + Route Handler orchestrating retrieval and generation — and exact copy steps for the supabase-node-rag boilerplate.
---

# Next.js + Supabase RAG (pgvector) — `supabase-node-rag`

Source: `architectures/supabase-node-rag/` (README.md, eslint.config.mjs, tsconfig.json). Postgres + pgvector is the corpus + vector store; a Next.js Route Handler is the only client-facing surface and orchestrates retrieval + provider calls.

## What it provides

- **Spec** — schema → RLS → `match_<corpus>` RPC → server modules (`lib/server/*`) → Route Handler → client UI. Provider-agnostic: LLM/embeddings SDKs are isolated behind one server module each.
- **`eslint.config.mjs`**:
  - Client (`app/(ui)/**`, components, `lib/shared/**`) MUST NOT import `lib/server/*`, `server-only`, or `@supabase/supabase-js`.
  - `@supabase/supabase-js` `createClient` is allowed only in `lib/server/supabase.ts`.
  - `process.env` member access blocked outside `lib/server/env.ts`.
  - Provider SDKs (LLM, embeddings) must live in their one designated `lib/server/*` module.
  - `max-lines` 250; `complexity` ≤ 10; `max-depth` ≤ 4; `max-params` ≤ 4.
  - `@typescript-eslint/no-floating-promises`, `no-explicit-any`; `no-console` warn in server modules.
- **`tsconfig.json`** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, Next plugin, `@/*` paths.

## Key rules

- Every `create table` migration MUST include `enable row level security` in the same file.
- Service-role key lives ONLY in `lib/server/*`; never in the client bundle (verified by `import 'server-only'`).
- Route Handler MUST run input guardrails BEFORE embedding or generation calls.
- If `match_<corpus>` returns zero rows above threshold, the handler MUST take the fallback path — never call generation with empty retrieved context.
- Migrations are append-only. `types/database.ts` is generated via `supabase gen types`, never hand-edited.
- Provider SDKs (LLM, embeddings) imported in exactly one server module each.

## Canonical request flow

zod-validate → guardrails → embed query → `match_<corpus>` RPC → fallback if empty → assemble prompt + generate → post-process + cite → typed JSON.

## Copy steps

```bash
SRC=<path-to-this-repo>/architectures/supabase-node-rag
cp "$SRC/eslint.config.mjs" "$SRC/tsconfig.json" ./
```

Required directories: `app/api/<feature>/`, `app/(ui)/`, `lib/server/`, `lib/shared/`, `supabase/migrations/`, `supabase/seed/`, `supabase/tests/{rls,rpc}/`, `types/database.ts`.

## Tooling

```bash
tsc --noEmit && eslint . && prettier --check .
supabase db lint
supabase test db   # pgTAP — RLS posture per corpus table; match RPC threshold + limit
vitest             # lib/server/* unit tests (guardrails, fallback, sentinel parsing)
```

## Peer deps

```bash
npm i next react react-dom @supabase/supabase-js zod server-only
npm i -D eslint @eslint/js typescript-eslint globals vitest supabase
```

LLM/embedding/email/analytics providers are deliberately NOT prescribed — pick per project, isolate behind one `lib/server/*` module.

## When NOT to use

Multi-tenant authorization needing complex RLS modeling; large/streaming ingestion (use a dedicated worker); workflows needing background jobs/queues beyond Vercel/Edge limits. For non-RAG Supabase apps, use `arch-supabase-api`.
