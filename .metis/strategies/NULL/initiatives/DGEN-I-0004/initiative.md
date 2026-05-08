---
id: wire-repo-as-claude-code-plugin
level: initiative
title: "Wire repo as Claude Code plugin marketplace"
short_code: "DGEN-I-0004"
created_at: 2026-05-08T19:10:07.700201+00:00
updated_at: 2026-05-08T19:13:54.704446+00:00
parent: DGEN-V-0001
blocked_by: []
archived: false

tags:
  - "#initiative"
  - "#phase/completed"


exit_criteria_met: false
estimated_complexity: S
strategy_id: NULL
initiative_id: wire-repo-as-claude-code-plugin
---

# Wire repo as Claude Code plugin marketplace

## Context

I-0001/0002/0003 produced three working plugin directories — `guardrails/`, `audit/`, `dev-genie/` — but only `guardrails/` has a `.claude-plugin/plugin.json`, and the only `marketplace.json` lives nested inside it and lists only itself. As a result, adding this repo as a Claude Code marketplace today would surface only `guardrails`; `audit/` and `dev-genie/` are not recognized as plugins and cannot be installed. The composability story in DGEN-V-0001 (`/dev-genie-init` walks the user through installing the sub-plugins) is non-functional until these manifests exist and the repo exposes a single marketplace at its root.

## Goals & Non-Goals

**Goals:**
- A repo-root `.claude-plugin/marketplace.json` that lists all three plugins (`guardrails`, `audit`, `dev-genie`) with correct relative `source` paths and accurate descriptions.
- `audit/.claude-plugin/plugin.json` exists with name, description, and any required manifest fields, so commands/skills under `audit/` are discovered when the plugin is installed.
- `dev-genie/.claude-plugin/plugin.json` exists with the same.
- A user can `/plugin marketplace add` this repo and see all three plugins offered.
- Installing `dev-genie` and running `/dev-genie-init` produces the documented end state (guardrails + audit installed, scaffold chosen or skipped, baseline + hook in place).

**Non-Goals:**
- No new plugin features. Manifest + marketplace wiring only.
- No publishing to a public marketplace registry. Local/git-based install only.
- No changes to the existing `guardrails/.claude-plugin/plugin.json` beyond what's needed to coexist with a root marketplace.

## Detailed Design

**Files to add:**

- `.claude-plugin/marketplace.json` (repo root) — single marketplace entry with three plugins:
  ```json
  {
    "name": "dev-genie",
    "owner": { "name": "Daniel Cassil", "email": "me@danielcassil.com" },
    "plugins": [
      { "name": "dev-genie",  "source": "./dev-genie",  "description": "..." },
      { "name": "guardrails", "source": "./guardrails", "description": "..." },
      { "name": "audit",      "source": "./audit",     "description": "..." }
    ]
  }
  ```
- `audit/.claude-plugin/plugin.json` — name=`audit`, description scoped to composite scoring + pre-commit hook.
- `dev-genie/.claude-plugin/plugin.json` — name=`dev-genie`, description scoped to bootstrapping the ecosystem.

**Decisions:**
- Resolve duplication: the existing `guardrails/.claude-plugin/marketplace.json` is now redundant. Either delete it, or keep it so `guardrails/` is still installable as a standalone marketplace from its own subdir. Default: delete it; the root marketplace covers installation, and individual plugins remain installable by source path.
- `dev-genie` is listed first in the marketplace so users discover it as the entry point.

**Verification:**
- `/plugin marketplace add /path/to/this-repo` → all 3 plugins listed.
- `/plugin install dev-genie` → succeeds; `/dev-genie-init` is discoverable.
- `/plugin install audit` → succeeds; `/audit-init` and `/audit-run` discoverable.
- `/plugin install guardrails` → succeeds; `/scaffold-architecture` discoverable.

## Alternatives Considered

- **Three separate marketplaces (one per plugin)** — rejected: forces users to add three sources to install the ecosystem; defeats the umbrella story.
- **Keep marketplace.json nested inside `guardrails/`** — rejected: a repo-as-marketplace user can't see audit or dev-genie that way.
- **Skip plugin.json for `dev-genie/` and treat it as documentation** — rejected: without a manifest the slash command and skills won't load when "installed."

## Implementation Plan

1. Author the two missing `plugin.json` files (`audit/`, `dev-genie/`).
2. Create root `.claude-plugin/marketplace.json` listing all three plugins.
3. Decide on and apply the dedup of `guardrails/.claude-plugin/marketplace.json` (default: delete).
4. Smoke-test: add the repo as a marketplace in a scratch Claude Code session; install all three; verify commands/skills are discoverable.