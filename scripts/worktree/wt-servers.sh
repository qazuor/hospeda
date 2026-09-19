#!/usr/bin/env bash
# wt-servers.sh start <port1> <port2> ...   — start each server in servers[] order
# wt-servers.sh stop                          — kill all tracked servers (process group)
# Each server runs in its own process group (setsid) so cleanup kills the whole tree
# (pnpm -> vite/astro/tsx), not just the wrapper. Run from INSIDE the worktree.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -f "$CFG" ] || { echo "NO_CONFIG"; exit 2; }
ACTION="${1:?usage: wt-servers.sh start <ports...> | stop}"
LOGDIR="$ROOT/.claude/wt-logs"; mkdir -p "$LOGDIR"

state_add_server() { # name port pid log
  local f tmp; f="$(wt_state_path)"; wt_state_ensure; tmp=$(mktemp)
  jq --arg n "$1" --argjson p "$2" --argjson pid "$3" --arg log "$4" \
    '.servers += [{name:$n,port:$p,pid:$pid,log:$log}]' "$f" >"$tmp" && mv "$tmp" "$f"
}

case "$ACTION" in
  start)
    shift
    mapfile -t NAMES < <(jq -r '.servers[].name' "$CFG")
    [ "$#" -lt "${#NAMES[@]}" ] && { echo "need ${#NAMES[@]} ports (one per server)"; exit 1; }
    wt_state_apply '.servers = []'
    i=0
    for name in "${NAMES[@]}"; do
      i=$((i+1)); port="${!i}"
      method="$(jq -r ".servers[$((i-1))].portMethod // \"flag\"" "$CFG")"
      startcmd="$(jq -r ".servers[$((i-1))].startCmd" "$CFG")"
      portenv="$(jq -r ".servers[$((i-1))].portEnvVar // empty" "$CFG")"
      cmd="${startcmd//\{port\}/$port}"
      log="$LOGDIR/${name}.log"
      if [ "$method" = "env" ] && [ -n "$portenv" ]; then
        setsid env "$portenv=$port" bash -c "cd '$ROOT' && exec $cmd" >"$log" 2>&1 < /dev/null &
      else
        setsid bash -c "cd '$ROOT' && exec $cmd" >"$log" 2>&1 < /dev/null &
      fi
      pid=$!
      state_add_server "$name" "$port" "$pid" "$log"
      echo "started $name on :$port (pgid $pid) → $log"
    done
    echo "Servers launching. Logs: $LOGDIR/. Health-check before driving the browser."
    ;;

  stop)
    f="$(wt_state_path)"
    [ -f "$f" ] || { echo "no state file"; exit 0; }
    jq -r '.servers[]? | "\(.pid) \(.name)"' "$f" | while read -r pid name; do
      [ -z "$pid" ] && continue
      # Kill the whole process group (negative pid).
      if kill -TERM "-$pid" 2>/dev/null; then echo "stopped $name (pgid $pid)"
      elif kill -TERM "$pid" 2>/dev/null; then echo "stopped $name (pid $pid)"
      else echo "$name (pid $pid) not running"; fi
    done
    wt_state_apply '.servers = []'
    ;;

  *) echo "unknown action: $ACTION"; exit 1 ;;
esac
