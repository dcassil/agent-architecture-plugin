---
id: reconcile-dev-genie-init-with
level: initiative
title: "Reconcile dev-genie init with existing agent config and lint/type inheritance"
short_code: "DGEN-I-0006"
created_at: 2026-05-08T19:30:00+00:00
updated_at: 2026-05-08T20:36:35.440862+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: M
strategy_id: NULL
initiative_id: reconcile-dev-genie-init-with
---

# Reconcile dev-genie init with existing agent config and lint/type inheritance

> Combines the original DGEN-I-0005 ("Init dev-genie into existing repos") with the agent-config / lint-inheritance reconciliation scope. I-0005 is superseded and archived.

## Context

`/dev-genie-init` has been dogfooded on greenfield/empty repos. Real-world adoption means dropping it into an **existing codebase** that already has *some* config: `eslint.config.*` (or legacy `.eslintrc`), `tsconfig.json`, `.prettierrc`, possibly Husky/lefthook/pre-commit, possibly CI build steps, possibly partial `.audit/` state. On top of that, real repos have:

1. **Existing agent config files** — `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursor/rules/*.md`, `.windsurfrules`, etc. — that may already declare rules, forbid edits to certain files, or pin behavior the user has invested in. Some explicitly lock files (e.g. "do not modify `eslint.config.mjs`"), which would block dev-genie from writing the very rules it ships. We have no story for detecting locks, asking permission to override them, or merging new rules without trampling existing ones.

2. **Existing lint/type configs with inheritance chains** — `eslint.config.{mjs,cjs,js,ts}`, `.eslintrc.*`, `tsconfig.json`, plus any base configs they `extends`/import from (`@vercel/style-guide`, `eslint-config-next`, `@tsconfig/strictest`, monorepo roots). guardrails today writes its own configs from a scaffold; doing that on top of an existing chain either silently overrides upstream rules or conflicts at runtime. Init must resolve the inheritance graph and decide per-rule whether to layer, override, or skip.

Naively overwriting these destroys user work and erodes trust. Skipping them entirely means dev-genie's guard rails aren't actually enforced. We need an init flow that detects what exists, compares against the recommended baseline, surfaces gaps and conflicts, and asks before changing anything.

## Goals & Non-Goals

**Goals:**
- Detect existing lint/type/format/hook/CI/audit config in a target repo without modifying it.
- Detect existing agent config files and any locks they declare on files dev-genie wants to write.
- Recursively resolve the full lint and tsconfig `extends`/import inheritance chains to learn the *effective* rule set (running `eslint --print-config <sample>` is acceptable when static parse can't resolve dynamic config).
- Compare effective config against the recommended baseline (selected via the existing `project-detection` skill → relevant `arch-*` skill + `universal-guard-rails`) and produce a structured per-rule report: **already-present-equivalent**, **already-present-weaker**, **already-present-conflicting**, **absent-and-file-unlocked**, **absent-and-file-locked**.
- Group findings by severity: **critical / recommended / optional**.
- For each finding, present a clear suggestion with rationale and the exact change. Confirmation is per-group by default with per-finding override on high-impact items.
- Resolve agent-config locks by prompting: (a) skip, (b) lift the lock for this run only, (c) merge dev-genie's rules into the existing file and update the lock language to permit them.
- Write into agent config files using fenced blocks (`<!-- dev-genie:guardrails:begin --> … <!-- dev-genie:guardrails:end -->`) — never raw overwrite. Re-runs diff inside the fence.
- Write a layered eslint config (`eslint.config.guardrails.mjs`) that imports/extends the existing config rather than replacing it.
- Verify lint/typecheck run on **pre-commit AND build/CI**; offer to wire up missing hooks/scripts (Husky/lefthook/native pre-commit, `package.json` scripts, GitHub Actions step). Same check for audit hook + baseline.
- `--dry-run` mode that runs detection + plan and prints everything without writing.
- Idempotent re-runs: a serialized plan at `.dev-genie/init.last-run.json` lets re-runs prompt only on actual changes.

**Non-Goals:**
- No auto-rewrite of base configs from third-party packages (don't fork `@vercel/style-guide`); we layer on top.
- No automatic migration of legacy `.eslintrc` → flat config (detect + recommend only).
- No auto-fixing existing lint violations in user code (only config changes).
- No support for non-TypeScript repos in this initiative (Python/Go/etc. are future work).
- No support for non-standard agent config formats beyond a documented short list (CLAUDE.md, AGENTS.md, GEMINI.md, `.cursor/rules/`, `.windsurfrules`).
- No interactive UI beyond what Claude Code's prompt/confirm flow allows.

## Detailed Design

### Phase A — Discovery scan

A new `dev-genie/skills/existing-config-detection/SKILL.md` runs before any write and produces a structured report:

```
agentConfigs:
  - path: CLAUDE.md
    rules: [...]              # parsed bullet list / sections
    locks: [{ pattern: "eslint.config.*", reason: "..." }, ...]
  - path: AGENTS.md
    ...
lintConfigs:
  - path: eslint.config.mjs
    extendsChain:
      - "@vercel/style-guide/eslint/next"
      - "<resolved local file>"
    effectiveRules: { ... }    # flattened after walking the chain
typeConfigs:
  - path: tsconfig.json
    extendsChain: ["@tsconfig/strictest/tsconfig.json", ...]
    effectiveOptions: { ... }
formatConfigs:
  - path: .prettierrc
hookConfigs:
  husky: false
  lefthook: false
  nativePreCommit: true        # .git/hooks/pre-commit present
  preCommitFramework: false    # .pre-commit-config.yaml
ciConfigs:
  - path: .github/workflows/ci.yml
    runsLint: true
    runsTypecheck: false
    runsAudit: false
packageScripts: { lint, typecheck, audit, ... }
auditState:
  hasDir: true | false
  hasBaseline: true | false
  hasHook: true | false
```

Detection rules:
- Agent config: glob known filenames at repo root + `.cursor/rules/*.md` + `.claude/`.
- Lint inheritance: parse `extends` (legacy) or top-level imports + spread (flat). Static-parse first; fall back to `eslint --print-config <sample>` when dynamic.
- TS inheritance: walk `extends` recursively via `require.resolve` semantics.
- Hook detection: presence of `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, `.git/hooks/pre-commit` content sniff.
- CI: parse known workflow files and pattern-match for `lint`/`typecheck`/`audit` invocations.
- Architecture classification: reuse `dev-genie/skills/project-detection` to pick `arch-*` baseline (next-vercel / node-api / supabase-api / supabase-node-rag).

### Phase B — Plan + reconcile

A `dev-genie/skills/reconcile/SKILL.md` consumes the report + the recommended baseline (from the selected `arch-*` skill + `universal-guard-rails`) and produces a plan.

For each rule:
- **already present, equivalent** → no-op
- **already present, weaker** → recommend strengthening (e.g. `warn → error`); prompt
- **already present, conflicting** → prompt: keep existing / replace / merge if mergeable
- **absent, file unlocked** → write
- **absent, file locked by agent config** → prompt: skip / lift-temporarily / lift-permanently-and-update-agent-config

Findings grouped by severity (critical / recommended / optional). Default confirm prompt is per-group with a "show details" expansion; critical findings prompt per-finding.

Agent config writes use fenced blocks; re-runs diff inside the fence and prompt only on real change.

### Phase C — Apply

The orchestration skill consumes the plan:
- Writes layered lint config (`eslint.config.guardrails.mjs`) that imports/extends the existing entry. With user opt-in, the entry point can be rewritten to import the layered file.
- Writes/updates fenced sections in chosen agent config file(s).
- Wires missing pre-commit / build / CI steps for lint, typecheck, audit (using whichever framework is already present, or native git hooks if none).
- Reconciles audit state: seeds `.audit/` baseline if missing, installs the audit hook if missing or coordinates with existing hook framework.
- Records the resolved plan to `.dev-genie/init.last-run.json` for audit + idempotent re-runs.

### Dry-run

`/dev-genie-init --dry-run` runs A + B, prints the plan grouped by severity, exits without writing.

### Open design questions to resolve during decomposition

- How is the recommended baseline expressed so it's diffable? (Inline in `arch-*` skills as today, or extracted into a machine-readable config file the comparator reads?)
- Granularity of confirmation prompts — per-rule is noisy; per-group risks bundling unwanted changes. Default to per-group + critical-per-finding; revisit if dogfood shows pain.
- Hook-framework cooperation: when Husky or lefthook is already managing pre-commit, dev-genie should add steps via that framework rather than touching `.git/hooks/pre-commit` directly.

## Alternatives Considered

- **Always overwrite existing configs** — destructive on real repos. Rejected.
- **Refuse to init when config exists** — useless for the actual adoption case. Rejected.
- **Always skip when any conflict is detected** — users in existing repos never get enforcement. Rejected.
- **Auto-merge silently using a heuristic** — silent merges of lint/type rules cause subtle behavior changes. Rejected; conflicts must be visible.
- **Detect-only / report-only mode** — useful as a sub-mode, but doesn't deliver the "set up guard rails" value alone. Included as `--dry-run` flag rather than a separate command.
- **Ship a separate `dev-genie-migrate` command** — forks the flow and hides the issue from greenfield users who later add a base config. Baking reconciliation into init keeps one surface.
- **Hard-fail when locks are detected** — doesn't give the user a path forward. Rejected.

## Implementation Plan

1. **Detection module** (`existing-config-detection` skill) — agent-config scanner with lock parsing; lint inheritance resolver (static + `eslint --print-config` fallback); ts inheritance resolver; format/hook/CI scanners; audit-state probe. Unit-test with fixture repos: greenfield, repo with CLAUDE.md + locks, repo with deep eslint extends, monorepo, repo with husky.
2. **Baseline extraction** — make recommended config queryable from `arch-*` skills + `universal-guard-rails` (decide inline-in-skills vs. extracted machine-readable file).
3. **Comparator + report generator** — produce per-rule classification (equivalent / weaker / conflicting / absent-unlocked / absent-locked), grouped by severity (critical / recommended / optional).
4. **Reconcile skill** — prompt UX (per-group default, per-finding for critical and locks), fenced-block writer for agent configs, plan serializer to `.dev-genie/init.last-run.json`.
5. **Wire detection + reconcile into `/dev-genie-init`**; add `--dry-run` flag.
6. **Enforcement wire-up** — pre-commit / build / CI detector and installer that cooperates with Husky / lefthook / native git hooks; covers lint, typecheck, audit.
7. **Audit reconciliation** — coordinate with `/audit-init` so existing `.audit/` state and existing hooks aren't clobbered.
8. **Sub-plugin cooperation** — update `dev-genie/skills/orchestration/SKILL.md` so future sub-plugin setup commands consult the detection report.
9. **Dogfood matrix** — run init on: (a) fresh repo, (b) repo with CLAUDE.md locking eslint.config, (c) repo with `@vercel/style-guide` extends, (d) repo with both, (e) a real existing project. Verify dry-run, prompt flow, idempotent re-runs.
10. **Document the reconciliation flow** in `dev-genie/README.md` (or new `RECONCILIATION.md`).