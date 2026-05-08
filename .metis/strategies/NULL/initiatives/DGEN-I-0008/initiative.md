---
id: edit-time-lint-type-feedback-for
level: initiative
title: "Edit-time lint/type feedback for AI agents"
short_code: "DGEN-I-0008"
created_at: 2026-05-08T20:37:12.385165+00:00
updated_at: 2026-05-08T21:02:57.433861+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: M
strategy_id: NULL
initiative_id: edit-time-lint-type-feedback-for
---

# Edit-time lint/type feedback for AI agents

**Author:** Daniel Cassil
**Plugins touched:** `guardrails` (or new sibling sub-plugin), `dev-genie` (orchestration entry)

## Context

The current dev-genie stack gives AI agents lint/type feedback at four points:

1. `npm run dev` — **no lint, no typecheck.** Next.js dev server doesn't invoke ESLint, and TS errors only surface for files in the compilation graph.
2. `lint-staged` pre-commit — only runs on **staged** files.
3. `npm run prebuild` / `verify` — runs only on explicit build.
4. CI — runs only after push.

In practice this means an agent can edit a dozen files in a single turn, accumulate violations the whole time, and only discover them when it (or the human) eventually runs `verify`. By then the agent has built on top of bad choices, and the fix is a multi-file rollback rather than a single-line correction.

LSP integration (eslint-lserver) helps humans because squiggles are visually loud, but agents tend to ignore passive output. **The fastest reliable signal for an agent is a hook that fails its turn the moment it writes a bad file.**

## Goals & Non-Goals

**Goals:**
- Add an edit-time ESLint hook (`PostToolUse` on `Edit|Write|MultiEdit`) that hard-blocks on warnings/errors for the file just written.
- Ship via the existing `guardrails` / `universal-guard-rails` flow — no new abstractions.
- Provide a top-up command for repos that already ran the scaffold.
- Keep latency tolerable (target <300ms per edit on reference repos).

**Non-Goals (v1):**
- TypeScript per-file checks (project graph makes this slow — defer to v2).
- Python/Rust/other-ecosystem equivalents.
- File watchers / daemons / IDE integration.

## Detailed Design

### settings.json fragment to scaffold

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "guardrails/scripts/lint-edited-file.sh"
          }
        ]
      }
    ]
  }
}
```

### `guardrails/scripts/lint-edited-file.sh`

```bash
#!/usr/bin/env bash
# Reads $CLAUDE_TOOL_INPUT JSON from stdin, extracts file_path, runs eslint.
# Exits non-zero on any error or warning so the agent's turn fails immediately.

set -euo pipefail

FILE="$(jq -r '.tool_input.file_path // empty')"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

[ -f "node_modules/.bin/eslint" ] || exit 0

node_modules/.bin/eslint --max-warnings=0 "$FILE"
```

Notes:
- Plain shell + jq + node — no new deps. Matches the audit plugin's posture.
- Gracefully no-ops in greenfield repos before `npm install`, so the bootstrap order isn't fragile.
- Hard-blocks on warnings *and* errors via `--max-warnings=0` — same posture as `lint-staged`.

### `universal-guard-rails` SKILL.md addition

Add a third question alongside the existing two:

> **Q3 — Edit-time lint feedback for AI agents**
>
> "Want me to install a Claude Code `PostToolUse` hook that runs `eslint --max-warnings=0` on every file an agent writes? This is the inner loop — agents see lint failures the moment they happen, before they pile up across multiple files."
>
> If **yes**, copy `lint-edited-file.sh` and merge the `hooks.PostToolUse` entry into `.claude/settings.json` (creating it if absent).

### dev-genie orchestration entry

No new entry needed — rides on the existing `guardrails` sub-plugin. `universal-guard-rails` already runs as the final step of `/scaffold-architecture`; the new question slots in there.

For repos that already ran guardrails before this feature shipped, add a one-shot top-up command (`/guardrails-add-edit-hook`) so users don't have to re-scaffold.

## Edge Cases & Open Questions

1. **Multiple settings layers.** Claude Code merges `.claude/settings.json` (project) with `~/.claude/settings.json` (user) and local overrides. Setup writes to project settings (committed) so the gate is consistent across the team.
2. **Disable / bypass.** Document `CLAUDE_HOOKS_DISABLE=1` (or whatever the harness exposes). Don't bake an env-flag escape hatch into the script — would become an attractor for "make the warning go away" patterns.
3. **Latency budget.** ESLint on a single file is ~100–300ms in this codebase. Anything over ~1s would erode adoption — measure across reference repos before defaulting on.
4. **TypeScript per-file.** `tsc --noEmit <file>` doesn't work cleanly (needs project graph). v2 options: (a) skip per-edit TS, (b) use `tsserver` via LSP, (c) whole-project `tsc --noEmit` if small. Recommend deferring to v2.
5. **Files outside src.** Let ESLint decide via project `ignores` (it'll exit 0 for ignored files); suppress "no files matched" noise.
6. **Non-Node ecosystems.** Out of scope v1. Pattern applies to `ruff check <file>`, `cargo clippy --message-format=short`, etc.
7. **Composition with existing PostToolUse hooks.** Installer must append, not overwrite — same idempotent-block-with-sentinels pattern the audit plugin uses for `.git/hooks/pre-commit`.

## Alternatives Considered

- **LSP-only.** Rejected — passive, agents ignore it.
- **`tsc --watch` daemon.** Rejected — agent has to actively read output; we want hard-block semantics.
- **Pre-commit only.** Status quo. Doesn't catch issues before the agent piles up multiple bad edits.
- **Custom per-team script.** What every team currently does. Wastes effort and diverges in posture. Ship one canonical version.

## Implementation Plan

1. Land `lint-edited-file.sh` and `universal-guard-rails` Q3 prompt in a `guardrails` minor version (0.6.0).
2. Update `dev-genie` orchestration docs to mention the new question.
3. Add a `/guardrails-add-edit-hook` top-up command for repos that already ran the scaffold.
4. After a release cycle, evaluate whether to default Q3 to "yes" (Q1/Q2 are opt-in — stay consistent unless metrics say otherwise).

## Implementation Note: exit code 2 + stderr

Change to `.claude/settings.json` (PostToolUse Edit/Write/MultiEdit hook):

Appended `1>&2 || exit 2` to the eslint command:

```bash
node_modules/.bin/eslint --max-warnings=0 "$f" 1>&2 || exit 2
```

**Why:** The original hook exited 1 on lint failure, which Claude Code silently ignores for PostToolUse — the agent never saw the error. Redirecting eslint output to stderr and exiting 2 makes Claude Code surface the lint output as a blocking PostToolUse error, giving the agent immediate feedback to fix violations on the next turn.

**Verified:** Introduced an intentional `any` violation; hook fired and returned the eslint error to the agent as a blocking system-reminder.

## Why ship this in dev-genie rather than DIY

- **Discoverability.** Most teams don't know Claude Code hooks exist. Bundling into `/dev-genie-init` makes it the default, not the expert move.
- **Composability.** Same project-detection, architecture catalog, idempotent-install pattern the audit plugin already uses. Zero new abstractions.
- **Consistency across agents.** Codex, Cursor, etc. each have their own hook surface. dev-genie can ship analogous configs once the canonical ESLint script exists.

## Latency measurements

Measured 2026-05-08 via `DGEN-T-0049`. Wall time captured per-invocation in Python (`time.perf_counter`) wrapping `subprocess.run(['bash', lint-edited-file.sh])` with stdin payload `{"tool_input":{"file_path":"<path>"}}`. 10 samples per condition.

### Environment

- Host: Darwin 25.3.0, arm64 (Apple Silicon).
- Hook script: `guardrails/scripts/lint-edited-file.sh` (uses `jq`, then `node_modules/.bin/eslint --max-warnings=0 <file>`).
- Reference repo: `/Users/danielcassil/Code/BeeLine-Frontend` — Next.js webapp with real `.eslintrc` and ESLint **v8.57.1** installed in `node_modules`.
- Files tested: `src/app/cases/page.tsx` (9 lines, trivial) and `src/app/client-layout.tsx` (163 lines, realistic component).
- No-op repo: `/Users/danielcassil/Code/gaurd-rails-boilerplate` (no `node_modules/.bin/eslint`; script no-ops at the `[ -x ... ]` guard).

### Results (wall-clock per invocation, milliseconds)

| Condition | Repo | min | median | max | p95* |
|---|---|---:|---:|---:|---:|
| ESLint path, `page.tsx` (9 lines) | BeeLine-Frontend | 1130 | 1247 | 2620 | 2620 |
| ESLint path, `client-layout.tsx` (163 lines, 5 samples) | BeeLine-Frontend | 1159 | 1186 | 1201 | 1201 |
| No-op (extension miss, `.txt`) | BeeLine-Frontend | 14 | 14 | 16 | 16 |
| No-op (no `node_modules/.bin/eslint`) | gaurd-rails-boilerplate | 14 | 14 | 16 | 16 |

*p95 reported as max for n=10.

Raw ESLint-path samples (ms, sorted): 1130, 1130, 1143, 1157, 1172, 1323, 1364, 2210, 2401, 2620.

### Verdict

**Does NOT clear the 300ms target. Crosses the 1s blocker threshold for default-on.**

- ESLint cold-start dominates: every invocation re-spawns Node, re-loads ESLint + the project's plugin set (Next.js config, `@typescript-eslint`, etc.). File size barely matters — 9-line and 163-line files both land near 1.2s; the long tail (2.2–2.6s) appears to be cold FS / module resolution variance.
- Hook overhead itself is negligible: ~14ms for the no-op path (jq + bash startup + script logic). The no-op path is well under budget and safe to default-on.
- The script behaves correctly in this repo (no eslint installed -> exits 0 in ~14ms), confirming the greenfield/no-op posture works.

### Mitigation needed before default-on

ESLint cold-start is the bottleneck. Options:
1. **Long-lived ESLint daemon** (e.g. `eslint_d`) — typical 50–150ms per invocation after warmup. Cleanest path to <300ms.
2. **`--cache`** — helps on re-lints of unchanged files but the agent is editing the file, so cache is invalidated each turn.
3. **Keep opt-in / surface latency in the install prompt** — Q3 default stays "ask"; document the 1s+ cost so users opt in eyes-open.

Tracked as a follow-up tech-debt item (see backlog). Until mitigation lands, **do not default Q3 to "yes"**; ship as opt-in with the latency caveat documented.

## Dogfood results (DGEN-T-0054)

End-to-end install + script-level verification on 2026-05-08. Live `PostToolUse` agent-turn-block verification requires a Claude Code harness session in the target repo and is left as a final manual step for the user.

### Install: this repo (`/Users/danielcassil/Code/gaurd-rails-boilerplate`)

- `guardrails/scripts/lint-edited-file.sh` already present, mode 0755.
- First merger run: `{"action":"created","changed":true,...}` — created `.claude/settings.json`.
- Second merger run (idempotence): `{"action":"noop","changed":false,...}` — no duplicate entries.

Resulting `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "guardrails/scripts/lint-edited-file.sh" }
        ]
      }
    ]
  }
}
```

### Install: BeeLine-Frontend (`/Users/danielcassil/Code/BeeLine-Frontend`)

- Copied `lint-edited-file.sh` to `<beeline>/guardrails/scripts/lint-edited-file.sh`, chmod 0755 (created `guardrails/scripts/`).
- Merger run: `{"action":"created","changed":true,...}`.
- Resulting `.claude/settings.json`: identical structure to the boilerplate output above (managed `PostToolUse` entry, matcher `Edit|Write|MultiEdit`, command `guardrails/scripts/lint-edited-file.sh`).

### Script-level test A — clean edit

- This repo: piped `{"tool_input":{"file_path":".../dev-genie/lib/claude-settings-merger.mjs"}}`. The repo has no local `node_modules/.bin/eslint`, so the script took the no-op guard branch. **Exit 0.**
- BeeLine-Frontend: piped `{"tool_input":{"file_path":".../eslint.config.mjs"}}`. ESLint ran clean. **Exit 0.**

### Script-level test B — deliberate violation (BeeLine-Frontend)

Created `<beeline>/src/__dgen_t_0054_violation__.tsx` with `unused: any = 42;` plus a `@ts-ignore`. Piped tool_input JSON, `cd` into BeeLine-Frontend so `node_modules/.bin/eslint` resolved.

**Exit 1.** ESLint output (verbatim):
```
/Users/danielcassil/Code/BeeLine-Frontend/src/__dgen_t_0054_violation__.tsx
  2:9   error  'unused' is assigned a value but never used                                   @typescript-eslint/no-unused-vars
  2:17  error  Unexpected any. Specify a different type                                      @typescript-eslint/no-explicit-any
  3:3   error  Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free  @typescript-eslint/ban-ts-comment

✖ 3 problems (3 errors, 0 warnings)
```

Note: the script as currently committed exits 1 (not 2) and writes ESLint output on stdout. The "Implementation Note: exit code 2 + stderr" section above describes a refinement (`1>&2 || exit 2`) that was not present in the on-disk script at dogfood time — relevant to whether Claude Code surfaces the failure as a blocking PostToolUse error in a live harness session. Flagging here so the user can confirm/apply during live verification.

Temp violation file removed after the test; `src/` itself was a pre-existing directory and was left intact.

### Non-interference with lint-staged / pre-commit

By inspection: the merger only writes to `.claude/settings.json`. It does not touch `package.json`, `.husky/`, `.git/hooks/`, or any `lint-staged`/`prettier` config. Confirmed both repos:
- `/Users/danielcassil/Code/gaurd-rails-boilerplate`: only `.claude/settings.json` was created.
- `/Users/danielcassil/Code/BeeLine-Frontend`: only `.claude/settings.json` was created; `package.json` has no `lint-staged`/`husky` keys and no `.husky/` dir exists, so nothing to collide with regardless. `.git/hooks/` contains only the default `*.sample` files.

### UX surprises

- The `node_modules/.bin/eslint` guard uses `[ -x ... ]`. On a fresh checkout where `node_modules` isn't installed yet, the hook silently no-ops (correct, but invisible). Worth surfacing in the slash-command prompt so users don't think the hook is broken.
- ESLint output goes to stdout on failure with the current script. Combined with the exit-1 vs exit-2 distinction, live agent surfacing depends on how Claude Code maps PostToolUse exit codes — the existing "Implementation Note" above is the right fix; verify it lands in the canonical script.
- `--max-warnings=0` plus exit-1 means a single warning hard-fails the turn. That's the intended posture but worth flagging in onboarding copy so teams with noisy warning baselines opt in eyes-open (consistent with the latency caveat).

### Live agent-turn-block verification

Out of scope for a subagent run — requires a real Claude Code harness session in either target repo making an `Edit|Write|MultiEdit` call. Recommend the user open `BeeLine-Frontend` in Claude Code, ask the agent to introduce a trivial lint violation, and confirm the PostToolUse hook surfaces the error as a blocking system-reminder.