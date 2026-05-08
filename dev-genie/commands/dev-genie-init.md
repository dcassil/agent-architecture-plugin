---
description: One-shot bootstrap for the dev-genie meta-plugin. Detects the project type, then walks the agent through installing and configuring each dev-genie sub-plugin in order (guardrails → audit → ...). Leaves the repo with guardrails active, an architecture chosen (or skipped), `.audit/` seeded, and a pre-commit hook installed.
---

You are running the dev-genie one-time bootstrap flow. dev-genie owns no scoring logic, scaffolds, or per-stack rules — its only job is to drive sub-plugin setup in the right order. The single source of truth for that order is the `orchestration` skill.

## Steps

1. **Detect the project.** Read `${CLAUDE_PLUGIN_ROOT}/skills/project-detection/SKILL.md` (or `dev-genie/skills/project-detection/SKILL.md` if not running as a plugin) and run its checks against the current working directory. Capture the structured output (`project_kind`, `suggested_architecture`, `confidence`, `raw_signals`, `notes`). Show the result to the user before proceeding.

2. **Load the orchestration registry.** Read `${CLAUDE_PLUGIN_ROOT}/skills/orchestration/SKILL.md` (or `dev-genie/skills/orchestration/SKILL.md` if not running as a plugin). The Sub-plugin registry section is the ordered list of work for this command.

3. **Walk the registry in order.** For each entry — currently `guardrails` then `audit`:
   a. Run the entry's **install check**. If the sub-plugin is not reachable, instruct the user to install it as a Claude Code plugin and pause until they confirm.
   b. If the entry is already configured (e.g. `.audit/audit.config.json` exists for audit), confirm with the user before re-running. Default to skipping.
   c. Confirm with the user before invoking the setup command, especially if the step may run elevated commands (`npm install -g`, `brew install`, etc.).
   d. **Invoke the sub-plugin's own setup command**, do not re-implement its logic:
      - For `guardrails`: invoke `/scaffold-architecture <pattern>`. Pass `suggested_architecture` from project-detection if `confidence` is `high`. Otherwise, list the four catalog options and ask the user. If the user prefers to skip scaffolding (existing repo with its own architecture), record that and continue.
      - For `audit`: invoke `/audit-init`.
   e. Run the entry's **post-setup verification** and report the result.

4. **Confirm final state.** After every entry completes, run the orchestration skill's **Final-state checklist** and report any unmet item with the specific follow-up command needed.

## Guardrails

- Stop and ask before any destructive action (writing files that already exist, running elevated installers, modifying git hooks).
- Never bypass a sub-plugin's own setup flow. dev-genie delegates; it does not duplicate.
- If the user re-runs `/dev-genie-init` on a repo that's already bootstrapped (signals: existing architecture configs, `.audit/audit.config.json` present, pre-commit hook installed), default to a status report rather than re-running anything. Ask before touching state that already exists.
- If a future sub-plugin appears in the orchestration registry but isn't yet installed, the install-check pause covers it — no special handling needed here.
