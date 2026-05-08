---
name: orchestration
description: Canonical, ordered registry of dev-genie sub-plugins. Tells the agent which sub-plugins to install, in what order, how to detect each one is already installed, which setup command to invoke, and how to verify it succeeded. Adding a new sub-plugin = appending one entry to the registry below.
---

# dev-genie orchestration

dev-genie owns no scoring logic, no scaffolds, and no per-stack rules. Its sole job is to drive sub-plugin setup in the right order. This skill is the **single source of truth** for that order.

## How to use this skill

When invoked (typically by the `/dev-genie-init` command):

1. Optionally read the `project-detection` skill first to gather context (greenfield vs. existing, suggested architecture). Pass that context into the registry walk below.
2. Walk the **Sub-plugin registry** in order. For each entry:
   a. Run its **install check**. If already installed, ask the user whether to re-run setup or skip.
   b. Confirm with the user before invoking the setup (especially before any step requiring elevated permissions).
   c. Invoke the **setup command** by reading and following the linked command file.
   d. Run the **post-setup verification** and report the result.
3. After all entries succeed, run the **Final-state checklist** at the bottom and report any unmet item.

Stop and ask the user before any destructive action. Never bypass a sub-plugin's own setup flow.

## Sub-plugin registry (ordered)

The order matters: guardrails must run before audit so audit takes its baseline against the scaffolded result, not against an empty repo.

### 1. guardrails

- **Purpose**: architecture scaffolds + per-stack guard rails skills.
- **Install check**: a guardrails plugin is reachable. Practical signals: `${CLAUDE_PLUGIN_ROOT}/../guardrails/` exists, OR a `guardrails/` directory exists at the workspace root, OR the `/scaffold-architecture` slash command is registered. If none of these is true, instruct the user to install the `guardrails` plugin and pause.
- **Setup command**: `/scaffold-architecture <pattern>`. The pattern should be the `suggested_architecture` from project-detection if confidence is high; otherwise ask the user to choose from `react-next-vercel-webapp`, `node-api`, `supabase-api`, `supabase-node-rag`, or **skip** if the repo already has its own architecture.
- **Post-setup verification**: confirm that either (a) `eslint.config.mjs` and `tsconfig.json` from the chosen architecture exist in the target dir, or (b) the user explicitly skipped scaffolding because the repo already has a chosen architecture.
- **Notes**: `/scaffold-architecture` itself invokes the `universal-guard-rails` skill at the end. Do not duplicate that here.

### 2. audit

- **Purpose**: composite-score scan + regression-blocking pre-commit hook.
- **Install check**: an audit plugin is reachable. Practical signals: `${CLAUDE_PLUGIN_ROOT}/../audit/` exists, OR an `audit/` directory exists at the workspace root, OR the `/audit-init` slash command is registered. If `.audit/audit.config.json` already exists in the target repo, treat audit as already-baselined and confirm with the user before re-running.
- **Setup command**: `/audit-init`.
- **Post-setup verification**: confirm `.audit/audit.config.json` and `.audit/audit.results.json` exist in the target repo, and that a pre-commit hook (typically `.git/hooks/pre-commit`) was installed and runs cleanly.

## Adding a new sub-plugin

To extend dev-genie with a new sub-plugin (e.g. `security-review`, `test-coverage`, `doc-coverage`):

1. Append a new numbered entry to the **Sub-plugin registry** above. Choose its position carefully — entries earlier in the list run first, and any entry that consumes results from another plugin must come after it (the audit-after-guardrails rule is the canonical example).
2. Each entry must specify all four fields: **Purpose**, **Install check**, **Setup command**, **Post-setup verification**.
3. If the new plugin needs to influence the final-state checklist, add a line there too.
4. Do not introduce a separate config file or registry format. The registry is this markdown file by design — one place to edit, no parsing.

## Final-state checklist

After walking the registry, verify the project ends up with:

- [ ] guardrails skills are reachable (the user can invoke `/scaffold-architecture` and the per-architecture skill for their chosen pattern), OR the user explicitly opted out of scaffolding.
- [ ] An architecture is chosen for the project, or the user explicitly chose to skip.
- [ ] `.audit/audit.config.json` exists and contains thresholds.
- [ ] `.audit/audit.results.json` exists with a baseline scan.
- [ ] A pre-commit hook is installed and runs the audit re-scan on commit.

Report any unchecked item to the user with the specific follow-up command needed (e.g. "re-run `/audit-init`" or "install the `audit` plugin").
