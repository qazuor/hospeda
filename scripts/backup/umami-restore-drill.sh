#!/usr/bin/env bash
# Restore drill for Umami backups (HOS-2119 T-010).
# Downloads the latest object of each prefix, decrypts it, restores it into a
# THROWAWAY postgres:16-alpine container (never the live ones), and compares
# per-table row counts against the live database. Removes everything after.
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
WORK=$(mktemp -d /var/tmp/umami-drill.XXXX)
SCRATCH=umami-restore-drill
cleanup() { docker rm -f "$SCRATCH" >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT

docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill postgres:16-alpine >/dev/null
for i in $(seq 1 30); do docker exec "$SCRATCH" pg_isready -U postgres -q && break; sleep 1; done

COUNTS_SQL="select relname, n_live_tup from pg_stat_user_tables order by relname"
TABLES_SQL="select count(*) from information_schema.tables where table_schema='public'"
fail=0
for e in prod staging; do
  ( source "/etc/hospeda-backup-umami-$e.env"
    export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
    EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    KEY=$(aws s3 ls "s3://$R2_BUCKET/" --endpoint-url "$EP" | sort | tail -1 | awk '{print $4}')
    echo "== $e: restoring $R2_BUCKET/$KEY =="
    aws s3 cp "s3://$R2_BUCKET/$KEY" "$WORK/$e.gpg" --endpoint-url "$EP" --no-progress >/dev/null || exit 1
    gpg --batch --quiet --passphrase "$BACKUP_PASSPHRASE" -d "$WORK/$e.gpg" > "$WORK/$e.dump" || exit 1
    docker exec "$SCRATCH" psql -U postgres -qc "create database r_$e" || exit 1
    docker exec -i "$SCRATCH" pg_restore -U postgres -d "r_$e" --no-owner --no-privileges < "$WORK/$e.dump" || exit 1
    docker exec "$SCRATCH" psql -U postgres -d "r_$e" -qc "analyze" >/dev/null
    live_t=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d umami -tAc "$TABLES_SQL")
    rest_t=$(docker exec "$SCRATCH" psql -U postgres -d "r_$e" -tAc "$TABLES_SQL")
    echo "tables: live=$live_t restored=$rest_t"
    for t in website "user" team session website_event; do
      l=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d umami -tAc "select count(*) from \"$t\"")
      r=$(docker exec "$SCRATCH" psql -U postgres -d "r_$e" -tAc "select count(*) from \"$t\"")
      echo "  $t: live=$l restored=$r"
    done
    [[ "$live_t" == "$rest_t" && "$live_t" -gt 0 ]] || exit 1
  ) || { echo "DRILL $e FAILED"; fail=1; }
done
[[ $fail -eq 0 ]] && echo "DRILL OK" || echo "DRILL FAILED"
