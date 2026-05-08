#!/usr/bin/env bash
# guardrails/scripts/lint-edited-file.sh
#
# Claude Code PostToolUse hook: read tool_input JSON from stdin, run eslint
# on the edited file, propagate non-zero so the agent's turn hard-fails.
#
# Performance: prefers `eslint_d` (long-lived daemon, ~50-150ms per call) when
# available — DGEN-T-0049 measured raw `eslint` cold-start at ~1.2s, which is
# above the 300ms budget for default-on edit-time hooks (DGEN-T-0055). Falls
# back to plain `eslint` with `--cache` if the daemon is not installed.
#
# Override the binary explicitly via $GUARDRAILS_ESLINT_BIN (used by tests).

set -euo pipefail

FILE="$(jq -r '.tool_input.file_path // empty')"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

ESLINT_BIN=""
if [ -n "${GUARDRAILS_ESLINT_BIN:-}" ]; then
  ESLINT_BIN="$GUARDRAILS_ESLINT_BIN"
elif [ -x "node_modules/.bin/eslint_d" ]; then
  ESLINT_BIN="node_modules/.bin/eslint_d"
elif [ -x "node_modules/.bin/eslint" ]; then
  ESLINT_BIN="node_modules/.bin/eslint"
else
  exit 0
fi

# `--cache` is a no-op for eslint_d but a meaningful speedup for plain eslint.
"$ESLINT_BIN" --max-warnings=0 --cache --cache-location ".eslintcache" "$FILE" 1>&2 || exit 2
