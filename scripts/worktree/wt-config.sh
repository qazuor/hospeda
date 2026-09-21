#!/usr/bin/env bash
# wt-config.sh — resolve repo root + load .claude/project.config.json.
# Source it as a lib:  source wt-config.sh; ROOT=$(wt_root); wt_cfg '.baseBranch'
# Or run standalone:   wt-config.sh   (prints + validates; exit 2 if no config)

wt_root() { git rev-parse --show-toplevel 2>/dev/null; }
wt_config_path() { echo "$(wt_root)/.claude/project.config.json"; }
wt_have_config() { [ -f "$(wt_config_path)" ]; }

wt_cfg() { # $1 = jq filter
  local cfg; cfg="$(wt_config_path)"
  [ -f "$cfg" ] || { echo "NO_CONFIG" >&2; return 1; }
  jq -r "$1 // empty" "$cfg"
}

# --- worktree state file (gitignored, per worktree) ---
wt_state_path() { echo "$(wt_root)/.claude/worktree-state.local.json"; }
wt_state_ensure() {
  local f; f="$(wt_state_path)"
  [ -f "$f" ] || { mkdir -p "$(dirname "$f")"; echo '{"branch":null,"createdAt":null,"servers":[],"db":null}' > "$f"; }
}
wt_state_apply() { # $1 = jq program transforming the doc (current doc is .)
  local f tmp; f="$(wt_state_path)"; wt_state_ensure
  tmp="$(mktemp)"; jq "$1" "$f" > "$tmp" && mv "$tmp" "$f"
}
wt_state_get() { local f; f="$(wt_state_path)"; [ -f "$f" ] && jq -r "${1} // empty" "$f" 2>/dev/null; }

# --- schema staleness fingerprint (HOS-68) ---
# A content fingerprint over the files that determine what a DB schema-heal
# (drizzle migrations + apply-extras) needs to do, driven by the project-configured
# .db.schemaFingerprintPaths (repo-relative paths, empty/absent = feature off).
# Covers new tables, new columns, and new "extras" objects (trigger/matview/
# constraint) with a single cheap local hash — no Postgres round-trip.

# wt_schema_fingerprint <base_dir> — fingerprint of the configured paths as they
# exist on disk under <base_dir> (a live worktree checkout, or a materialized
# ref — see wt_schema_fingerprint_ref). Echoes empty string if the config key
# is unset or none of the configured paths exist under <base_dir>.
wt_schema_fingerprint() {
  local base="$1" cfg paths existing=()
  cfg="$(wt_config_path)"
  [ -f "$cfg" ] || return 0
  mapfile -t paths < <(jq -r '.db.schemaFingerprintPaths[]? // empty' "$cfg" 2>/dev/null)
  [ "${#paths[@]}" -eq 0 ] && return 0
  local p
  for p in "${paths[@]}"; do
    [ -e "$base/$p" ] && existing+=("$base/$p")
  done
  [ "${#existing[@]}" -eq 0 ] && return 0
  find "${existing[@]}" -type f \( -name '*.sql' -o -name '*.ts' \) -print0 2>/dev/null \
    | xargs -0 sha256sum 2>/dev/null \
    | sed "s|${base}/||" \
    | sort \
    | sha256sum \
    | cut -d' ' -f1
}

# wt_schema_fingerprint_ref <git-ref> — same fingerprint, but computed against a
# git ref instead of a live worktree (used to check "is the shared template
# stale vs origin/<baseBranch>" before a worktree for that ref even exists).
# Materializes only the configured paths via `git archive`, no full checkout.
wt_schema_fingerprint_ref() {
  local ref="$1" root cfg paths tmp fp
  root="$(wt_root)"
  cfg="$(wt_config_path)"
  [ -f "$cfg" ] || return 0
  mapfile -t paths < <(jq -r '.db.schemaFingerprintPaths[]? // empty' "$cfg" 2>/dev/null)
  [ "${#paths[@]}" -eq 0 ] && return 0
  tmp="$(mktemp -d)"
  git -C "$root" archive "$ref" -- "${paths[@]}" 2>/dev/null | tar -x -C "$tmp" 2>/dev/null
  fp="$(wt_schema_fingerprint "$tmp")"
  rm -rf "$tmp"
  printf '%s' "$fp"
}

# wt_template_fingerprint <base_dir> — schema plus seed/config inputs that define
# a reproducible golden template. Kept separate from the schema-only fingerprint
# because changing example data must also invalidate the template.
wt_template_fingerprint() {
  local base="$1" cfg paths existing=()
  cfg="$(wt_config_path)"
  [ -f "$cfg" ] || return 0
  mapfile -t paths < <(jq -r '.db.templateFingerprintPaths[]? // empty' "$cfg" 2>/dev/null)
  [ "${#paths[@]}" -eq 0 ] && { wt_schema_fingerprint "$base"; return; }
  local p
  for p in "${paths[@]}"; do [ -e "$base/$p" ] && existing+=("$base/$p"); done
  [ "${#existing[@]}" -eq 0 ] && return 0
  find "${existing[@]}" -type f \( -name '*.sql' -o -name '*.ts' -o -name '*.json' \) -print0 2>/dev/null \
    | xargs -0 sha256sum 2>/dev/null | sed "s|${base}/||" | sort | sha256sum | cut -d' ' -f1
}

wt_template_fingerprint_ref() {
  local ref="$1" root cfg cfg_rel ref_cfg paths tmp fp
  root="$(wt_root)"; cfg="$(wt_config_path)"
  [ -f "$cfg" ] || return 0
  cfg_rel="${cfg#"$root"/}"
  ref_cfg="$(git -C "$root" show "$ref:$cfg_rel" 2>/dev/null || true)"
  mapfile -t paths < <(printf '%s' "$ref_cfg" | jq -r '.db.templateFingerprintPaths[]? // empty' 2>/dev/null)
  [ "${#paths[@]}" -eq 0 ] && { wt_schema_fingerprint_ref "$ref"; return; }
  tmp="$(mktemp -d)"
  git -C "$root" archive "$ref" -- "${paths[@]}" 2>/dev/null | tar -x -C "$tmp" 2>/dev/null
  fp="$(wt_template_fingerprint "$tmp")"
  rm -rf "$tmp"
  printf '%s' "$fp"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  root="$(wt_root)" || { echo "Not in a git repo"; exit 1; }
  [ -z "$root" ] && { echo "Not in a git repo"; exit 1; }
  echo "Repo root: $root"
  cfg="$(wt_config_path)"
  if [ -f "$cfg" ]; then
    echo "Config:     $cfg"
    if jq empty "$cfg" 2>/dev/null; then echo "Valid JSON: yes"; else echo "Valid JSON: NO"; exit 1; fi
    echo "baseBranch: $(jq -r '.baseBranch // "?"' "$cfg")"
    echo "protected:  $(jq -r '(.protectedBranches // []) | join(", ")' "$cfg")"
    echo "servers:    $(jq -r '[.servers[]?.name] | join(", ")' "$cfg")"
    echo "db.mode:    $(jq -r '.db.mode // "none"' "$cfg")"
  else
    echo "Config:     MISSING ($cfg)"
    echo "→ infer from package.json + apps/*, show to user, then write it."
    exit 2
  fi
fi
