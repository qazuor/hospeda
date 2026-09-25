#!/usr/bin/env bash
# uninstall.sh — remove the fish functions written by install.sh.
# Leaves the source tree alone: it is versioned with the repo.
set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Uso: scripts/client-tools/uninstall.sh"
  echo "Elimina únicamente wrappers fish generados por client-tools."
  exit 0
fi

FISH_FUNCTIONS="$HOME/.config/fish/functions"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$HERE/../.." && pwd)"
GENERIC_PREFIX="qz-"
PROJECT_PREFIX="hops-"
if [ -f "$PROJECT_ROOT/.qz/project.json" ] && command -v jq >/dev/null 2>&1; then
  GENERIC_PREFIX="$(jq -r '.commands.genericPrefix // "qz-"' "$PROJECT_ROOT/.qz/project.json")"
  PROJECT_PREFIX="$(jq -r '.commands.projectPrefix // "hops-"' "$PROJECT_ROOT/.qz/project.json")"
fi

remove_function() {
  local name="$1" target="$FISH_FUNCTIONS/$1.fish"
  if [ -f "$target" ]; then
    rm "$target"
    echo "borrado: $target"
  fi
}

remove_function hops
while IFS=$'\t' read -r name _summary kind; do
  [ -n "$name" ] || continue
  if [ "$kind" = "generic" ]; then
    remove_function "${GENERIC_PREFIX}${name}"
  else
    remove_function "${PROJECT_PREFIX}${name}"
  fi
  # Clean wrappers produced by older installers without touching unrelated
  # fish functions; this can be removed after the compatibility window.
  remove_function "hops-${name}"
done < <(bun "$HERE/src/index.ts" --commands)

echo "listo."
