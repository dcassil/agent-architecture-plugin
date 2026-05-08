---
name: project-detection
description: Heuristic skill that classifies the current repo as greenfield vs. existing and suggests a primary stack from simple file-existence checks. Output is structured so the orchestration skill can recommend defaults. Heuristic only — no auto-execution, no third-party tools.
---

# project-detection

A small read-only skill. Inspect a few well-known marker files and report a structured summary. Do **not** install anything, run any third-party tool, or modify the repo.

## How to run

When invoked, perform these checks against the current working directory (the target project root) and produce the structured output below.

### Step 1 — collect raw signals

Check existence (yes/no) of each of these paths at the repo root unless noted:

- `package.json`
- `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`
- `next.config.js`, `next.config.mjs`, `next.config.ts`
- `vercel.json`
- `supabase/` (directory)
- `Cargo.toml`
- `pyproject.toml`, `requirements.txt`, `Pipfile`
- `go.mod`
- `Gemfile`
- `.git/` (directory)
- `README.md`
- `eslint.config.mjs`, `tsconfig.json`

Also: count **all** non-hidden files at the repo root (cap at e.g. 50 for the count).

If `package.json` exists, peek at its `dependencies` and `devDependencies` keys for the names: `next`, `@supabase/supabase-js`, `pgvector`, `express`, `fastify`, `koa`, `hono`. Record which are present.

### Step 2 — classify project_kind

- `greenfield` — `.git/` exists OR doesn't, but there is no manifest file (no `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`) AND the root has at most a README and config dotfiles.
- `existing` — any manifest file is present.
- `unknown` — none of the above clearly applies.

### Step 3 — suggest a guardrails architecture

Map signals to one of the four guardrails patterns. Only suggest with **high** confidence when the signal is unambiguous; otherwise return `null` and let the orchestration skill ask the user.

| Signals                                                                                          | suggested_architecture        | confidence |
| ------------------------------------------------------------------------------------------------ | ----------------------------- | ---------- |
| `next.config.*` present OR `next` in package.json deps                                           | `react-next-vercel-webapp`    | high       |
| `supabase/` dir present AND a deps signal for `pgvector` or "rag" in repo name                   | `supabase-node-rag`           | medium     |
| `supabase/` dir present (no rag signal)                                                          | `supabase-api`                | medium     |
| `package.json` present, no Next, no Supabase, has `express`/`fastify`/`koa`/`hono` OR just Node  | `node-api`                    | medium     |
| Greenfield (no manifests)                                                                        | `null` (ask user)             | n/a        |
| Non-Node ecosystem (Cargo/Python/Go/Ruby with no JS)                                             | `null` (ask user; out of catalog) | n/a    |

If multiple rows match, pick the more specific one (Next > Supabase-RAG > Supabase-API > node-api).

### Step 4 — emit structured output

Produce a single block the caller can read directly. Use this exact shape:

```
project_kind: <greenfield | existing | unknown>
suggested_architecture: <react-next-vercel-webapp | node-api | supabase-api | supabase-node-rag | null>
confidence: <high | medium | low | n/a>
raw_signals:
  manifests: [<list of manifest filenames found>]
  framework_hints: [<list of dep-name hits>]
  has_supabase_dir: <true|false>
  has_existing_eslint_config: <true|false>
  has_existing_tsconfig: <true|false>
  root_file_count: <integer or "50+">
notes: <one short sentence: e.g. "Next.js project with Supabase add-on" or "Empty repo, ask user for architecture">
```

## Constraints

- Read-only. This skill must never write, install, or run code outside of file-existence and a single small JSON read of `package.json`.
- Heuristics only. When in doubt, return `null` for `suggested_architecture` and let the orchestration skill prompt the user.
- Do not infer beyond the four guardrails patterns. Stacks outside the catalog (Rust, Python, Go, Ruby alone) should produce `suggested_architecture: null` with a note explaining the catalog mismatch.
