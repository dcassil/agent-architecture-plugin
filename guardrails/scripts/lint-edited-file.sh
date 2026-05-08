#!/usr/bin/env bash
# guardrails/scripts/lint-edited-file.sh
#
# Claude Code PostToolUse hook: read tool_input JSON from stdin, run eslint
# on the edited file, propagate non-zero so the agent's turn hard-fails.

set -euo pipefail

FILE="$(jq -r '.tool_input.file_path // empty')"
[ -z "$FILE" ] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

[ -x "node_modules/.bin/eslint" ] || exit 0

node_modules/.bin/eslint --max-warnings=0 "$FILE" 1>&2 || exit 2
