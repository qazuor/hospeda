#!/usr/bin/env bash
# wt-db.sh <create|drop|refresh-template|ensure-ready|ensure-test-users|build-template|sync-dev-and-template>
# Per-worktree DB lifecycle.
# Modes (config.db.mode): template | dump | fresh | none.
# For a SHARED docker container, each worktree gets its own DB inside it
# (createdb), so we never wipe the volume. Run from INSIDE the worktree.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -f "$CFG" ] || { echo "NO_CONFIG"; exit 2; }
ACTION="${1:?usage: wt-db.sh <create|drop|refresh-template|ensure-ready|ensure-test-users|build-template|sync-dev-and-template>}"

MODE="$(jq -r '.db.mode // "none"' "$CFG")"
[ "$MODE" = "none" ] && { echo "db.mode=none — nothing to do"; exit 0; }

DOCKER="$(jq -r '.db.docker // false' "$CFG")"
CONTAINER="$(jq -r '.db.container // empty' "$CFG")"
DBUSER="$(jq -r '.db.user' "$CFG")"
TEMPLATE="$(jq -r '.db.templateDb // empty' "$CFG")"
DEVDB="$(jq -r '.db.devDb // "hospeda_dev"' "$CFG")"
NAMEPAT="$(jq -r '.db.dbNamePattern' "$CFG")"
CONNVAR="$(jq -r '.db.connStringEnvVar' "$CFG")"
CONNFILE="$(jq -r '.db.connStringFile' "$CFG")"
CONNTMPL="$(jq -r '.db.connStringTemplate' "$CFG")"
FRESHCMD="$(jq -r '.db.freshCmd // empty' "$CFG")"
# Schema-staleness sentinel (belt-and-suspenders alongside the fingerprint check,
# HOS-68): tables that MUST exist in a current schema. Kept as an extra safety
# net in case the fingerprint has a bug or a misconfigured schemaFingerprintPaths
# entry — configured per-project via .db.schemaSentinelTables (array of Postgres
# table names); empty/absent = feature disabled.
SENTINEL_TABLES="$(jq -r '.db.schemaSentinelTables // [] | join(" ")' "$CFG")"

# Run a postgres CLI tool, in the container if docker, else locally.
pg() { if [ "$DOCKER" = "true" ]; then docker exec -i "$CONTAINER" "$@"; else "$@"; fi; }
pgsh() { if [ "$DOCKER" = "true" ]; then docker exec -i "$CONTAINER" bash -c "$1"; else bash -c "$1"; fi; }

# Derive a STABLE per-worktree DB slug.
# The worktree PATH is the stable identity of a worktree: it does not change when
# the branch is switched. Deriving from state.branch (the old behavior) caused a
# name-drift bug — a worktree that switched branches resolved to a different DB
# name than the one it created. Rules:
#   1. If a SPEC number is present (in the worktree dir name first, then the branch)
#      → "spec_<NNN>" (human-readable, e.g. worktree_spec_197).
#   2. Otherwise → the sanitized worktree directory basename (stable + unique).
# Note: ensure-ready/drop/refresh-template still prefer state.db when set — this
# derivation is only the fallback for a worktree that has not created its DB yet.
_wt_basename="$(basename "$ROOT")"
_wt_branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
_spec_num="$(printf '%s\n%s' "$_wt_basename" "$_wt_branch" | grep -oiE 'spec[-_]?[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
if [ -n "$_spec_num" ]; then
  SLUG="spec_${_spec_num}"
else
  SLUG="$(printf '%s' "$_wt_basename" | sed 's/[^a-zA-Z0-9]/_/g')"
fi
DBNAME="${NAMEPAT//\{slug\}/$SLUG}"
# Postgres identifiers cap at 63 bytes — truncate defensively (spec_<NNN> never hits this).
DBNAME="$(printf '%s' "$DBNAME" | cut -c1-63)"

set_conn() { # write connString into the env file; optional $1 overrides DBNAME
  local target="${1:-$DBNAME}"
  local f="$ROOT/$CONNFILE" conn="${CONNTMPL//\{dbname\}/$target}"
  [ -f "$f" ] || { echo "WARN: $CONNFILE missing, cannot set $CONNVAR"; return 0; }
  if grep -qE "^${CONNVAR}=" "$f"; then
    if command -v sd >/dev/null 2>&1; then sd "^${CONNVAR}=.*" "${CONNVAR}=${conn}" "$f"
    else sed -i "s|^${CONNVAR}=.*|${CONNVAR}=${conn}|" "$f"; fi
  else printf '%s=%s\n' "$CONNVAR" "$conn" >> "$f"; fi
  echo "  $CONNVAR set in $CONNFILE → $target"
}
state_set_db() { local f tmp; f="$(wt_state_path)"; wt_state_ensure; tmp=$(mktemp); jq --arg d "$1" '.db=($d|select(.!="")//null)' "$f" >"$tmp" && mv "$tmp" "$f"; }
state_set_schema_fingerprint() { local f tmp; f="$(wt_state_path)"; wt_state_ensure; tmp=$(mktemp); jq --arg fp "$1" '.schemaFingerprint=($fp|select(.!="")//null)' "$f" >"$tmp" && mv "$tmp" "$f"; }

# ---------------------------------------------------------------------------
# Internal helpers (shared by create, ensure-ready, ensure-test-users)
# ---------------------------------------------------------------------------

# db_exists <dbname> — returns 0 if the DB exists in Postgres, 1 otherwise.
db_exists() {
  local name="$1" result
  result="$(pgsh "psql -U $DBUSER -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='${name}'\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
  [ "$result" = "1" ]
}

# db_has_users_table <dbname> — returns 0 if public.users exists, 1 otherwise.
db_has_users_table() {
  local name="$1" result
  result="$(pgsh "psql -U $DBUSER -d $name -tAc \"SELECT COALESCE(to_regclass('public.users')::text,'missing')\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
  [ "$result" != "missing" ] && [ -n "$result" ]
}

# db_migration_journal_state <dbname> — return missing, empty or populated.
# A populated schema without this journal was historically created with
# drizzle-kit push; it cannot safely be upgraded by db:migrate because the
# baseline would be replayed over existing tables.
db_migration_journal_state() {
  local name="$1" result
  result="$(pgsh "psql -U $DBUSER -d $name -tAc \"SELECT CASE WHEN to_regclass('drizzle.__drizzle_migrations') IS NULL THEN 'missing' WHEN (SELECT count(*) FROM drizzle.__drizzle_migrations)=0 THEN 'empty' ELSE 'populated' END\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
  printf '%s' "${result:-missing}"
}

# do_create_db <dbname> — low-level: createdb from template (mode=template only).
# Caller must call set_conn + state_set_db afterward.
do_create_db() {
  local name="$1"
  case "$MODE" in
    template)
      [ -z "$TEMPLATE" ] && { echo "db.templateDb required for mode=template"; exit 1; }
      echo "createdb $name --template=$TEMPLATE"
      pg createdb -U "$DBUSER" -T "$TEMPLATE" "$name" 2>&1 \
        || { echo "createdb failed — template busy (active connections) or db exists"; exit 1; } ;;
    dump)
      [ -z "$TEMPLATE" ] && { echo "db.templateDb (source) required for mode=dump"; exit 1; }
      echo "createdb $name + pg_dump $TEMPLATE | psql"
      pg createdb -U "$DBUSER" "$name" 2>&1 || { echo "createdb failed"; exit 1; }
      pgsh "pg_dump -U $DBUSER $TEMPLATE | psql -U $DBUSER -d $name -q" || { echo "dump/restore failed"; exit 1; } ;;
    fresh)
      if printf '%s' "$FRESHCMD" | grep -qiE 'fresh-dev|down +-v|compose +down|--volumes'; then
        echo "ABORT: db.freshCmd ('$FRESHCMD') looks like it WIPES the shared volume."
        echo "For per-worktree fresh DBs use a non-destructive push+seed against the new DB, not a volume wipe."
        exit 1
      fi
      echo "createdb empty $name + freshCmd"
      pg createdb -U "$DBUSER" "$name" 2>&1 || { echo "createdb failed"; exit 1; }
      set_conn
      [ -n "$FRESHCMD" ] && ( cd "$ROOT" && eval "$FRESHCMD" )
      state_set_db "$name"; echo "DB ready: $name"; return 0 ;;
    *) echo "unknown db.mode: $MODE"; exit 1 ;;
  esac
}
# Note: do_create_db returns early (return 0) for mode=fresh after calling set_conn +
# state_set_db. The create) case calls them again below — that is harmless (idempotent).

# do_full_provision <dbname> — run the full schema + seed chain against <dbname>.
# Exports HOSPEDA_DATABASE_URL for the duration of the subshell commands.
do_full_provision() {
  local name="$1"
  local conn="${CONNTMPL//\{dbname\}/$name}"
  echo "  auto-heal: running full provisioning chain for $name"
  echo "  -> pnpm db:migrate"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:migrate ) \
    || { echo "ERROR: pnpm db:migrate failed — aborting auto-heal"; exit 1; }
  echo "  -> pnpm db:apply-extras"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:apply-extras ) \
    || { echo "ERROR: pnpm db:apply-extras failed — aborting auto-heal"; exit 1; }
  echo "  -> pnpm db:seed"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:seed ) \
    || { echo "ERROR: pnpm db:seed failed — aborting auto-heal"; exit 1; }
  echo "  -> pnpm db:seed:test-users"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:seed:test-users ) \
    || { echo "ERROR: pnpm db:seed:test-users failed — aborting auto-heal"; exit 1; }
  echo "  auto-heal complete: $name is fully provisioned"
}

# db_first_missing_sentinel <dbname> — echo the first configured sentinel table
# that is ABSENT from <dbname>, or nothing if all are present / none configured.
db_first_missing_sentinel() {
  local name="$1" t res
  for t in $SENTINEL_TABLES; do
    res="$(pgsh "psql -U $DBUSER -d $name -tAc \"SELECT COALESCE(to_regclass('public.${t}')::text,'missing')\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
    if [ "$res" = "missing" ] || [ -z "$res" ]; then echo "$t"; return 0; fi
  done
}

# do_schema_sync <dbname> — heal a stale-but-populated clone by applying the
# committed Drizzle migrations + the idempotent extras. Do not use db:push here:
# push compares the live database with the TypeScript view and can propose
# dropping columns intentionally owned by the extras carril (for example
# billing_customers.mp_payer_email), then silently no-op when it cannot prompt.
# The migration journal is the safe source of truth for an existing database.
# Deliberately does NOT reseed (db:seed --reset would wipe existing rows and the
# seeder is not incremental) — newly created tables come up empty; example data
# is the template's job (build-template / refresh-template).
do_schema_sync() {
  local name="$1"
  local conn="${CONNTMPL//\{dbname\}/$name}"
  local journal_state
  echo "  auto-heal (stale schema): syncing $name to the current TS schema"
  journal_state="$(db_migration_journal_state "$name")"
  if [ "$journal_state" != "populated" ]; then
    echo "ERROR: migration journal is $journal_state for populated DB '$name'"
    echo "       Rebuild the shared template from an empty database with db:migrate;"
    echo "       refusing to replay the baseline or force db:push automatically."
    exit 1
  fi
  echo "  -> pnpm db:migrate"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:migrate ) \
    || { echo "ERROR: db:migrate failed — aborting stale-schema auto-heal before extras"; exit 1; }
  echo "  -> pnpm db:apply-extras"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$conn" pnpm db:apply-extras ) \
    || { echo "ERROR: db:apply-extras failed — aborting stale-schema auto-heal"; exit 1; }
  echo "  auto-heal complete: $name schema is now current"
}

# do_build_template <srcdb> — (re)build the shared templateDb from <srcdb>.
# Shared by the `build-template` action (manual, one-time helper) and
# `sync-dev-and-template` (automatic, invoked from wt-create.sh). Safe to
# re-run (drop+recreate). createdb -T requires no active connections to
# <srcdb>; falls back to pg_dump | psql (works fine with active connections)
# when that fast path fails.
do_build_template() {
  local srcdb="$1"
  [ -z "$TEMPLATE" ] && { echo "ERROR: db.templateDb not configured"; exit 1; }
  echo "build-template: $srcdb → $TEMPLATE"
  echo "Dropping existing template (if any)..."
  pg dropdb -U "$DBUSER" --if-exists "$TEMPLATE" 2>&1 || true
  echo "Creating $TEMPLATE from $srcdb (createdb -T)..."
  pg createdb -U "$DBUSER" -T "$srcdb" "$TEMPLATE" 2>&1 \
    || pgsh "createdb -U $DBUSER $TEMPLATE && pg_dump -U $DBUSER $srcdb | psql -U $DBUSER -d $TEMPLATE -q" \
    || { echo "ERROR: build-template failed"; exit 1; }
  echo "template '$TEMPLATE' built from '$srcdb'"
}

case "$ACTION" in
  create)
    do_create_db "$DBNAME"
    # do_create_db handles the volume-wipe guard and returns early (return 0) for
    # mode=fresh (already calls set_conn + state_set_db). For template/dump modes
    # we call them here. Duplicate calls for mode=fresh are harmless (idempotent).
    set_conn
    state_set_db "$DBNAME"
    echo "DB ready: $DBNAME" ;;

  ensure-ready)
    # Verify the worktree DB exists and is fully provisioned — verified against
    # Postgres, NEVER trusted from the state file (the state can lie after a drop).
    # Decision tree:
    #   1. Resolve DB name (state → branch slug → dbNamePattern).
    #   2. Exists in Postgres? No → create from template, then full-provision.
    #   3. Has public.users table? No → auto-heal: run full provisioning chain.
    #   4. Has >=13 @local.test users? No → seed test users only.
    # Always syncs set_conn + state after creation so env file + state are correct.

    # Step 1: resolve DB name — prefer state, fall back to branch-derived DBNAME.
    WTDB="$(wt_state_get '.db')"
    [ -z "$WTDB" ] && WTDB="$DBNAME"
    [ -z "$WTDB" ] && { echo "ERROR: cannot derive worktree DB name"; exit 1; }
    echo "ensure-ready: checking $WTDB"

    # Step 2: ensure the DB exists — create from template/mode if missing.
    if ! db_exists "$WTDB"; then
      echo "  DB '$WTDB' does not exist in Postgres — creating"
      do_create_db "$WTDB"
      echo "  DB created: $WTDB"
    else
      echo "  DB '$WTDB' exists"
    fi

    # Sync conn string + state regardless of whether we just created it.
    set_conn "$WTDB"
    state_set_db "$WTDB"

    # Step 3: schema check — does public.users exist?
    # A DB cloned from a POPULATED template already has the schema + seed, so we must
    # NOT re-run the provisioning chain (migrate would fail on already-existing
    # objects, e.g. "type ... already exists"). Only provision when the schema is
    # genuinely absent: an empty DB (mode=fresh) or a pre-existing DB never migrated.
    if ! db_has_users_table "$WTDB"; then
      echo "  DB '$WTDB' has no schema — provisioning (migrate + extras + seed)"
      do_full_provision "$WTDB"
      echo "ensure-ready: $WTDB is ready"
      exit 0
    fi

    # Step 3b: staleness check — the DB has the users table (looks provisioned) but
    # a clone from an OUTDATED template can be missing newer columns/tables/extras
    # objects (trigger/matview/CHECK constraint) that don't require a whole new
    # table. Two independent signals, either one triggers a heal (HOS-68,
    # belt-and-suspenders): a content fingerprint over the schema-defining source
    # (see .db.schemaFingerprintPaths — covers new tables, columns, and extras)
    # and the original sentinel-table existence check (kept as an extra safety net
    # in case the fingerprint has a bug or a misconfigured path). The sentinel
    # check only runs when the fingerprint didn't already flag staleness, to avoid
    # a redundant Postgres round-trip on the common (current) case.
    STALE_REASON=""
    CURRENT_FP="$(wt_schema_fingerprint "$ROOT")"
    if [ -n "$CURRENT_FP" ]; then
      CACHED_FP="$(wt_state_get '.schemaFingerprint')"
      [ "$CURRENT_FP" != "$CACHED_FP" ] && STALE_REASON="fingerprint changed"
    fi
    if [ -z "$STALE_REASON" ] && [ -n "$SENTINEL_TABLES" ]; then
      MISSING="$(db_first_missing_sentinel "$WTDB")"
      [ -n "$MISSING" ] && STALE_REASON="missing sentinel table '$MISSING'"
    fi
    if [ -n "$STALE_REASON" ]; then
      echo "  DB '$WTDB' is schema-stale ($STALE_REASON) — healing to current schema"
      do_schema_sync "$WTDB"
      [ -n "$CURRENT_FP" ] && state_set_schema_fingerprint "$CURRENT_FP"
    else
      echo "  schema check OK — '$WTDB' is current"
    fi

    # Step 4: test users check.
    COUNT="$(pgsh "psql -U $DBUSER -d $WTDB -tAc \"SELECT count(*) FROM users WHERE email LIKE '%@local.test'\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || echo "0")"
    if [ "${COUNT:-0}" -lt 13 ] 2>/dev/null; then
      echo "  test users: $COUNT found, need 13 — seeding"
      CONN="${CONNTMPL//\{dbname\}/$WTDB}"
      ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$CONN" pnpm db:seed:test-users ) \
        || { echo "ERROR: pnpm db:seed:test-users failed"; exit 1; }
      echo "  test users seeded into $WTDB"
    else
      echo "  test users present ($COUNT) — skip"
    fi
    echo "ensure-ready: $WTDB is ready" ;;

  drop)
    DBNAME="$(wt_state_get '.db')"
    [ -z "$DBNAME" ] && { echo "no db recorded in state — nothing to drop"; exit 0; }
    pg dropdb -U "$DBUSER" --if-exists "$DBNAME" 2>&1 && echo "dropped $DBNAME"
    state_set_db "" ;;

  refresh-template)
    # Post-merge: rebuild the shared template from this worktree's final DB.
    DBNAME="$(wt_state_get '.db')"
    [ -z "$DBNAME" ] && { echo "no worktree db to refresh template from"; exit 0; }
    [ -z "$TEMPLATE" ] && { echo "no db.templateDb configured"; exit 0; }
    echo "Refreshing shared template '$TEMPLATE' from '$DBNAME' (post-merge)"
    pg dropdb -U "$DBUSER" --if-exists "$TEMPLATE" 2>&1 || true
    pg createdb -U "$DBUSER" -T "$DBNAME" "$TEMPLATE" 2>&1 \
      || pgsh "createdb -U $DBUSER $TEMPLATE && pg_dump -U $DBUSER $DBNAME | psql -U $DBUSER -d $TEMPLATE -q" \
      || { echo "template refresh failed"; exit 1; }
    echo "template '$TEMPLATE' refreshed" ;;

  ensure-test-users)
    # Ensure the 13 dev test users (<slug>@local.test / Password123!) exist in
    # the worktree DB. Idempotent — counts first, seeds only if count < 13.
    # Requires the worktree DB to already exist (run wt-db.sh ensure-ready first).
    WTDB="$(wt_state_get '.db')"
    [ -z "$WTDB" ] && WTDB="$DBNAME"  # fallback to branch-derived name
    [ -z "$WTDB" ] && { echo "ERROR: no worktree DB in state and cannot derive name"; exit 1; }

    # Guard 1: check the database itself exists — distinguish from missing table.
    if ! db_exists "$WTDB"; then
      echo "ERROR: database '$WTDB' does not exist in Postgres — run 'wt-db.sh ensure-ready' first"
      exit 1
    fi

    # Guard 2: check if the users table exists at all.
    if ! db_has_users_table "$WTDB"; then
      echo "ERROR: database '$WTDB' exists but 'users' table is missing — run migrations first (pnpm db:migrate)"
      exit 1
    fi

    COUNT="$(pgsh "psql -U $DBUSER -d $WTDB -tAc \"SELECT count(*) FROM users WHERE email LIKE '%@local.test'\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || echo "")"
    if [ -z "$COUNT" ]; then
      echo "WARN: could not query users table in $WTDB"
      exit 0
    fi

    if [ "$COUNT" -ge 13 ] 2>/dev/null; then
      echo "test users present ($COUNT) — skip"
      exit 0
    fi

    echo "test users: $COUNT found, need 13 — seeding"
    CONN="${CONNTMPL//\{dbname\}/$WTDB}"
    ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$CONN" pnpm db:seed:test-users ) \
      || { echo "ERROR: pnpm db:seed:test-users failed"; exit 1; }
    echo "test users seeded into $WTDB" ;;

  build-template)
    # One-time helper: build (or rebuild) the shared templateDb from a source DB
    # that already has migrations + seed + test users. Safe to re-run (drop+recreate).
    # Optional arg: source DB name. Defaults to config.db.devDb (the primary dev DB).
    SRCDB="${2:-$DEVDB}"
    do_build_template "$SRCDB" ;;

  sync-dev-and-template)
    # Proactive template refresh (HOS-68): heal db.devDb to the current schema
    # (migrations + apply-extras, same idempotent heal ensure-ready uses) then rebuild
    # db.templateDb from it. Invoked by wt-create.sh right after fetching
    # origin/$BASE, before cutting a new worktree, so the new worktree's cloned
    # DB already starts current instead of relying solely on ensure-ready's
    # per-worktree heal. Caller treats failures here as non-blocking/best-effort.
    [ -z "$DEVDB" ] && { echo "ERROR: db.devDb not configured"; exit 1; }
    do_schema_sync "$DEVDB"
    do_build_template "$DEVDB" ;;

  *) echo "unknown action: $ACTION"; exit 1 ;;
esac
