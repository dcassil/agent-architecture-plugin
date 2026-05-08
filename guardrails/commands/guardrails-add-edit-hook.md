---
description: Top-up an already-scaffolded repo with the edit-time ESLint Claude Code hook (PostToolUse on Edit|Write|MultiEdit).
argument-hint: [target-dir]
---

You are installing the guardrails edit-time lint hook into an existing repo. This is a top-up for projects that ran `/scaffold-architecture` before this hook shipped. Use it when the user already has `eslint.config.mjs` + `tsconfig.json` in place and just wants the inner-loop hook.

Target directory: `$1` (default: current working directory)

This is the same mechanism documented as **Setup C** in the `universal-guard-rails` skill. Do not reimplement it — just orchestrate the two existing primitives.

Steps:

1. Resolve the target. If `$1` is empty, use the current working directory. Confirm with the user that the resolved absolute path is the repo they want to modify before writing anything.

2. Copy the hook script. Source is this plugin's `${CLAUDE_PLUGIN_ROOT}/scripts/lint-edited-file.sh`. Destination is `<target>/guardrails/scripts/lint-edited-file.sh`.
   - Create `<target>/guardrails/scripts/` if missing.
   - If the destination file already exists with identical contents, skip the copy and report "script already up to date".
   - If it exists but differs, diff and ask before overwriting.
   - After writing, set the executable bit (`chmod 0755`).

3. Merge the `.claude/settings.json` hook entry. Run the settings merger CLI from this plugin against the target repo:

   ```bash
   node dev-genie/lib/claude-settings-merger.mjs --repo <target>
   ```

   The merger is idempotent — it creates `<target>/.claude/settings.json` if absent, appends a `PostToolUse` matcher for `Edit|Write|MultiEdit` running `guardrails/scripts/lint-edited-file.sh`, and no-ops on re-run. Surface the JSON result it prints (`{"action":"created"|"added"|"updated"|"noop", ...}`).

4. Report. Summarize in two lines:
   - Script: `created` / `already up to date` / `updated`.
   - Settings: the merger's `action` field.

   If both were no-ops, say so plainly — the user has already topped up.

Be terse. Show diffs before overwriting. Do not touch `eslint.config.mjs`, `tsconfig.json`, `package.json`, or anything else — this command's scope is the hook only.
