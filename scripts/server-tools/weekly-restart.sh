#!/usr/bin/env bash
#
# weekly-restart.sh
#
# Weekly maintenance script that does two things in sequence:
#
#   1. Restarts the api / web / admin containers to clear accumulated
#      memory leaks and stale connection pools.
#   2. Prunes Docker's dangling images, stopped containers, unused
#      networks, and build cache to free disk and the RAM that the
#      build-cache layer index reserves.
#
# Designed to run unattended from the operator's crontab on Sundays at
# 04:00 ART (07:00 UTC) when traffic is at its weekly low.
#
# Safety net: refuses to restart if the daily backup did not run in the
# last 28 hours. The combination of "fresh backup + low traffic" means
# even a worst-case botched restart can be recovered with at most one
# day of data loss.
#
# Better Auth sessions survive the restart because they are persisted
# to the Postgres `sessions` table — users do NOT get logged out.
#
# The Docker prune step uses `docker system prune -f` (no `-a`, no
# `--volumes`): it only removes dangling images, stopped containers,
# unused networks, and build cache. It does NOT touch running
# containers, tagged images in use, named volumes (databases), or
# anything currently referenced by a running stack. Safe to run
# unattended.
#
# Logs to /var/log/hospeda-weekly-restart.log. Optional heartbeat ping
# via WEEKLY_RESTART_HEARTBEAT_URL so an external monitor can alert if
# the cron stops firing.
#
# Exit codes:
#   0 - success (all three apps restarted; prune is best-effort)
#   1 - configuration error (hops binary missing, etc.)
#   2 - backup safety check failed (no recent backup) — restart aborted
#   3 - one or more app restarts failed (logged, partial state). Prune
#       still runs because cleanup helps recover from disk-induced
#       failures.
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
# Resolve a writable log file. The conventional `/var/log/...` path needs
# `sudo touch + chown` once before a non-root operator can write to it,
# which is awkward to enforce inside a cron entry. Fall back to the
# operator's home so the script Just Works whether `/var/log` was
# pre-provisioned or not. Operator can override either path via env.
PRIMARY_LOG="${WEEKLY_RESTART_LOG:-/var/log/hospeda-weekly-restart.log}"
FALLBACK_LOG="${WEEKLY_RESTART_FALLBACK_LOG:-$HOME/hospeda-weekly-restart.log}"
if touch "$PRIMARY_LOG" 2>/dev/null; then
    LOG_FILE="$PRIMARY_LOG"
elif touch "$FALLBACK_LOG" 2>/dev/null; then
    LOG_FILE="$FALLBACK_LOG"
    echo "[weekly-restart] WARNING: $PRIMARY_LOG not writable, falling back to $FALLBACK_LOG."
    echo "[weekly-restart] Hint: sudo touch $PRIMARY_LOG && sudo chown $(id -un) $PRIMARY_LOG"
else
    echo "[weekly-restart] FATAL: cannot write to either $PRIMARY_LOG or $FALLBACK_LOG. Aborting."
    exit 1
fi

BACKUP_LOG="${HOSPEDA_BACKUP_LOG:-/var/log/hospeda-backup.log}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-28}"
HOPS_BIN="${HOPS_BIN:-/home/qazuor/.local/bin/hops}"
SETTLE_SECONDS="${SETTLE_SECONDS:-30}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-15}"

# Smoke URLs per app. Override via env if subdomains change.
# The API health endpoint is mounted at /health (no /api/v1/ prefix) —
# see apps/api/src/routes/index.ts and the canonical scripts/smoke-test.sh.
API_HEALTH_URL="${API_HEALTH_URL:-https://api.hospeda.com.ar/health}"
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
# Docker prune (free build cache + dangling images)
# -----------------------------------------------------------------------------
# Best-effort: failures here are logged but do not change the exit code.
# A failed prune is annoying but not dangerous; a failed restart is the
# real signal we want to surface.
#
# Runs without `sudo` because cron jobs cannot type a password. The
# operator running this script must be a member of the `docker` group
# (the same access hops uses for app-restart). If the prune step
# permission-denies, fix it once with `sudo usermod -aG docker
# <operator>` and re-login.
log "Pruning Docker dangling images / stopped containers / build cache..."
if prune_output=$(docker system prune -f 2>&1); then
    # The prune output ends with a "Total reclaimed space: X" line. Pull it
    # out so the log is informative without dumping the full prune verbiage.
    reclaimed=$(echo "$prune_output" | grep -i "Total reclaimed space" | tail -1)
    log "Docker prune OK. ${reclaimed:-(no space reclaimed this run)}"
else
    log "WARNING: docker system prune failed. Output:"
    echo "$prune_output" | tee -a "$LOG_FILE"
fi

# -----------------------------------------------------------------------------
# Summary + heartbeat
# -----------------------------------------------------------------------------
if [[ "$failures" -eq 0 ]]; then
    log "Weekly maintenance completed successfully (3/3 apps restarted and smoked, prune ran)"
    if [[ -n "${WEEKLY_RESTART_HEARTBEAT_URL:-}" ]]; then
        if curl -fsS --max-time 10 -o /dev/null "$WEEKLY_RESTART_HEARTBEAT_URL"; then
            log "Heartbeat ping OK"
        else
            log "WARNING: heartbeat ping failed (restart itself was successful)"
        fi
    fi
    exit 0
else
    log "Weekly maintenance finished with $failures restart failure(s). Check the log above."
    exit 3
fi
