---
id: build-idempotent-pre-commit-hook
level: task
title: "Build idempotent pre-commit hook installer script"
short_code: "DGEN-T-0008"
created_at: 2026-05-08T18:02:39.046889+00:00
updated_at: 2026-05-08T18:18:36.184644+00:00
parent: DGEN-I-0002
blocked_by: []
archived: false

tags:
  - "#task"
  - "#phase/completed"


exit_criteria_met: false
strategy_id: NULL
initiative_id: DGEN-I-0002
---

# Build idempotent pre-commit hook installer script

## Parent Initiative

[[DGEN-I-0002]]

## Objective

Author `audit/scripts/install-hook.sh`: a plain shell script that installs (or updates) a `.git/hooks/pre-commit` hook in the host repo which invokes `node audit/scripts/audit.mjs --no-update`. Must be safe to re-run, must compose with existing hooks (don't clobber), and must NOT introduce a husky / package-manager dependency.

## Acceptance Criteria

## Acceptance Criteria

## Acceptance Criteria

- [ ] `audit/scripts/install-hook.sh` is a POSIX-compatible bash script with `set -euo pipefail`.
- [ ] If `.git/hooks/pre-commit` does not exist: write a fresh hook that invokes `node audit/scripts/audit.mjs --no-update` and exit on non-zero.
- [ ] If a pre-commit hook already exists and was NOT installed by audit: append the audit invocation behind a clearly marked `# >>> audit-plugin >>>` / `# <<< audit-plugin <<<` block, preserving the existing content.
- [ ] If a pre-commit hook already contains the audit block: replace the block in place (idempotent re-install) without duplicating.
- [ ] Installed hook is `chmod +x`.
- [ ] Script is safe to run from any cwd inside a git repo (resolves git root via `git rev-parse --show-toplevel`).
- [ ] Refuses to run outside a git repo with a clear error.
- [ ] An `--uninstall` flag removes the audit block (and removes the hook entirely if it becomes empty).

## Implementation Notes

### Technical Approach
- Use sentinel comment markers to locate and replace the audit block — simple sed/awk fence rewrite.
- Hook script body is short: `node "$REPO_ROOT/audit/scripts/audit.mjs" --no-update || exit $?`.
- For non-Node host repos: hook will surface a clear error if `node` is missing; document Node 18+ requirement in audit-setup.

### Dependencies
- DGEN-T-0007 (audit.mjs entry point) must exist for the hook to invoke.

### Risk Considerations
- Existing hooks managed by other tools (husky, pre-commit framework): the marker-block approach makes our addition obvious and removable. Document this interaction in the audit-setup skill.
- Symlinked `.git/hooks` directories (e.g., `core.hooksPath`): respect `git config core.hooksPath` and install there if set.

## Status Updates

- 2026-05-08: Implemented `audit/scripts/install-hook.sh` (POSIX bash, `set -euo pipefail`). Idempotent install via sentinel markers `# >>> audit-plugin >>>` / `# <<< audit-plugin <<<`.
- Manually tested in a throwaway `/tmp` repo: (1) fresh install creates a hook with shebang + audit block; (2) re-install preserves marker count = 1 pair (no duplication); (3) appending to a pre-existing user hook preserves prior content; (4) `--uninstall` strips the audit block while keeping the user hook.
- Resolves git root via `git rev-parse --show-toplevel`; respects `core.hooksPath` (relative or absolute); refuses to run outside a git repo with a clear error. `chmod +x` applied on every write.