#!/usr/bin/env bash
# wt-env.sh <port-for-server1> <port-for-server2> ... — rewrite port-dependent env
# vars in this worktree's .env.local files per config.portEnvWrites.
# Ports are positional, matching config.servers[] order. Placeholders {name} in the
# value templates are replaced with that server's chosen port.
# Run from INSIDE the worktree.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -f "$CFG" ] || { echo "NO_CONFIG"; exit 2; }

mapfile -t NAMES < <(jq -r '.servers[].name' "$CFG")
declare -A PORT
idx=0
for n in "${NAMES[@]}"; do
  idx=$((idx+1)); PORT[$n]="${!idx:?missing port arg for server '$n'}"
done

# Replace {name} placeholders with chosen ports.
fill() { local s="$1" n; for n in "${NAMES[@]}"; do s="${s//\{$n\}/${PORT[$n]}}"; done; printf '%s' "$s"; }

# Upsert KEY=VALUE: replace existing line or append.
upsert() { # $1 abs-file  $2 key  $3 value
  local f="$1" key="$2" val="$3"
  [ -f "$f" ] || { echo "  (skip, missing) $f"; return 0; }
  if grep -qE "^${key}=" "$f"; then
    if command -v sd >/dev/null 2>&1; then
      sd "^${key}=.*" "${key}=${val}" "$f"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$f"
    fi
  else
    printf '%s=%s\n' "$key" "$val" >> "$f"
  fi
}

# Emit "KEY<TAB>VALUE_TEMPLATE" pairs and rewrite each.
jq -c '.portEnvWrites[]?' "$CFG" | while read -r entry; do
  rel=$(printf '%s' "$entry" | jq -r '.file')
  abs="$ROOT/$rel"
  echo "-> $rel"
  printf '%s' "$entry" | jq -r '.vars | to_entries[] | [.key, .value] | @tsv' \
    | while IFS=$'\t' read -r k vtmpl; do
        val="$(fill "$vtmpl")"
        upsert "$abs" "$k" "$val"
        echo "    $k = $val"
      done
done
echo "env rewrite done."
