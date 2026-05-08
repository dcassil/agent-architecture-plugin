---
description: One-shot setup of the audit plugin in this repo — installs depcruise + scc, seeds .audit/audit.config.json with defaults, takes a baseline composite-score scan, and registers a pre-commit hook that blocks regressions.
---

You are running the audit plugin's one-time setup flow.

Invoke the `audit-setup` skill end-to-end against the current repo:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/audit-setup/SKILL.md` (or `audit/skills/audit-setup/SKILL.md` if not running as a plugin).
2. Execute every numbered step in order: Node 18+ check, install `dependency-cruiser` + `scc`, create `.audit/` and seed `audit.config.json`, run `node audit/scripts/audit.mjs --update` to take the baseline, install the pre-commit hook via `bash audit/scripts/install-hook.sh`, verify the hook runs cleanly.
3. Stop and ask the user before any step that requires elevated permissions (e.g. `npm install -g`, `brew install`).
4. After installation, remind the user to commit `.audit/audit.config.json` and `.audit/audit.results.json` so the team shares one baseline.

If the audit plugin appears to already be installed (`.audit/audit.config.json` exists), confirm with the user before re-baselining — re-running may overwrite their existing results.
