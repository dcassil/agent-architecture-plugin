---
name: existing-config-detection
description: Read-only scanner that catalogs an existing repo's lint/type/format/hook/CI/audit/agent-config state into a structured report consumed by the dev-genie reconcile flow. No writes, no third-party tools beyond `eslint --print-config` (optional fallback).
---

# existing-config-detection

This skill is the canonical detection pass for the **existing-repo branch** of `/dev-genie-init`. It produces a structured detection report that the `reconcile` skill compares against the recommended baseline.

The skill is read-only. It must never modify the repo, install dependencies, or run third-party tooling beyond an optional `eslint --print-config <sample>` fallback when the user's flat config cannot be parsed statically.

## How to run

The implementation lives in three modules and the aggregator in `detect-config.js`:

- `dev-genie/skills/project-detection/detect-config.js` — top-level `detectConfig(repoPath)` aggregator.
- `dev-genie/skills/project-detection/detect-build-ci.js` — workflow + `package.json` script + build-chain probe.
- `dev-genie/skills/project-detection/detect-agent-config.js` — agent-config + lock parsing (CLAUDE.md, AGENTS.md, GEMINI.md, `.windsurfrules`, `.cursor/rules/`, `.claude/`).
- `dev-genie/lib/eslint-effective-config.js` — flat-config inheritance resolver with `eslint --print-config` fallback.

When invoked as a skill, callers should:

1. Resolve the repo path (default = `process.cwd()`).
2. `require` the modules and call `detectConfig(repoPath)`. (CLI smoke: `node dev-genie/skills/project-detection/detect-config.js [repo]`.)
3. Pass the resulting report to the `reconcile` skill.

## Report shape

```
{
  repoPath: <absolute>,
  hasPackageJson: <bool>,

  eslint: {
    found, files, flat, legacy,
    extendsChain: [<resolved presets / files>],   // populated by eslint-effective-config.js
    effectiveRules: { <ruleName>: <severity|config> },
    notes
  },

  typescript: {
    found, files,
    extendsChain: [...],
    effectiveOptions: { ... },
    notes
  },

  prettier: { found, files, notes },

  hooks: {
    husky: <bool>,
    lefthook: <bool>,
    nativePreCommit: <bool>,        // .git/hooks/pre-commit content sniff
    preCommitFramework: <bool>,     // .pre-commit-config.yaml
    files,
    notes
  },

  ci: {
    found, dir, workflows: [{ path, runsLint, runsTypecheck, runsAudit, runsBuild }],
    anyRunsLint, anyRunsTypecheck, anyRunsAudit, anyRunsBuild
  },

  scripts: { found, files, notes },     // package.json scripts: lint/typecheck/...
  packageScripts: { ... },              // raw package.json#scripts mirror

  audit: {
    hasDir, hasBaseline, hasHook,       // baseline + hook probe
    files, notes
  },

  packageManager: { found, files, notes },

  agentConfigs: [
    {
      path: 'CLAUDE.md',
      rawContent: '...',
      rules: ['Use TS strict', ...],
      locks: [{ pattern: 'eslint.config.*', reason: 'do not modify ...', sourceLine: 12 }, ...]
    },
    ...
  ]
}
```

## Detection rules (summary)

- **Eslint**: candidates `eslint.config.{mjs,cjs,js,ts}` then legacy `.eslintrc*`. Static-parse `extends`/imports first; fall back to `npx eslint --print-config <repo>/<sample>` for fully resolved rules.
- **TypeScript**: walk `extends` recursively (relative path or `node:require.resolve` semantics), merge `compilerOptions`.
- **Prettier**: presence of `.prettierrc*` or `prettier` field in `package.json`.
- **Hooks**: directory/file probes for `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`; sniff `.git/hooks/pre-commit` for non-default content.
- **CI**: parse known workflow files, line-scan for `lint`/`typecheck`/`audit`/`build` invocations.
- **Audit state**: presence of `.audit/`, `.audit/audit.config.json` (baseline), and a pre-commit hook (sniff for `audit` invocation).
- **Agent configs**: glob root files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.windsurfrules`) plus `.cursor/rules/**/*.md` and `.claude/**/*.md`. Parse phrase-based locks ("do not modify X", "X is locked", "never edit X") and fenced `locked: [...]` blocks.

## Constraints

- Never write, install, or modify the target repo.
- Heuristic only: when static parse cannot resolve a config, prefer `eslint --print-config` over guessing.
- Tolerate parse errors gracefully — record the failure on the relevant report field rather than throwing.
- Output must be JSON-serializable so it round-trips through `.dev-genie/init.last-run.json`.
