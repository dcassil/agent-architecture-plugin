# Guardrails Plugin

The **guardrails** plugin is one plugin in the **dev-genie** ecosystem. It owns the architecture-and-lint-rules concern only:

- **Architecture pattern catalog** under `architectures/` — Next.js + Vercel, Node API, Supabase, and Supabase RAG (pgvector). Each pattern ships an architecture spec (`README.md`) plus starter `eslint.config.mjs` and `tsconfig.json` that encode the spec into automated checks.
- **`/scaffold-architecture` slash command** — copies a chosen pattern's `eslint.config.mjs` + `tsconfig.json` into a target project, surfaces the spec for confirmation, and prints peer-dep install commands.
- **Per-stack guard-rail skills**:
  - `guard-rails-catalog` — index of available architectures and routing to the matching `arch-*` skill.
  - `arch-next-vercel`, `arch-node-api`, `arch-supabase-api`, `arch-supabase-node-rag` — per-architecture rules and copy steps.
  - `universal-guard-rails` — architecture-agnostic additions (fail-fast build + pre-commit gate; agent guardrail against lint/type-rule loosening).

## Scope and non-scope

This plugin is **not** the umbrella. It deliberately does **not** own:

- **Static analysis, scoring, or pre-commit hooks for measuring code quality** — that belongs to the sibling `audit` plugin.
- **Ecosystem bootstrap (installing the suite, picking which sibling plugins to load)** — that belongs to the sibling `dev-genie` plugin.

Within its own scope, the plugin is self-contained: every path it references resolves inside `guardrails/`, and it has no runtime dependency on `audit/` or `dev-genie/`.

## Layout

```
guardrails/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── architectures/
│   ├── README.md
│   ├── node-api/
│   ├── react-next-vercel-webapp/
│   ├── supabase-api/
│   └── supabase-node-rag/
├── commands/
│   └── scaffold-architecture.md
└── skills/
    ├── arch-next-vercel/
    ├── arch-node-api/
    ├── arch-supabase-api/
    ├── arch-supabase-node-rag/
    ├── guard-rails-catalog/
    └── universal-guard-rails/
```

## Typical flow

1. Invoke `/scaffold-architecture <pattern> [target-dir]` (or ask the `guard-rails-catalog` skill which pattern fits).
2. The command copies `eslint.config.mjs` + `tsconfig.json` from the chosen `architectures/<pattern>/` into the target.
3. The matching `arch-*` skill provides the full rules reference and customization points.
4. The `universal-guard-rails` skill optionally wires fail-fast build/pre-commit + an agent-guardrail rule.

## Shared philosophy across patterns

- Strict TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`.
- Module boundaries enforced via `no-restricted-imports` (no deep imports, no cross-feature imports).
- No `export *` re-export barrels.
- File caps: warn ~150 lines, error ~200 (relaxed for tests).
- Complexity caps: cyclomatic ≤ 10, depth ≤ 4, params ≤ 4.
- No `any`; consistent type imports; no `console` in committed code.
