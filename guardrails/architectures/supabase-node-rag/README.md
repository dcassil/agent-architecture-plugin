---
id: ARCH-TS-NEXTJS-SUPABASE-RAG
level: architecture_catalog_entry
title: "Next.js + Vercel + Supabase RAG Backend (pgvector)"
short_code: "ARCH-TS-NEXTJS-SUPABASE-RAG"
language: typescript
project_type: nextjs-supabase-rag
---

# Next.js + Vercel + Supabase RAG Backend (pgvector)

## Overview

- **Pattern Name**: Next.js (App Router) on Vercel + Supabase Postgres with `pgvector` for retrieval-augmented generation. Postgres is the source of truth for the corpus and embeddings; a Next.js Route Handler is the only client-facing surface and orchestrates retrieval plus any downstream provider calls.
- **Best For**: Single-tenant or low-auth POCs and small apps that need a real RAG path (real DB, real vector index) without standing up a separate backend service. Keeps secrets server-side, keeps the corpus in SQL, keeps the UI dumb.
- **Avoid When**: Multi-tenant authorization needs sophisticated RLS modeling beyond a few rules; ingestion is large/streaming (use a dedicated worker, not a one-shot seed script); workflows require background jobs, queues, or long-running execution beyond Vercel/Edge limits.

## Provider-Agnostic by Design

This pattern fixes the **stack** (Next.js, Vercel, Supabase, Postgres, pgvector) but is intentionally generic about any third-party LLM, embeddings, email, or analytics provider. Provider integrations are isolated behind narrow server-only modules so they can be swapped without touching the schema, the Route Handler shape, or the client.

## Structure

### Folder Layout

```
app/
  api/
    <feature>/
      route.ts                 # POST/GET handler — only client-facing surface
  (ui)/
    page.tsx                   # Client UI
    components/
lib/
  server/                      # server-only modules; never imported by client
    supabase.ts                # service-role client factory
    embeddings.ts              # provider-agnostic embeddings interface
    generation.ts              # provider-agnostic text-gen / chat interface
    retrieval.ts               # RPC caller + threshold logic
    guardrails.ts              # input validation, blocklists, fallbacks
    env.ts                     # zod-validated server env (throws at boot)
  shared/
    types.ts                   # types safe for client + server (no secrets)
supabase/
  config.toml
  migrations/
    YYYYMMDDHHMMSS_init_pgvector.sql
    YYYYMMDDHHMMSS_<corpus_table>.sql
    YYYYMMDDHHMMSS_match_<corpus>_rpc.sql
    YYYYMMDDHHMMSS_rls_policies.sql
  seed/
    corpus/                    # source content for one-shot seeding
    seed.ts                    # chunk → embed → insert; idempotent
  tests/
    rls/                       # pgTAP — anon access denied / allowed as designed
    rpc/                       # pgTAP — match RPC respects threshold + limit
types/
  database.ts                  # generated via `supabase gen types`
```

### Layers

1. **Schema** (`migrations/*.sql`) — corpus tables, pgvector indexes, retrieval RPCs.
2. **RLS policies** — RLS enabled on every table; policies reflect the app's auth model (or zero anon policies when the route handler is the sole reader).
3. **RPC** — `match_<corpus>(query_embedding vector, match_count int, similarity_threshold float, ...filters)` returns ranked rows with similarity score. SQL is the place to express "top-K above threshold."
4. **Server modules** (`lib/server/*`) — server-only, marked with `import 'server-only'`; hold all secrets and Supabase service-role usage. Provider calls live behind narrow interfaces.
5. **Route Handler** (`app/api/<feature>/route.ts`) — validates input (zod), runs guardrails, embeds query, calls RPC, decides on fallback vs. generation, returns JSON.
6. **Client UI** (`app/(ui)/*`) — pure React; talks only to its Route Handler; never imports `lib/server/*`.

### Module Boundaries

- Migrations are append-only. Never edit a shipped migration.
- `lib/server/*` MUST start with `import 'server-only'`. Client components MUST NOT import from `lib/server/*`.
- The Route Handler is the only place that orchestrates retrieval + generation. UI never calls Supabase or any third-party provider directly.
- Provider SDKs are imported in **exactly one** server module each (`lib/server/embeddings.ts`, `lib/server/generation.ts`, etc.). All other code talks to the local interface, not the SDK.
- Seed scripts run via `pnpm seed` locally or in CI, never at request time.

## Generic Schema Shape

A corpus table has, at minimum:

```sql
create extension if not exists vector;

create table <corpus> (
  id            uuid primary key default gen_random_uuid(),
  source_url    text,
  source_title  text,
  -- domain-specific filter columns: e.g. category, region, tag, language
  chunk_index   int  not null,
  chunk_text    text not null,
  token_count   int,
  embedding     vector(<dim>) not null,   -- dim matches embeddings provider
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index <corpus>_embedding_ivfflat
  on <corpus> using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

alter table <corpus> enable row level security;
```

### Generic RPC

```sql
create or replace function match_<corpus>(
  query_embedding      vector(<dim>),
  match_count          int default 5,
  similarity_threshold float default 0.75,
  filters              jsonb default '{}'::jsonb
)
returns table (
  id           uuid,
  source_url   text,
  source_title text,
  chunk_text   text,
  similarity   float,
  metadata     jsonb
)
language sql stable
as $$
  select
    c.id, c.source_url, c.source_title, c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from <corpus> c
  where 1 - (c.embedding <=> query_embedding) >= similarity_threshold
    -- AND optional filter expressions derived from `filters`
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
```

`match_<corpus>` defaults to `SECURITY INVOKER`. Use `SECURITY DEFINER` only with an explicit comment explaining why.

### RLS Posture

- **Service-role-only access**: revoke all from `anon` and `authenticated`; the Route Handler is the sole reader via service-role.
- **Authenticated read access**: add row-scoped policies tied to `auth.uid()`.
- **Public read**: explicit `select` policies for `anon`; never implicit.

Whichever posture is chosen, RLS MUST be enabled on the table in the same migration that creates it.

## Dependency Rules

- Every `create table` migration MUST include `enable row level security` in the same file.
- Secrets MUST come from `lib/server/env.ts` only; MUST NOT appear in any client import graph. Verified by `import 'server-only'` and ESLint `no-restricted-imports`.
- Client code MUST NOT import from `lib/server/*`.
- The Route Handler MUST validate request bodies with zod before any external call.
- The Route Handler MUST run input guardrails (blocklists, size limits, schema) BEFORE calling embeddings or generation providers.
- If `match_<corpus>` returns zero rows above threshold, the handler MUST take the fallback path and MUST NOT call the generation provider with empty retrieved context.
- All env access MUST go through `lib/server/env.ts` (zod-parsed). Direct `process.env.*` outside that module is forbidden.
- Provider SDKs MUST be imported in exactly one server module each; other code consumes the local interface.

## Naming Conventions

- Migrations: `YYYYMMDDHHMMSS_snake_case_description.sql`.
- Tables: snake_case plural.
- RPC functions: snake_case verb-led (`match_documents`, `search_articles`).
- Server modules: kebab-case files, named exports.
- Route Handler dirs: kebab-case under `app/api/`.
- Branded ids in TS where helpful (`ChunkId = string & { __brand: 'ChunkId' }`).

## Request Flow (canonical RAG handler)

1. Parse + zod-validate the request body.
2. Run input guardrails (blocklist, length cap, schema sanity). On match: return canned response, no provider calls.
3. Embed the query via `lib/server/embeddings.ts`.
4. Call `match_<corpus>` RPC with configured `match_count` and `similarity_threshold`.
5. If no matches above threshold: return fallback response; do not call generation.
6. Assemble prompt/context from retrieved chunks + request inputs; call `lib/server/generation.ts`.
7. Post-process: parse any sentinel flags, strip them from the user-facing text, attach citations from retrieved chunks.
8. Return a typed JSON response shaped by `lib/shared/types.ts`.

## Anti-Patterns

- **Tables without RLS enabled** — even with no policies, RLS must be explicitly enabled.
- **Service-role key reachable from the client bundle** — verified by `import 'server-only'` and bundle inspection.
- **Calling the generation provider with empty retrieved context** — bypasses the core anti-hallucination guardrail of RAG.
- **Embedding the request before guardrails** — wastes calls and risks logging sensitive blocked content.
- **Hand-edited `types/database.ts`** — always regenerate via `supabase gen types`.
- **Editing shipped migrations** — add a new migration instead.
- **Provider SDK imports scattered across modules** — couples the codebase to a vendor; isolate behind one server module per concern.
- **Inline secrets / direct `process.env.*` outside `lib/server/env.ts`**.
- **Mixing seed-time and request-time code paths** — seed scripts and the Route Handler may share interfaces but never share execution.
- **Persisting raw user inputs/conversations server-side without an explicit policy** — decide and document; don't drift into incidental storage.

## Quality Expectations

- **Required tools**: `tsc --noEmit`, `eslint`, `prettier`, `supabase db lint`, `supabase test db` (pgTAP), `vitest` for `lib/server/*` unit tests.
- **Type safety**: `strict: true`, `noUncheckedIndexedAccess: true`. Regenerate `types/database.ts` after every migration.
- **RLS coverage**: pgTAP test for each corpus table asserting the intended access posture (denied or allowed) for `anon` and `authenticated`.
- **RPC coverage**: pgTAP test asserting `match_<corpus>` respects `similarity_threshold` and `match_count`.
- **Guardrail coverage**: vitest cases for blocklist hits, RAG fallback (no matches), and any sentinel parsing.
- **Secret hygiene**: no service-role key or third-party key in the repo; `.env.local` git-ignored; runtime secrets injected via Vercel project settings and Supabase project settings.
- **Provider isolation**: a grep for the provider SDK package name returns hits in exactly one server module.

## Rules Seed Data

Encoded in `eslint.config.mjs`:

- `no-restricted-imports`:
  - Block `lib/server/*` from `app/(ui)/**` and any client component.
  - Block direct `@supabase/supabase-js` `createClient` calls outside `lib/server/supabase.ts`.
  - Block third-party generation/embeddings SDK imports outside their designated `lib/server/*` module.
- `no-restricted-syntax` — forbid `process.env` member access outside `lib/server/env.ts`.
- `max-lines` 250 / 200 warn.
- `complexity` ≤ 10, `max-depth` ≤ 4, `max-params` ≤ 4.
- `@typescript-eslint/no-floating-promises` error.
- `@typescript-eslint/no-explicit-any` error.
- `no-console` warn in `lib/server/*` (prefer a structured logger; never log full prompts or chunk contents in production).

Database-side rules (enforced by review + pgTAP):

- Every `create table` migration MUST include `enable row level security` in the same file.
- Access posture for each corpus table MUST be explicit: either no `anon`/`authenticated` grants (server-only reads), or explicit `select` policies — never implicit.
- RPC functions MUST declare `SECURITY DEFINER` only when intentional, with a SQL comment explaining why.
- A pgvector index MUST exist on the embedding column before bulk seeding.

## Required Peer Dependencies

```
next react react-dom
@supabase/supabase-js
zod
server-only
eslint @eslint/js typescript-eslint globals
vitest
# Dev/CLI:
supabase                # CLI for migrations, types, db lint, db test (pgTAP)
```

Generation, embeddings, email, and analytics providers are deliberately **not** part of this pattern's required dependencies. Each project picks its own and isolates them behind one `lib/server/*` module.

## Environment Variables (server-only, baseline)

```
SUPABASE_URL                   # project URL
SUPABASE_SERVICE_ROLE_KEY      # server-only; never exposed to the client
SUPABASE_ANON_KEY              # present; used only when client-side Supabase is intentionally enabled
```

Project-specific provider keys (LLM, embeddings, email, analytics) are added per project, consumed only via `lib/server/env.ts`, and zod-validated at boot.
