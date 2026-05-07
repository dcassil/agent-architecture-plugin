---
name: universal-guard-rails
description: Use after a guard-rails architecture has been chosen and copied into a project. Offers two universal additions — fast-feedback build/pre-commit gates, and an agent-guardrail rule preventing lint/type-rule loosening — and applies whichever the user accepts.
---

# Universal Guard Rails

Runs **after** a per-architecture skill has scaffolded `eslint.config.mjs` + `tsconfig.json`. Architecture-agnostic; JS/TS-specific for now (Python, Rust, etc. can be added later as parallel sections).

## Why

AI agents iterate best with **fast, loud failure**. If lint and typecheck only run "sometimes," agents drift. If agents can silently relax rules, they will — because relaxing is locally easier than fixing. These two additions close those gaps.

## What to ask the user

Ask both questions before doing anything. Wait for explicit answers.

### Q1 — Fail-fast feedback (build + pre-commit)

> "Want me to wire `tsc --noEmit` and `eslint` to run on build (fail-on-error) and pre-commit, plus a matching CI job? This is the fastest feedback loop for AI iteration."

If **yes**, apply [Setup A](#setup-a--fail-fast-feedback-jsts).

### Q2 — Agent guardrail against rule loosening

> "Want me to add an `AGENTS.md` rule that forbids agents from loosening lint or TS rules (disabling rules, lowering strictness, `// eslint-disable`, `any`, `@ts-ignore`, etc.) without per-instance human approval? This stops the 'relax instead of fix' failure mode."

If **yes**, apply [Setup B](#setup-b--agent-guardrail-jsts).

## Setup A — Fail-fast feedback (JS/TS)

### 1. `package.json` scripts

Add (or merge into existing):

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "verify": "npm run typecheck && npm run lint",
    "prebuild": "npm run verify"
  },
  "devDependencies": {
    "simple-git-hooks": "^2.11.0",
    "lint-staged": "^15.2.0"
  },
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged && npm run typecheck"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": "eslint --max-warnings=0"
  }
}
```

Then:

```bash
npm i -D simple-git-hooks lint-staged
npx simple-git-hooks   # installs the hook into .git/hooks
```

Notes:
- `prebuild` runs before `npm run build`, so any framework's build (`next build`, `tsc -b`, `vite build`) inherits the gate without per-framework config.
- `--max-warnings=0` makes lint warnings fail the commit. If a project has many pre-existing warnings, fix them first or omit until clean.
- For Next.js specifically, ALSO confirm `next.config.*` does NOT set `eslint.ignoreDuringBuilds: true` or `typescript.ignoreBuildErrors: true`. Remove if present.

### 2. CI workflow

Create `.github/workflows/verify.yml` (or merge into an existing CI file):

```yaml
name: verify
on:
  pull_request:
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run verify
```

If the project uses pnpm/yarn/bun, swap the install/run commands accordingly — keep the `verify` script as the single entry point.

## Setup B — Agent guardrail (JS/TS)

Append to (or create) `AGENTS.md` in the project root. If a `CLAUDE.md` exists and is the active agent-instruction file, also add a one-line pointer there: `See AGENTS.md for the lint/type-rule guardrail.`

```markdown
## Lint and Type Rule Guardrail

You MUST NOT loosen lint or type-checking rules to make errors go away. The
correct response to a lint or type error is to fix the code, not the rule.

This applies to (non-exhaustive):

- Editing `eslint.config.*` to disable, downgrade, or scope-narrow a rule.
- Editing `tsconfig.json` to disable strictness flags
  (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitReturns`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`,
  `useUnknownInCatchVariables`).
- Adding `// eslint-disable*`, `// @ts-ignore`, `// @ts-expect-error`,
  `// @ts-nocheck`.
- Introducing `any`, `as any`, non-null assertions (`!`) to silence errors.
- Setting `eslint.ignoreDuringBuilds` or `typescript.ignoreBuildErrors`
  in framework configs (e.g. `next.config.*`).
- Adding paths to `ignores` / `exclude` to skip files from linting or
  typechecking.

If you believe a rule is genuinely wrong for a specific case, STOP and ask
the user for explicit per-instance approval before changing it. The user's
approval applies only to the specific change discussed — it does not
generalize. Default behavior is: fix the code.

Reporting an error to the user and asking how to proceed is always
acceptable. Silently relaxing the rule is not.
```

## Verification

After applying either setup, run a smoke check:

```bash
npm run verify          # should pass on a clean tree
git commit --allow-empty -m "test pre-commit"   # should run hooks
```

If the verify step fails, surface the errors to the user — do not "fix" them by relaxing rules (see Setup B).

## Future languages

When adding Python/Rust/etc.: add sibling sections (`Setup A — Python`, `Setup B — Python`) with equivalents — `ruff` + `mypy` + `pre-commit` for Python; `cargo clippy -D warnings` + `cargo check` + `cargo-husky` for Rust. The two questions stay the same; only the mechanics change.
