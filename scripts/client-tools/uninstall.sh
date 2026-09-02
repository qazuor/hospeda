#!/usr/bin/env bash
# uninstall.sh — remove the fish functions written by install.sh.
# Leaves the source tree alone: it is versioned with the repo.
set -euo pipefail

FISH_FUNCTIONS="$HOME/.config/fish/functions"

for name in hops hops-stats hops-wt-clean hops-start-issue; do
  target="$FISH_FUNCTIONS/$name.fish"
  if [ -f "$target" ]; then
    rm "$target"
    echo "borrado: $target"
  fi
done

echo "listo."
