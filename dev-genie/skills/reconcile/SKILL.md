---
name: reconcile
description: Compares an existing repo's detected config against the recommended baseline, classifies each rule, groups findings by severity, prompts the user to resolve agent-config locks, and applies the chosen changes. Human-facing wrapper around `lib/compare-config.js`, `lib/report.js`, and `lib/apply-flow.js`.
---

# reconcile

This skill drives the **plan + reconcile + apply** phases of the existing-repo branch of `/dev-genie-init`. It assumes the `existing-config-detection` skill has already produced a structured report.

The skill itself is procedural — the heavy lifting lives in:

- `dev-genie/lib/compare-config.js` — produces a list of findings with `{ category, key, status, severity, expected, actual, diff }`.
- `dev-genie/lib/report.js` — formats findings for terminal output (`formatReport`, `formatSummary`, `toJSON`).
- `dev-genie/lib/apply-flow.js` — `applyFindings({ repoPath, archId, findings, mode })`.
- `dev-genie/lib/agent-config-writer.js` — `writeAgentBlock` + `liftLock`.
- `dev-genie/lib/eslint-layered-writer.js` — optional layered eslint config writer.

## Classifications

Each finding carries a `status` that maps to the design's five classifications:

| design term                | implementation `status` |
| -------------------------- | ----------------------- |
| already-present-equivalent | `present`               |
| already-present-weaker     | `weaker`                |
| already-present-conflicting| `conflicting`           |
| absent-and-file-unlocked   | `missing` + no lock     |
| absent-and-file-locked     | `missing` + lock match  |

The `absent-and-file-locked` case is detected at apply time by `apply-flow.js` consulting `detect-agent-config.js#findLockForPath` on the finding's target file.

## Severity tiers

`compare-config.js` assigns a `severity` of `critical`, `recommended`, or `optional` to each finding. The rule of thumb:

- **critical** — would silently break correctness or hide bugs (`@typescript-eslint/no-floating-promises`, `tsconfig.strict`).
- **recommended** — strong default for the chosen architecture (`no-console`, `no-explicit-any`).
- **optional** — stylistic / preference rules.

## Prompt cadence

The default mode is **per-group** confirmation: the user sees one prompt per severity tier (`[a]ll / [n]one / [s]elect / [q]uit`), with `[s]elect` falling through to per-finding prompts.

For **critical-severity findings** and **lock resolutions**, prompts are always per-finding regardless of mode.

Non-interactive modes:

- `dry-run` — print the report and exit; never write.
- `apply-all` — apply every actionable finding except locked ones (which are skipped).
- `auto-critical` — apply critical-severity findings only; skip everything else.

## Lock resolution

When a finding's target file is matched by a lock in any agent config (CLAUDE.md, AGENTS.md, GEMINI.md, .windsurfrules, .cursor/rules/, .claude/), the user is offered three choices in interactive mode:

| choice         | effect                                                                                 |
| -------------- | -------------------------------------------------------------------------------------- |
| `skip`         | Do not apply the finding. The lock stays. The agent file is unchanged.                 |
| `lift-temp`    | Apply this run only. The lock language is left in place; future runs will prompt again.|
| `lift-perm`    | Apply, AND rewrite the lock line in the agent file (commented out via `liftLock()`).   |

In non-interactive modes, the default is **always `skip`**. Locks are never silently lifted.

## Eslint write strategies

When the user has an existing flat eslint config that extends a third-party preset (e.g. `@vercel/style-guide`), the **layered writer** is preferred:

- Writes `eslint.config.guardrails.mjs` next to the user config.
- That file imports the user's config and re-exports `[...userConfig, { rules: { ... } }]`.
- The user's entry point is **not** modified by default; the user is told to run with `--config eslint.config.guardrails.mjs` or wire a package script.

When the user has only a legacy `.eslintrc*`, the layered writer falls back and the existing **managed-block writer** (`writeEslintManagedBlock` in `apply-flow.js`) is used instead. That path emits a sentinel-fenced override block in the user's existing config.

## Idempotent re-runs

After every non-dry-run apply, `bin/dev-genie-init.mjs` writes `.dev-genie/init.last-run.json` via `lib/plan-store.js`. On the next run:

- The prior plan is loaded.
- `diffPlan(currentPlan, prior)` flags new findings.
- The CLI prints how many findings are unchanged so the user can quickly confirm a re-run.

A `repoFingerprint` (sha256 of tracked config files) detects manual edits since the last run; a mismatch triggers a full re-prompt.

## Cross-references

- `dev-genie/skills/existing-config-detection/SKILL.md`
- `dev-genie/skills/orchestration/SKILL.md`
- `dev-genie/RECONCILIATION.md`
