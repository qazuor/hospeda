#!/usr/bin/env bash
#
# weekly-restart.sh
#
# Restarts the api / web / admin containers on a weekly cadence to clear
# accumulated memory leaks and stale connection pools. Designed to run
# unattended from the operator's crontab on Sundays at 04:00 ART
# (07:00 UTC) when traffic is at its weekly low.
#
# Safety net: refuses to restart if the daily backup did not run in the
# last 28 hours. The combination of "fresh backup + low traffic" means
# even a worst-case botched restart can be recovered with at most one
# day of data loss.
#
# Better Auth sessions survive the restart because they are persisted
# to the Postgres `sessions` table — users do NOT get logged out.
#
# Logs to /var/log/hospeda-weekly-restart.log. Optional heartbeat ping
# via WEEKLY_RESTART_HEARTBEAT_URL so an external monitor can alert if
# the cron stops firing.
#
# Exit codes:
#   0 - success (all three apps restarted)
#   1 - configuration error (hops binary missing, etc.)
#   2 - backup safety check failed (no recent backup) — restart aborted
#   3 - one or more app restarts failed (logged, partial state)
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
LOG_FILE="${WEEKLY_RESTART_LOG:-/var/log/hospeda-weekly-restart.log}"
BACKUP_LOG="${HOSPEDA_BACKUP_LOG:-/var/log/hospeda-backup.log}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-28}"
HOPS_BIN="${HOPS_BIN:-/home/qazuor/.local/bin/hops}"
SETTLE_SECONDS="${SETTLE_SECONDS:-30}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-15}"

# Smoke URLs per app. Override via env if subdomains change.
API_HEALTH_URL="${API_HEALTH_URL:-https://api.hospeda.com.ar/api/v1/health/}"
WEB_HOME_URL="${WEB_HOME_URL:-https://hospeda.com.ar/}"
ADMIN_LOGIN_URL="${ADMIN_LOGIN_URL:-https://admin.hospeda.com.ar/auth/signin}"

log() {
    local message="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
    if [[ -w "$(dirname "$LOG_FILE")" ]] || touch "$LOG_FILE" 2>/dev/null; then
        echo "$message" | tee -a "$LOG_FILE"
    else
        echo "$message"
    fi
}

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
log "Starting weekly restart sequence (host=$(hostname))"

if [[ ! -x "$HOPS_BIN" ]]; then
    log "ERROR: hops binary not found or not executable at $HOPS_BIN"
    log "Hint: install via scripts/server-tools/install.sh, or override HOPS_BIN env."
    exit 1
fi

# -----------------------------------------------------------------------------
# Backup safety check
# -----------------------------------------------------------------------------
# We trust the daily backup cron at 03:00 ART. If its log file's last
# write is older than MAX_BACKUP_AGE_HOURS (default 28h), refuse to
# restart. Reasoning: a restart that destabilises an app while the
# operator has no recent backup is much harder to recover from than a
# delayed restart.
if [[ ! -f "$BACKUP_LOG" ]]; then
    log "ERROR: backup log $BACKUP_LOG does not exist."
    log "Either the daily backup is not configured, or the log path drifted. Aborting restart."
    exit 2
fi

backup_mtime=$(stat -c %Y "$BACKUP_LOG")
now=$(date +%s)
backup_age_hours=$(( (now - backup_mtime) / 3600 ))

if [[ "$backup_age_hours" -gt "$MAX_BACKUP_AGE_HOURS" ]]; then
    log "ERROR: backup log was last written ${backup_age_hours}h ago (max ${MAX_BACKUP_AGE_HOURS}h)."
    log "Daily backup may have stopped running. Investigate before allowing the restart."
    log "Aborting restart for safety."
    exit 2
fi

log "Backup safety check OK (last backup activity ${backup_age_hours}h ago)"

# -----------------------------------------------------------------------------
# Restart sequence
# -----------------------------------------------------------------------------
# Sequential, not parallel: web depends on api for SSR data, so a brief
# overlap where both are restarting at once amplifies user-visible impact.

failures=0

restart_one() {
    local kind="$1"
    local smoke_url="$2"

    log "Restarting $kind..."
    if ! "$HOPS_BIN" app-restart "$kind" --yes >> "$LOG_FILE" 2>&1; then
        log "WARNING: hops app-restart $kind exited non-zero. Continuing with the rest."
        failures=$((failures + 1))
        return
    fi

    log "Waiting ${SETTLE_SECONDS}s for $kind to finish booting..."
    sleep "$SETTLE_SECONDS"

    log "Smoking $kind at $smoke_url"
    if curl -fsS --max-time "$SMOKE_TIMEOUT" "$smoke_url" -o /dev/null; then
        log "$kind smoke OK (HTTP 2xx within ${SMOKE_TIMEOUT}s)"
    else
        log "WARNING: $kind smoke failed after restart. Check Sentry + hops logs."
        failures=$((failures + 1))
    fi
}

restart_one api "$API_HEALTH_URL"
restart_one web "$WEB_HOME_URL"
restart_one admin "$ADMIN_LOGIN_URL"

# -----------------------------------------------------------------------------
# Summary + heartbeat
# -----------------------------------------------------------------------------
if [[ "$failures" -eq 0 ]]; then
    log "Weekly restart completed successfully (3/3 apps restarted and smoked)"
    if [[ -n "${WEEKLY_RESTART_HEARTBEAT_URL:-}" ]]; then
        if curl -fsS --max-time 10 -o /dev/null "$WEEKLY_RESTART_HEARTBEAT_URL"; then
            log "Heartbeat ping OK"
        else
            log "WARNING: heartbeat ping failed (restart itself was successful)"
        fi
    fi
    exit 0
else
    log "Weekly restart finished with $failures failure(s). Check the log above."
    exit 3
fi
