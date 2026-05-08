#!/usr/bin/env bash
# audit/scripts/install-hook.sh
#
# Idempotently install (or remove) the audit pre-commit hook in the host repo.
# Composes with existing pre-commit hooks via sentinel-marked block.
# Zero npm / husky dependency — plain shell + git.
#
# Usage:
#   bash audit/scripts/install-hook.sh             # install/update
#   bash audit/scripts/install-hook.sh --uninstall # remove the audit block

set -euo pipefail

BEGIN_MARK='# >>> audit-plugin >>>'
END_MARK='# <<< audit-plugin <<<'

uninstall=0
if [ "${1:-}" = "--uninstall" ]; then
  uninstall=1
fi

# Refuse outside a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "audit: install-hook must be run inside a git repo" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Respect core.hooksPath if set
HOOKS_PATH="$(git config --get core.hooksPath || true)"
if [ -z "$HOOKS_PATH" ]; then
  HOOKS_DIR="$REPO_ROOT/.git/hooks"
else
  case "$HOOKS_PATH" in
    /*) HOOKS_DIR="$HOOKS_PATH" ;;
     *) HOOKS_DIR="$REPO_ROOT/$HOOKS_PATH" ;;
  esac
fi

mkdir -p "$HOOKS_DIR"
HOOK_FILE="$HOOKS_DIR/pre-commit"

AUDIT_BLOCK=$(cat <<EOF
$BEGIN_MARK
# Installed by audit/scripts/install-hook.sh — do not edit between markers.
REPO_ROOT="\$(git rev-parse --show-toplevel)"
if [ -f "\$REPO_ROOT/audit/scripts/audit.mjs" ]; then
  node "\$REPO_ROOT/audit/scripts/audit.mjs" --no-update || exit \$?
fi
$END_MARK
EOF
)

strip_block() {
  # Remove existing audit block (between BEGIN_MARK and END_MARK, inclusive).
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    $0==b {skip=1; next}
    $0==e {skip=0; next}
    !skip {print}
  ' "$1"
}

if [ "$uninstall" -eq 1 ]; then
  if [ ! -f "$HOOK_FILE" ]; then
    echo "audit: no pre-commit hook to uninstall."
    exit 0
  fi
  TMP="$(mktemp)"
  strip_block "$HOOK_FILE" > "$TMP"
  # If only the shebang (or nothing meaningful) remains, drop the file.
  if ! grep -qE '[^[:space:]#]' "$TMP"; then
    rm -f "$HOOK_FILE"
    echo "audit: pre-commit hook removed (was audit-only)."
  else
    mv "$TMP" "$HOOK_FILE"
    chmod +x "$HOOK_FILE"
    echo "audit: audit block removed; existing hook preserved at $HOOK_FILE"
  fi
  rm -f "$TMP" 2>/dev/null || true
  exit 0
fi

if [ ! -f "$HOOK_FILE" ]; then
  cat > "$HOOK_FILE" <<EOF
#!/usr/bin/env bash
set -e
$AUDIT_BLOCK
EOF
  chmod +x "$HOOK_FILE"
  echo "audit: installed fresh pre-commit hook at $HOOK_FILE"
  exit 0
fi

# Hook exists. Idempotent re-write of the audit block (or append if missing).
TMP="$(mktemp)"
if grep -qF "$BEGIN_MARK" "$HOOK_FILE"; then
  strip_block "$HOOK_FILE" > "$TMP"
  printf '\n%s\n' "$AUDIT_BLOCK" >> "$TMP"
  mv "$TMP" "$HOOK_FILE"
  echo "audit: updated existing audit block in $HOOK_FILE"
else
  cp "$HOOK_FILE" "$TMP"
  printf '\n%s\n' "$AUDIT_BLOCK" >> "$TMP"
  mv "$TMP" "$HOOK_FILE"
  echo "audit: appended audit block to existing hook $HOOK_FILE"
fi
chmod +x "$HOOK_FILE"
