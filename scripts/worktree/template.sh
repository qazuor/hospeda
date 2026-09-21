#!/usr/bin/env bash
# template.sh — inspect and build the disposable database template.
#
# Commands:
#   status [db]                 Read manifest and health metadata.
#   stamp <db> <fingerprint>    Record the validated source fingerprint in <db>.
#   build-candidate <name>      Build an isolated template candidate from empty.
#   promote <candidate> [name]  Promote a validated candidate with --confirm.
#
# This script never replaces the active template. Promotion is deliberately a
# separate, reviewed operation because it can invalidate existing clones.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/wt-config.sh"
ROOT="$(wt_root)"; CFG="$(wt_config_path)"
[ -f "$CFG" ] || { echo "ERROR: no project config"; exit 2; }

ACTION="${1:?usage: template.sh status [db]|stamp <db> <fingerprint>|build-candidate <name>}"
DOCKER="$(jq -r '.db.docker // false' "$CFG")"
CONTAINER="$(jq -r '.db.container // empty' "$CFG")"
DBUSER="$(jq -r '.db.user' "$CFG")"
CONNTMPL="$(jq -r '.db.connStringTemplate' "$CFG")"
TEMPLATE="$(jq -r '.db.templateDb // empty' "$CFG")"

pg() { if [ "$DOCKER" = "true" ]; then docker exec -i "$CONTAINER" "$@"; else "$@"; fi; }
pgsh() { if [ "$DOCKER" = "true" ]; then docker exec -i "$CONTAINER" bash -c "$1"; else bash -c "$1"; fi; }
conn_for() { printf '%s' "${CONNTMPL//\{dbname\}/$1}"; }

ensure_manifest_table() {
  local db="$1"
  pgsh "psql -U $DBUSER -d $db -v ON_ERROR_STOP=1 -c \"CREATE SCHEMA IF NOT EXISTS hospeda_tooling; CREATE TABLE IF NOT EXISTS hospeda_tooling.template_manifest (id boolean PRIMARY KEY DEFAULT true CHECK (id), template_name text NOT NULL, source_commit text NOT NULL, fingerprint text NOT NULL, migration_count integer NOT NULL, built_at timestamptz NOT NULL DEFAULT now(), tool_version text NOT NULL);\"" >/dev/null
}

status() {
  local db="${1:-$TEMPLATE}"
  [ -n "$db" ] || { echo "ERROR: template DB is not configured"; exit 1; }
  local tables journal manifest
  tables="$(pgsh "psql -U $DBUSER -d $db -tAc \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
  journal="$(pgsh "psql -U $DBUSER -d $db -tAc \"SELECT CASE WHEN to_regclass('drizzle.__drizzle_migrations') IS NULL THEN 'missing' ELSE count(*)::text END FROM drizzle.__drizzle_migrations\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || true)"
  manifest="$(pgsh "psql -U $DBUSER -d $db -tAc \"SELECT json_build_object('template',template_name,'sourceCommit',source_commit,'fingerprint',fingerprint,'migrationCount',migration_count,'builtAt',built_at,'toolVersion',tool_version)::text FROM hospeda_tooling.template_manifest WHERE id=true\" 2>/dev/null" 2>/dev/null | sed '/^$/d' | head -1 || true)"
  printf '{"database":"%s","hasUsers":%s,"migrationJournal":"%s","manifest":%s}\n' \
    "$db" "$([ "${tables:-0}" = 1 ] && echo true || echo false)" "${journal:-missing}" "${manifest:-null}"
}

stamp() {
  local db="$1" fp="$2" commit="${3:-unknown}" tool="hospeda-template-v1"
  ensure_manifest_table "$db" || { echo "ERROR: cannot create manifest table"; exit 1; }
  local count
  count="$(pgsh "psql -U $DBUSER -d $db -tAc \"SELECT count(*) FROM drizzle.__drizzle_migrations\" 2>/dev/null" 2>/dev/null | tr -d '[:space:]' || echo 0)"
  pgsh "psql -U $DBUSER -d $db -v ON_ERROR_STOP=1 -c \"INSERT INTO hospeda_tooling.template_manifest (id,template_name,source_commit,fingerprint,migration_count,tool_version) VALUES (true,'$db','$commit','$fp',${count:-0},'$tool') ON CONFLICT (id) DO UPDATE SET template_name=EXCLUDED.template_name,source_commit=EXCLUDED.source_commit,fingerprint=EXCLUDED.fingerprint,migration_count=EXCLUDED.migration_count,built_at=now(),tool_version=EXCLUDED.tool_version;\"" >/dev/null || { echo "ERROR: cannot write template manifest"; exit 1; }
  echo "template manifest written: $db"
}

build_candidate() {
  local db="$1" fp commit url
  fp="$(wt_template_fingerprint "$ROOT")"
  commit="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
  [ -n "$fp" ] || { echo "ERROR: cannot calculate template fingerprint"; exit 1; }
  echo "Building isolated template candidate: $db"
  pg dropdb -U "$DBUSER" --if-exists "$db" >/dev/null 2>&1 || true
  pg createdb -U "$DBUSER" "$db" || { echo "ERROR: createdb failed"; exit 1; }
  url="$(conn_for "$db")"
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$url" pnpm db:migrate ) || { echo "ERROR: db:migrate failed; candidate is incomplete"; exit 1; }
  ( cd "$ROOT" && HOSPEDA_DATABASE_URL="$url" pnpm db:apply-extras ) || { echo "ERROR: db:apply-extras failed; candidate is incomplete"; exit 1; }
  # The root db:seed alias includes --reset, which also triggers Cloudinary
  # cleanup. A template candidate is already empty, so use the seed CLI
  # directly without reset; building a local template must never mutate an
  # external asset service.
  # Remove Cloudinary credentials for the isolated build. Without them the
  # seed keeps source URLs and never uploads images or touches the remote
  # asset service.
  ( cd "$ROOT" && HOSPEDA_CLOUDINARY_CLOUD_NAME='' HOSPEDA_CLOUDINARY_API_KEY='' HOSPEDA_CLOUDINARY_API_SECRET='' HOSPEDA_DATABASE_URL="$url" pnpm --filter @repo/seed seed --required --example --poi-catalog ) || { echo "ERROR: seed failed; candidate is incomplete"; exit 1; }
  stamp "$db" "$fp" "$commit"
  status "$db"
  echo "Candidate is isolated; promotion is a separate operation."
}

promote() {
  local candidate="$1" active="${2:-$TEMPLATE}" confirm="${3:-}"
  [ "$confirm" = "--confirm" ] || { echo "ERROR: promotion requires --confirm"; exit 2; }
  [[ "$candidate" =~ ^[a-zA-Z0-9_]+$ && "$active" =~ ^[a-zA-Z0-9_]+$ ]] || { echo "ERROR: invalid database name"; exit 2; }
  local candidate_status journal users backup now
  candidate_status="$(status "$candidate")"
  journal="$(printf '%s' "$candidate_status" | jq -r '.migrationJournal')"
  users="$(printf '%s' "$candidate_status" | jq -r '.hasUsers')"
  [ "$users" = true ] && [ "$journal" != missing ] && [ "${journal:-0}" -gt 0 ] 2>/dev/null \
    || { echo "ERROR: candidate is not a validated migrated database"; printf '%s\n' "$candidate_status"; exit 1; }
  now="$(date -u +%Y%m%dT%H%M%SZ)"; backup="${active}_backup_${now}"
  echo "Promoting $candidate → $active (previous active kept as $backup)"
  # Refuse active connections rather than terminating application sessions.
  if pgsh "psql -U $DBUSER -d postgres -tAc \"SELECT count(*) FROM pg_stat_activity WHERE datname='$active' AND pid <> pg_backend_pid()\"" 2>/dev/null | grep -q '[1-9]'; then
    echo "ERROR: active template has connections; stop template consumers first"
    exit 1
  fi
  if pgsh "psql -U $DBUSER -d postgres -v ON_ERROR_STOP=1 -c \"ALTER DATABASE $active RENAME TO $backup; ALTER DATABASE $candidate RENAME TO $active;\""; then
    pgsh "psql -U $DBUSER -d $active -v ON_ERROR_STOP=1 -c \"UPDATE hospeda_tooling.template_manifest SET template_name='$active', built_at=now() WHERE id=true;\"" >/dev/null \
      || { echo "ERROR: template renamed but manifest metadata could not be synchronized"; exit 1; }
    echo "template promoted; rollback target: $backup"
  else
    echo "ERROR: promotion failed; no template rename completed reliably"
    exit 1
  fi
}

case "$ACTION" in
  status) status "${2:-$TEMPLATE}" ;;
  stamp) [ "$#" -ge 3 ] || { echo "usage: template.sh stamp <db> <fingerprint> [commit]"; exit 2; }; stamp "$2" "$3" "${4:-unknown}" ;;
  build-candidate) [ "$#" -ge 2 ] || { echo "usage: template.sh build-candidate <name>"; exit 2; }; build_candidate "$2" ;;
  promote) [ "$#" -ge 2 ] || { echo "usage: template.sh promote <candidate> [active] --confirm"; exit 2; }; promote "$2" "${3:-$TEMPLATE}" "${4:-}" ;;
  *) echo "unknown action: $ACTION"; exit 2 ;;
esac
