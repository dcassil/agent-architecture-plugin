---
name: arch-next-vercel
description: Use when scaffolding or enforcing a Next.js (App Router) webapp on Vercel. Provides the architecture spec, layer boundaries, and exact copy steps for the react-next-vercel-webapp boilerplate (eslint.config.mjs + tsconfig.json).
---

# Next.js + Vercel Webapp — `react-next-vercel-webapp`

Source: `architectures/react-next-vercel-webapp/` (README.md, eslint.config.mjs, tsconfig.json).

## What it provides

- **Spec** — `README.md` documenting layers, dependency rules, anti-patterns, quality bar.
- **`eslint.config.mjs`** — encodes the rules:
  - `no-restricted-imports` blocking `features/*` cross-imports and `process.env` outside `lib/env.ts`.
  - `no-restricted-syntax` forbidding `export *`.
  - `max-lines` 200/150-warn (500 in tests), `complexity` ≤ 10, `max-depth` ≤ 4, `max-params` ≤ 4.
  - `@typescript-eslint/no-explicit-any`, `consistent-type-imports`.
  - `react-hooks/rules-of-hooks` + `exhaustive-deps`.
- **`tsconfig.json`** — `strict: true`, `noUncheckedIndexedAccess: true`.

## Layers (outer → inner)

`app/` (routes, no logic) → `features/<name>/` (domain) → `components/ui/` (presentational) → `lib/` (env, db, auth).

## Key rules

- `components/ui/*` MUST be presentational; no `features/`, `lib/db`, `lib/auth/server` imports.
- `features/<a>/*` MUST NOT import `features/<b>/*`.
- `lib/db`, `lib/auth/server` MUST start with `import 'server-only'`.
- All env access via `lib/env.ts` (zod-validated).

## Copy steps

```bash
SRC=<path-to-this-repo>/architectures/react-next-vercel-webapp
cp "$SRC/eslint.config.mjs" "$SRC/tsconfig.json" ./
```

Then adjust `paths`, `ignores`, and the import-boundary patterns in `eslint.config.mjs` for your repo's package names.

## Peer deps

```bash
npm i -D eslint eslint_d @eslint/js typescript-eslint globals \
  eslint-plugin-react eslint-plugin-react-hooks \
  @next/eslint-plugin-next
```

## When NOT to use

Pure static sites (use plain Next export or Astro). Heavy backend domain logic — split into `arch-node-api`.
