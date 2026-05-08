# Reconciliation flow

`/dev-genie-init` runs in one of two branches:

- **Greenfield** — the repo has no `package.json`, no `eslint.config.*`, no `tsconfig.json`, no `package.json#scripts`, no git hooks. dev-genie runs the orchestration registry to install guardrails + audit from scratch.
- **Existing repo (reconciliation)** — anything else. dev-genie detects what's already there, compares it to the recommended baseline, surfaces the gap, and asks before changing anything.

This document describes the **reconciliation** branch.

## Pipeline

```
detectConfig            → existing-config-detection SKILL
   ↓
compareConfig           → produces findings { category, key, status, severity, expected, actual, diff }
   ↓
formatReport            → terminal-friendly grouped view
   ↓
[lock resolution]       → for each finding whose target is locked by an agent config, prompt
   ↓
applyFindings           → write changes per chosen mode
   ↓
plan-store.saveLastRun  → .dev-genie/init.last-run.json (idempotent re-runs)
```

## Detection report shape

The `existing-config-detection` skill emits a JSON-serializable report. Top-level keys:

- `repoPath`, `hasPackageJson`
- `eslint` — `{ found, files, notes, extendsChain?, effectiveRules? }`
- `typescript` — `{ found, files, notes, extendsChain?, effectiveOptions? }`
- `prettier`, `hooks` (`{ husky, lefthook, nativePreCommit, preCommitFramework }`)
- `ci`, `scripts`, `packageScripts`
- `audit` — `{ found, hasDir, hasBaseline, hasHook, files, notes }`
- `packageManager`
- `agentConfigs` — `[{ path, rawContent, rules, locks: [{ pattern, reason, sourceLine }] }]`

See `dev-genie/skills/existing-config-detection/SKILL.md` for the full contract.

## Classifications

| design term                | implementation `status` | example                                                |
| -------------------------- | ----------------------- | ------------------------------------------------------ |
| already-present-equivalent | `present`               | rule already set to the same severity                  |
| already-present-weaker     | `weaker`                | rule set to `warn` where baseline expects `error`      |
| already-present-conflicting| `conflicting`           | rule set to `off` where baseline expects `error`       |
| absent-and-file-unlocked   | `missing` + no lock     | rule absent, target file editable                      |
| absent-and-file-locked     | `missing` + lock match  | rule absent, target file forbidden by an agent config  |

The lock check happens at apply time in `apply-flow.js` via `findLockForFinding(repoPath, finding)`.

## Severity tiers

- **critical** — silent correctness bugs. Always per-finding prompt.
- **recommended** — strong defaults for the chosen architecture.
- **optional** — stylistic or preference rules.

## Apply modes

| mode            | behavior                                                                |
| --------------- | ----------------------------------------------------------------------- |
| `dry-run`       | print plan, write nothing                                               |
| `auto-critical` | apply critical-severity findings only; skip everything else              |
| `interactive`   | per-group prompts (`a / n / s / q`); per-finding for critical and locks  |
| `apply-all`     | apply every actionable finding except locked ones (silently skipped)     |
| `quit`          | apply nothing                                                           |

## Lock resolution

When a finding's target file (e.g. `eslint.config.mjs`, `tsconfig.json`, `package.json`) is matched by a lock declared in an agent config, the user picks one of three options in interactive mode:

| choice         | effect                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| `skip`         | Do not apply the finding. The lock stays. Future runs will surface the same finding.         |
| `lift-temp`    | Apply this run only. The lock language is left in place; future runs will prompt again.       |
| `lift-perm`    | Apply, AND rewrite the lock line in the agent file (commented out via `liftLock()`).         |

In non-interactive modes (`auto-critical`, `apply-all`), the default is **always `skip`**. Locks are never silently lifted.

### Worked example

`CLAUDE.md` contains:

```
# Project rules

- Use TypeScript strict mode.
- Do not modify `eslint.config.mjs`.
```

The baseline expects `no-floating-promises: error`. Because `eslint.config.mjs` is locked, the finding becomes `absent-and-file-locked`.

- **skip** → finding moves to `skipped[]`. `CLAUDE.md` unchanged. eslint config unchanged.
- **lift-temp** → eslint rule is written into the user's config (managed-block writer) OR `eslint.config.guardrails.mjs` (layered writer). `CLAUDE.md` unchanged.
- **lift-perm** → same as lift-temp, AND the line `Do not modify \`eslint.config.mjs\`.` is rewritten in `CLAUDE.md` to `<!-- dev-genie lifted lock: Do not modify \`eslint.config.mjs\`. -->`.

## Fenced-block convention

dev-genie writes into agent config files using fenced markers:

```
<!-- dev-genie:guardrails:begin -->
... dev-genie content ...
<!-- dev-genie:guardrails:end -->
```

Re-runs replace **only** the contents between the markers — text before and after is preserved exactly. See `dev-genie/lib/agent-config-writer.js`.

## Eslint write strategies

### Layered (preferred for flat configs)

`dev-genie/lib/eslint-layered-writer.js` writes `eslint.config.guardrails.mjs` next to the user's config. The new file imports the user's config and re-exports `[...userConfig, { rules: { ... } }]`. The user's entry point is **not** modified by default; users are told to run `--config eslint.config.guardrails.mjs` or wire a package script.

Optional `rewriteEntryPoint` rewrites the user's config to a one-liner that re-exports the layered file (with a `.dev-genie.bak` backup written alongside).

### Managed block (fallback for legacy `.eslintrc*`)

`dev-genie/lib/apply-flow.js#writeEslintManagedBlock` writes a sentinel-fenced override into the user's existing config. This is the fallback path for legacy `.eslintrc.json` and friends.

## `.claude/settings.json` (Claude Code hooks)

Separate from the eslint/tsconfig/agent-config writers above, dev-genie can also reconcile a managed `PostToolUse` hook entry in `.claude/settings.json` for the edit-time ESLint feature (initiative `DGEN-I-0008`). The merger lives at `dev-genie/lib/claude-settings-merger.mjs` and is invokable as a CLI:

```
node dev-genie/lib/claude-settings-merger.mjs --repo <target>
```

**Managed-entry detection.** The merger uses the literal `command` value `guardrails/scripts/lint-edited-file.sh` as its idempotency key. On re-run, any existing `PostToolUse` hook whose `command` matches that string is treated as already-managed and is left untouched (or updated in place) rather than appended a second time. Other unrelated `PostToolUse` entries in the user's `.claude/settings.json` are preserved verbatim.

**Top-up command.** Repos that ran `/scaffold-architecture` before the edit-time hook shipped can opt in retroactively via `/guardrails-add-edit-hook`, which is a thin wrapper over the merger CLI above. It does not re-scaffold the architecture.

**Latency.** The hook prefers `eslint_d` (~50–150ms warm) over cold-start `eslint` (~1.2s). Architecture skills install `eslint_d` as a devDependency, so scaffolded repos hit the fast path and Q3 in `universal-guard-rails` **defaults to "yes"**.

**Disable mechanism.** To globally disable hooks once installed, set `"disableAllHooks": true` in `.claude/settings.json` (project), `~/.claude/settings.json` (user), or `.claude/settings.local.json` (local-only). Managed-policy hooks are not affected by user/project/local `disableAllHooks` — see Claude Code hooks documentation for the current authoritative behavior.

## Idempotent re-runs

After every non-dry-run apply, `bin/dev-genie-init.mjs` writes `.dev-genie/init.last-run.json` via `dev-genie/lib/plan-store.js`:

```json
{
  "schemaVersion": 1,
  "timestamp": "...",
  "repoFingerprint": "<sha256-prefix-of-tracked-files>",
  "plan": [...],
  "applied": [...],
  "skipped": [...],
  "errors": [...]
}
```

On the next run, the file is loaded and `diffPlan(currentPlan, lastRun)` flags new findings. `.dev-genie/` is auto-added to `.gitignore` on first run.

A `repoFingerprint` mismatch (because the user manually edited a tracked config file) is reported so the user can re-prompt deliberately.

## Cross-references

- Skill: `dev-genie/skills/existing-config-detection/SKILL.md`
- Skill: `dev-genie/skills/reconcile/SKILL.md`
- Code: `dev-genie/lib/compare-config.js`, `dev-genie/lib/apply-flow.js`, `dev-genie/lib/agent-config-writer.js`, `dev-genie/lib/eslint-layered-writer.js`, `dev-genie/lib/plan-store.js`
- Dogfood matrix: `dev-genie/scripts/dogfood-matrix.mjs` + `dev-genie/scripts/dogfood-matrix.results.md`
