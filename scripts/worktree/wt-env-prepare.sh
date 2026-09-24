#!/usr/bin/env bash
# wt-env-prepare.sh — ensure each app's .env.local exists and carries every
# REQUIRED var, seeded from the (registry-generated) .env.example sibling.
# Run from INSIDE the worktree.
#
# Behaviour (idempotent):
#   - .env.local missing  -> create it from the .env.example ACTIVE (uncommented
#                            `KEY=value`) lines. Those are the required vars; the
#                            generated placeholders already satisfy length/format
#                            Zod checks, so they work for local dev as-is.
#   - .env.local exists    -> MERGE: append only the active KEYs from .env.example
#                            that are absent. Never overwrite an existing value.
#   - optional override     -> if project.config.json has a `devEnvDefaults` object
#                            ({ "KEY": "value", ... }), upsert those keys last so a
#                            project can pin specific dev values (e.g. shared secrets).
#
# This runs BEFORE wt-db (DATABASE_URL) and wt-env (port vars), which overwrite
# their own keys afterwards. So this script must NOT try to set ports or the DB URL.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -n "$ROOT" ] || { echo "ERROR: not inside a git repo"; exit 1; }
[ -f "$CFG" ] || { echo "NO_CONFIG"; exit 2; }

# Upsert KEY=VALUE into a file: replace the existing line or append.
upsert() { # $1 abs-file  $2 key  $3 value
  local f="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$f" 2>/dev/null; then
    if command -v sd >/dev/null 2>&1; then
      sd "^${key}=.*" "${key}=${val}" "$f"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$f"
    fi
  else
    printf '%s=%s\n' "$key" "$val" >> "$f"
  fi
}

# Collect the set of .env.local targets the project manages. Prefer the explicit
# list in portEnvWrites[].file; fall back to scanning apps/*/.env.example.
mapfile -t TARGETS < <(jq -r '.portEnvWrites[]?.file // empty' "$CFG" | sort -u)
if [ "${#TARGETS[@]}" -eq 0 ]; then
  while IFS= read -r ex; do
    TARGETS+=("${ex%.example}.local")
  done < <(cd "$ROOT" && ls apps/*/.env.example 2>/dev/null)
fi

for rel in "${TARGETS[@]}"; do
  target="$ROOT/$rel"
  example="${target%.local}.example"
  app_dir="$(dirname "$rel")"
  if [ ! -f "$example" ]; then
    echo "  (skip, no .env.example) $app_dir"
    continue
  fi

  if [ ! -f "$target" ]; then
    # Create from all ACTIVE (uncommented) assignments in the example.
    grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$example" > "$target"
    created=$(wc -l < "$target" | tr -d ' ')
    echo "  created $rel ($created required vars from .env.example)"
  else
    # Merge: append active keys from the example that are absent in the target.
    added=0
    while IFS= read -r line; do
      key="${line%%=*}"
      grep -qE "^${key}=" "$target" 2>/dev/null && continue
      printf '%s\n' "$line" >> "$target"
      added=$((added+1))
    done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$example")
    echo "  merged $rel (+$added new vars)"
  fi
done

# Optional per-project dev overrides (e.g. pinned shared dev secrets).
# Shape: { "devEnvDefaults": { "apps/api/.env.local": { "KEY": "value" } } }
# or a flat { "KEY": "value" } applied to every target.
if jq -e '.devEnvDefaults' "$CFG" >/dev/null 2>&1; then
  # Per-file form.
  if jq -e '.devEnvDefaults | to_entries[0].value | type == "object"' "$CFG" >/dev/null 2>&1; then
    while IFS= read -r rel; do
      target="$ROOT/$rel"
      [ -f "$target" ] || continue
      while IFS=$'\t' read -r k v; do
        upsert "$target" "$k" "$v"
        echo "  override $rel: $k"
      done < <(jq -r --arg f "$rel" '.devEnvDefaults[$f] | to_entries[] | [.key, .value] | @tsv' "$CFG")
    done < <(jq -r '.devEnvDefaults | keys[]' "$CFG")
  else
    # Flat form: apply to every managed target.
    for rel in "${TARGETS[@]}"; do
      target="$ROOT/$rel"
      [ -f "$target" ] || continue
      while IFS=$'\t' read -r k v; do
        upsert "$target" "$k" "$v"
        echo "  override $rel: $k"
      done < <(jq -r '.devEnvDefaults | to_entries[] | [.key, .value] | @tsv' "$CFG")
    done
  fi
fi

echo "env prepare done."
