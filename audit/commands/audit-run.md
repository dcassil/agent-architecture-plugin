---
description: Run the audit scanner now and rewrite the baseline. Use after an intentional refactor — distinct from the silent --no-update scan that the pre-commit hook performs.
---

You are running an ad-hoc audit scan that updates the stored baseline.

**This command intentionally rewrites `.audit/audit.results.json`.** Use it when the user has finished a deliberate refactor and wants future commits compared against the new (presumably better) scores. The pre-commit hook never writes the baseline — only this command and `/audit-init` do.

Steps:

1. Verify the plugin is installed: check that `.audit/audit.config.json` exists at the repo root. If not, tell the user to run `/audit-init` first and stop.
2. From the repo root, run:
   ```sh
   node audit/scripts/audit.mjs --update
   ```
3. Capture the previous and new composite scores (the previous values are in `.audit/audit.results.json` BEFORE the run — read them first, then run the command).
4. Print a compact table for the user:

   | composite | previous | current | delta |
   |---|---|---|---|
   | architecture | … | … | … |
   | maintainability | … | … | … |
   | testability | … | … | … |
   | health | … | … | … |

5. Highlight the most-changed raw metric per regressed (or improved) composite using the `dominant` field in `.audit/audit.results.json` and the corresponding raw metric values in `scanMetrics`.
6. Remind the user this command rewrote the baseline — to commit `.audit/audit.results.json` so the team picks up the new floor.

Distinction from the pre-commit hook:
- Hook: `audit.mjs --no-update` — read-only, blocks on regression, never writes.
- This command: `audit.mjs --update` — always writes, never blocks.
