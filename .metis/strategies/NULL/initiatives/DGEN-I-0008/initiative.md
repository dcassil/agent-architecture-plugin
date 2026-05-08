---
id: edit-time-lint-type-feedback-for
level: initiative
title: "Edit-time lint/type feedback for AI agents"
short_code: "DGEN-I-0008"
created_at: 2026-05-08T20:37:12.385165+00:00
updated_at: 2026-05-08T20:37:12.385165+00:00
parent: 
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/discovery"


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

## Why ship this in dev-genie rather than DIY

- **Discoverability.** Most teams don't know Claude Code hooks exist. Bundling into `/dev-genie-init` makes it the default, not the expert move.
- **Composability.** Same project-detection, architecture catalog, idempotent-install pattern the audit plugin already uses. Zero new abstractions.
- **Consistency across agents.** Codex, Cursor, etc. each have their own hook surface. dev-genie can ship analogous configs once the canonical ESLint script exists.
