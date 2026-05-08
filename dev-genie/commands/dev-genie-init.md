---
description: One-shot bootstrap for the dev-genie meta-plugin. Detects the project type, then walks the agent through installing and configuring each dev-genie sub-plugin in order (guardrails → audit → ...). Leaves the repo with guardrails active, an architecture chosen (or skipped), `.audit/` seeded, and a pre-commit hook installed.
---

You are running the dev-genie one-time bootstrap flow. dev-genie owns no scoring logic, scaffolds, or per-stack rules — its only job is to drive sub-plugin setup in the right order. The single source of truth for that order is the `orchestration` skill.

## Steps

1. **Detect the project.** Read `${CLAUDE_PLUGIN_ROOT}/skills/project-detection/SKILL.md` (or `dev-genie/skills/project-detection/SKILL.md` if not running as a plugin) and run its checks against the current working directory. Capture the structured output (`project_kind`, `suggested_architecture`, `confidence`, `raw_signals`, `notes`). Show the result to the user before proceeding.

   **Branch on project_kind.** If `project_kind == existing` (any of eslint / tsconfig / scripts / hooks already present), take the **existing-repo branch**: invoke the bin script and stop after it returns:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/bin/dev-genie-init.mjs --repo <cwd> [--arch <id>] [--mode <mode>] [--dry-run]
   ```

   (or `node dev-genie/bin/dev-genie-init.mjs ...` outside plugin mode). The script orchestrates `detectConfig → compareConfig → formatReport → applyFindings`, persists the resolved plan to `.dev-genie/init.last-run.json` for idempotent re-runs, prompts the user for arch (when `confidence != high`) and apply mode (`dry-run | auto-critical | interactive | apply-all | quit`), and prints the final applied/skipped/errors summary. Pass `--dry-run` for a no-write preview.

   The bin script delegates to two skills:
   - `dev-genie/skills/existing-config-detection/SKILL.md` — read-only detection (lint/ts/format/hook/CI/audit-state/agent-configs+locks).
   - `dev-genie/skills/reconcile/SKILL.md` — comparator, lock-resolution prompts, fenced-block writer, layered eslint config writer, and apply.

   For the **greenfield branch** (`project_kind == greenfield` — no manifests, no eslint/tsconfig/scripts/hooks), continue with the original orchestration steps below.

2. **Load the orchestration registry.** Read `${CLAUDE_PLUGIN_ROOT}/skills/orchestration/SKILL.md` (or `dev-genie/skills/orchestration/SKILL.md` if not running as a plugin). The Sub-plugin registry section is the ordered list of work for this command.

3. **Walk the registry in order.** For each entry — currently `guardrails` then `audit`:
   a. Run the entry's **install check**. If the sub-plugin is not reachable, instruct the user to install it as a Claude Code plugin and pause until they confirm.
   b. If the entry is already configured (e.g. `.audit/audit.config.json` exists for audit), confirm with the user before re-running. Default to skipping.
   c. Confirm with the user before invoking the setup command, especially if the step may run elevated commands (`npm install -g`, `brew install`, etc.).
   d. **Invoke the sub-plugin's own setup command**, do not re-implement its logic:
      - For `guardrails`: invoke `/scaffold-architecture <pattern>`. Pass `suggested_architecture` from project-detection if `confidence` is `high`. Otherwise, list the four catalog options and ask the user. If the user prefers to skip scaffolding (existing repo with its own architecture), record that and continue.
      - For `audit`: invoke `/audit-init`.
   e. Run the entry's **post-setup verification** and report the result.

4. **Confirm final state.** After every entry completes, run the orchestration skill's **Final-state checklist** and report any unmet item with the specific follow-up command needed. If guardrails was already scaffolded in the repo before the edit-time lint hook shipped, the right top-up is `/guardrails-add-edit-hook` rather than a full re-scaffold.

## Edit-time lint hook (Q3)

`/scaffold-architecture` ends in the `universal-guard-rails` skill, which now asks a third question (**Q3**) offering to install a Claude Code `PostToolUse` hook on `Edit|Write|MultiEdit` that runs `guardrails/scripts/lint-edited-file.sh` against each edited file. The merger (`dev-genie/lib/claude-settings-merger.mjs`) keys idempotency on the `command` value `guardrails/scripts/lint-edited-file.sh`.

- **Default is "yes"**: architecture skills install `eslint_d` as a devDependency, so the hook runs through the warm daemon (~50–150ms per edit) instead of cold-start `eslint` (~1.2s).
- For already-scaffolded repos that want to opt in later, point users at `/guardrails-add-edit-hook`.
- To disable hooks once installed, set `"disableAllHooks": true` in `.claude/settings.json` (or `~/.claude/settings.json`); see Claude Code hooks documentation for the canonical, up-to-date disable mechanism.

## Guardrails

- Stop and ask before any destructive action (writing files that already exist, running elevated installers, modifying git hooks).
- Never bypass a sub-plugin's own setup flow. dev-genie delegates; it does not duplicate.
- If the user re-runs `/dev-genie-init` on a repo that's already bootstrapped (signals: existing architecture configs, `.audit/audit.config.json` present, pre-commit hook installed), default to a status report rather than re-running anything. Ask before touching state that already exists.
- If a future sub-plugin appears in the orchestration registry but isn't yet installed, the install-check pause covers it — no special handling needed here.
