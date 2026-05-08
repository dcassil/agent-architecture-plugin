# Architecture Pattern Catalog

Reusable architecture pattern boilerplates. Each folder describes one pattern and provides starter `eslint.config.mjs` and `tsconfig.json` files that encode the rules into automated checks.

Format follows the Cadre architecture catalog convention (see ultra-metis `architecture_catalog_entry`):

- **Overview** — pattern, when to use, when to avoid
- **Structure** — folder layout, layers, module boundaries
- **Dependency Rules** — MUST/MUST NOT directional constraints
- **Naming Conventions**
- **Anti-Patterns**
- **Quality Expectations** — required tools, thresholds
- **Rules Seed Data** — lint/type rules that enforce the architecture

## Patterns

- [`react-next-vercel-webapp/`](./react-next-vercel-webapp/) — Next.js (App Router) on Vercel
- [`node-api/`](./node-api/) — Standalone Node.js HTTP API service
- [`supabase-api/`](./supabase-api/) — Supabase Edge Functions + Postgres backend
- [`supabase-node-rag/`](./supabase-node-rag/) — Next.js + Supabase + pgvector RAG backend

## Using a pattern

1. Read the pattern's `README.md` for architecture and rationale.
2. Copy `eslint.config.mjs` and `tsconfig.json` into a new project (or merge into existing config).
3. Install peer deps listed in the pattern README.
4. Adjust the `paths`, `ignores`, and import boundary patterns for your repo's package names.

## Shared philosophy (all patterns)

- Catch bugs early via strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`).
- Enforce package API boundaries — no deep imports into `src/` or `dist/`.
- Forbid blanket re-exports (`export *`) — they hide coupling.
- File size caps to keep modules focused (warn ≈ 150 lines, error ≈ 200; relaxed for tests).
- Complexity caps (cyclomatic ≤ 10, depth ≤ 4, params ≤ 4).
- No `any`; consistent type imports; no `console` in committed code.
