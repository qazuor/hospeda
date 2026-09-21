#!/usr/bin/env bash
# wt-up.sh — idempotent "one command up": DB + env + build + servers + health wait.
# Run from INSIDE the worktree. Safe to re-run — exits 0 if already fully up.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -n "$ROOT" ] || { echo "ERROR: not inside a git repo"; exit 1; }
[ -f "$CFG" ] || { echo "ERROR: no .claude/project.config.json found"; exit 2; }

wt_state_ensure

# Parse flags. --refresh forces the full (re)prepare cycle (install/gen/env/build)
# even when all servers are already up — use it after editing the env registry,
# pulling new deps, or changing a shared package.
REFRESH=0
for arg in "$@"; do
  case "$arg" in
    --refresh|-r) REFRESH=1 ;;
    *) echo "wt-up: ignoring unknown arg '$arg' (supported: --refresh)" >&2 ;;
  esac
done

# ---------------------------------------------------------------------------
# STEP 1 — idempotency check: all servers already running AND actually serving?
# A pid alive check alone is not enough — tsx watch stays alive even after a
# server crash. We probe one level deeper:
#   - server with healthPath → one HTTP probe (curl, max 2s)
#   - server without healthPath → one TCP port probe (/dev/tcp connect)
# If the pid is alive but the serve-check fails, fall through to (re)start.
# ---------------------------------------------------------------------------
mapfile -t SRV_NAMES < <(jq -r '.servers[].name' "$CFG")

# srv_is_up <name> <index> — returns 0 only if pid alive AND serving.
srv_is_up() {
  local name="$1" idx="$2"
  local pid port health_path
  pid="$(wt_state_get ".servers[] | select(.name==\"$name\") | .pid")"
  port="$(wt_state_get ".servers[] | select(.name==\"$name\") | .port")"
  # No pid recorded → definitely not up.
  [ -z "$pid" ] && return 1
  # Pid not alive → process is gone.
  kill -0 "$pid" 2>/dev/null || return 1
  # Pid alive — verify the server is actually serving.
  health_path="$(jq -r ".servers[$idx].healthPath // empty" "$CFG")"
  if [ -n "$health_path" ]; then
    # HTTP probe: one attempt, 2s timeout.
    curl -fsS --max-time 2 "http://localhost:${port}${health_path}" >/dev/null 2>&1 || return 1
  else
    # TCP probe: attempt a connect via /dev/tcp.
    bash -c "exec 3<>/dev/tcp/localhost/${port}" 2>/dev/null || return 1
  fi
  return 0
}

all_up=1
idx=0
for name in "${SRV_NAMES[@]}"; do
  if ! srv_is_up "$name" "$idx"; then
    all_up=0; break
  fi
  idx=$((idx+1))
done

if [ "$all_up" -eq 1 ] && [ "$REFRESH" -eq 0 ]; then
  echo "== already up (all servers running and serving) =="
  echo
  for name in "${SRV_NAMES[@]}"; do
    port="$(wt_state_get ".servers[] | select(.name==\"$name\") | .port")"
    printf "  %-8s http://localhost:%s\n" "$name" "$port"
  done
  echo
  echo "Test logins: <slug>@local.test / Password123!"
  echo "(13 dev users; see packages/seed/CLAUDE.md for the full matrix)"
  exit 0
fi

echo "== wt-up: $ROOT =="

# ---------------------------------------------------------------------------
# STEP 0 — bootstrap so the worktree is self-sufficient even if it never went
# through wt-create (or it's the main repo with no .env.local). Only runs on a
# (re)start path — the fast "already up" exit above skipped this unless --refresh.
#   0a. install deps when the lockfile changed or node_modules is missing
#   0b. regenerate .env.example from the env registry (picks up WIP registry edits)
#   0c. seed/merge each app's .env.local from its .env.example
# Runs BEFORE the DB (0c is consumed by wt-db) and BEFORE wt-env (ports), which
# overwrite DATABASE_URL and the port vars afterwards.
# ---------------------------------------------------------------------------
# 0a — conditional install
LOCK="$ROOT/pnpm-lock.yaml"
need_install=0
if [ ! -d "$ROOT/node_modules" ]; then
  need_install=1
elif [ -f "$LOCK" ] && [ "$(sha1sum "$LOCK" | cut -d' ' -f1)" != "$(wt_state_get '.lockHash')" ]; then
  need_install=1
fi
if [ "$need_install" -eq 1 ]; then
  echo "-- installing dependencies (node_modules missing or lockfile changed)"
  ( cd "$ROOT" && pnpm install --frozen-lockfile ) || { echo "ERROR: pnpm install failed"; exit 1; }
  [ -f "$LOCK" ] && wt_state_apply ".lockHash = \"$(sha1sum "$LOCK" | cut -d' ' -f1)\""
fi

# client-tools is outside the pnpm workspace and needs its own Bun install.
CLIENT_TOOLS_INSTALL="$ROOT/scripts/worktree/wt-client-tools-install.sh"
if [ -x "$CLIENT_TOOLS_INSTALL" ]; then
  bash "$CLIENT_TOOLS_INSTALL" "$ROOT"
fi

# 0b — regenerate .env.example from the registry (best-effort; needs tsx in node_modules)
if [ -d "$ROOT/node_modules" ] && jq -e '.scripts["gen:env-examples"]' "$ROOT/package.json" >/dev/null 2>&1; then
  echo "-- regenerating .env.example from registry (gen:env-examples)"
  ( cd "$ROOT" && pnpm gen:env-examples ) >/dev/null 2>&1 \
    || echo "  (warning) gen:env-examples failed — using committed .env.example"
fi

# 0c — seed/merge .env.local files
echo "-- preparing .env.local files"
ENV_COPY_SCRIPT="${HOPS_ENV_COPY_SCRIPT:-$ROOT/scripts/copy-env-to-worktree.sh}"
[ -x "$ENV_COPY_SCRIPT" ] || { echo "ERROR: env copy script is not executable: $ENV_COPY_SCRIPT" >&2; exit 1; }
HOPS_ENV_RECONCILE=1 bash "$ENV_COPY_SCRIPT" "$ROOT" || {
  echo "ERROR: trusted env copy failed" >&2
  exit 1
}
bash "$HERE/wt-env-prepare.sh" || { echo "ERROR: wt-env-prepare.sh failed"; exit 1; }

# ---------------------------------------------------------------------------
# STEP 2 — discover free ports (one per server, servers[] order)
# ---------------------------------------------------------------------------
echo "-- discovering free ports"
declare -a PORTS=()
while IFS=' ' read -r _name port; do
  [ -z "$_name" ] && continue
  PORTS+=("$port")
done < <(bash "$HERE/wt-ports.sh")
[ "${#PORTS[@]}" -lt "${#SRV_NAMES[@]}" ] && { echo "ERROR: wt-ports.sh returned fewer ports than servers"; exit 1; }

# ---------------------------------------------------------------------------
# STEP 3+4 — DB: verify existence + schema + test users against Postgres.
# Never trust the state file — it can claim a DB exists after a drop.
# ensure-ready does: pg_database check → create if missing → schema check →
# auto-heal (full provision chain) if missing → test-users check → seed if < 13.
# ---------------------------------------------------------------------------
echo "-- ensuring DB is ready (verifying against Postgres)"
bash "$HERE/wt-db.sh" ensure-ready || { echo "ERROR: wt-db.sh ensure-ready failed"; exit 1; }

# ---------------------------------------------------------------------------
# STEP 5 — rewrite port-dependent env vars
# ---------------------------------------------------------------------------
echo "-- writing port env vars"
bash "$HERE/wt-env.sh" "${PORTS[@]}" || { echo "ERROR: wt-env.sh failed"; exit 1; }

# ---------------------------------------------------------------------------
# STEP 6 — extra feature env (worktree-extra-env.json, versioned, no secrets)
# ---------------------------------------------------------------------------
EXTRA_ENV_FILE="$ROOT/.claude/worktree-extra-env.json"
if [ -f "$EXTRA_ENV_FILE" ]; then
  echo "-- applying worktree-extra-env.json"
  # Build server name->port map for placeholder substitution.
  # Placeholders: {api} {admin} {web} matching servers[] names.
  upsert_extra() { # $1 abs-file  $2 key  $3 value
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
  fill_extra() { # $1 value template with {name} placeholders
    local s="$1" i=0
    for n in "${SRV_NAMES[@]}"; do
      s="${s//\{$n\}/${PORTS[$i]}}"
      i=$((i+1))
    done
    printf '%s' "$s"
  }
  # Iterate over each "rel/path/to/file.env" -> { KEY: VALUE } entry.
  while IFS= read -r rel_file; do
    abs_file="$ROOT/$rel_file"
    echo "  -> $rel_file"
    while IFS=$'\t' read -r k vtmpl; do
      val="$(fill_extra "$vtmpl")"
      upsert_extra "$abs_file" "$k" "$val"
      echo "    $k = $val"
    done < <(jq -r --arg f "$rel_file" '.[$f] | to_entries[] | [.key, .value] | @tsv' "$EXTRA_ENV_FILE")
  done < <(jq -r 'keys[]' "$EXTRA_ENV_FILE")
fi

# ---------------------------------------------------------------------------
# STEP 7 — rebuild shared packages only (turbo-cached, cheap when unchanged).
# Dev servers (api/admin/web) run in watch mode and don't need a production
# build — only packages/* need dist/ built before the dev servers can import
# them. Read from setup.build (single source of truth shared with wt-create.sh,
# see HOS-68 — a hardcoded literal here and a config-driven build in
# wt-create.sh had drifted out of sync, breaking wt-create.sh); default matches
# the packages-only filter so any project without the key set stays safe.
# ---------------------------------------------------------------------------
BUILD="$(jq -r '.setup.build // "pnpm exec turbo run build --filter=\"./packages/*\""' "$CFG")"
echo "-- building shared packages (turbo-cached): $BUILD"
( cd "$ROOT" && eval "$BUILD" ) || {
  echo "ERROR: packages build failed — aborting server start (fix build errors first)"
  exit 1
}

# ---------------------------------------------------------------------------
# STEP 8 — start servers
# ---------------------------------------------------------------------------
echo "-- starting servers"
bash "$HERE/wt-servers.sh" start "${PORTS[@]}" || { echo "ERROR: wt-servers.sh start failed"; exit 1; }

# ---------------------------------------------------------------------------
# STEP 9 — health wait (gap 4): poll each server until ready or 60s timeout
# ---------------------------------------------------------------------------
echo "-- waiting for servers to be ready"
# Keep the production default conservative, while allowing deterministic tests
# and local diagnostics to use a shorter bound without editing the script.
TIMEOUT="${HOPS_HEALTH_TIMEOUT:-60}"
HEALTH_FAILED=0

wait_http() { # $1 port  $2 health_path
  local port="$1" hpath="$2" elapsed=0
  while [ "$elapsed" -lt "$TIMEOUT" ]; do
    if curl -fsS --max-time 2 "http://localhost:${port}${hpath}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2; elapsed=$((elapsed+2))
  done
  return 1
}

wait_tcp() { # $1 port
  local port="$1" elapsed=0
  while [ "$elapsed" -lt "$TIMEOUT" ]; do
    if bash -c "exec 3<>/dev/tcp/localhost/${port}" 2>/dev/null; then
      return 0
    fi
    sleep 2; elapsed=$((elapsed+2))
  done
  return 1
}

i=0
for name in "${SRV_NAMES[@]}"; do
  port="${PORTS[$i]}"
  health_path="$(jq -r ".servers[$i].healthPath // empty" "$CFG")"
  printf "  waiting for %-8s (:%s) ... " "$name" "$port"
  if [ -n "$health_path" ]; then
    if wait_http "$port" "$health_path"; then
      echo "ready (HTTP ${health_path})"
    else
      echo "TIMEOUT (still starting — check .claude/wt-logs/${name}.log)"
      HEALTH_FAILED=1
    fi
  else
    if wait_tcp "$port"; then
      echo "ready (TCP)"
    else
      echo "TIMEOUT (still starting — check .claude/wt-logs/${name}.log)"
      HEALTH_FAILED=1
    fi
  fi
  i=$((i+1))
done

if [ "$HEALTH_FAILED" -ne 0 ]; then
  echo
  echo "ERROR: one or more servers failed their health check; environment is not ready."
  exit 1
fi

# ---------------------------------------------------------------------------
# STEP 10 — print URL table + test login pointer
# ---------------------------------------------------------------------------
echo
echo "== wt-up complete =="
echo
printf "  %-8s  %s\n" "APP" "URL"
printf "  %-8s  %s\n" "---" "---"
i=0
for name in "${SRV_NAMES[@]}"; do
  printf "  %-8s  http://localhost:%s\n" "$name" "${PORTS[$i]}"
  i=$((i+1))
done
echo
echo "Test logins: <slug>@local.test / Password123!"
echo "(13 dev users covering every role × plan; see packages/seed/CLAUDE.md)"
