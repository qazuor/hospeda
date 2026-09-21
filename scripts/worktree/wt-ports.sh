#!/usr/bin/env bash
# wt-ports.sh — pick free ports for this worktree's servers, avoiding ports held
# by OTHER worktrees (their worktree-state.local.json) and by listening processes.
# Prints one "<name> <port>" line per server (servers[] order).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
CFG="$(wt_config_path)"
[ -f "$CFG" ] || { echo "NO_CONFIG"; exit 2; }

# Ports currently LISTENING on the host.
listening() {
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH 2>/dev/null | awk '{print $4}' | sed 's/.*://'
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $9}' | sed 's/.*://'
  fi
}

# Ports recorded by OTHER worktrees' state files.
reserved() {
  git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}' | while read -r wt; do
    f="$wt/.claude/worktree-state.local.json"
    [ -f "$f" ] && jq -r '.servers[]?.port // empty' "$f" 2>/dev/null
  done
}

mapfile -t USED < <( { listening; reserved; } | grep -E '^[0-9]+$' | sort -un)
is_used() { local p="$1" u; for u in "${USED[@]:-}"; do [ "$u" = "$p" ] && return 0; done; return 1; }

# First free port at/after $1, also avoiding ports already chosen this run.
declare -a CHOSEN=()
chosen_has() { local p="$1" c; for c in "${CHOSEN[@]:-}"; do [ "$c" = "$p" ] && return 0; done; return 1; }
free_from() { local p="$1"; while is_used "$p" || chosen_has "$p"; do p=$((p+1)); done; echo "$p"; }

# Start each server's search at defaultPort+100 to stay clearly off the defaults.
while read -r name dport; do
  [ -z "$name" ] && continue
  port=$(free_from $(( dport + 100 )))
  CHOSEN+=("$port")
  echo "$name $port"
done < <(jq -r '.servers[] | "\(.name) \(.defaultPort)"' "$CFG")
