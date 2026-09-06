#!/usr/bin/env bash
# check-local-date-math.sh
#
# Detects calendar arithmetic done in the process's LOCAL timezone on server
# code (HOS-1010).
#
# WHY
#
# Every `timestamp` column in this repo is `timestamptz` (397 of them, without
# exception), so Drizzle always hands back a `Date` that is a UTC instant.
# `setMonth`/`setFullYear` read and write in the process's local timezone, so
# calling one on such a value asks a UTC instant what month it is somewhere
# else. Under TZ=America/Argentina/Buenos_Aires, `2026-11-01T00:00:00.000Z` is
# 31 October at 21:00 — and the courtesy window came out three days long, then
# three days short the following month.
#
# It is invisible where anyone would look: production and CI run Alpine with no
# TZ set, so both are UTC and the defect only appears on a developer machine.
# That is exactly why it needs a static check rather than a test.
#
# SCOPE, AND WHY IT STOPS WHERE IT DOES
#
# Server code only (`packages/*/src`, `apps/api/src`). `apps/web` and
# `apps/admin` are deliberately excluded: a date picker or a `datetime-local`
# input genuinely means local time, and there the local reads are correct and in
# the majority. An earlier, broader guard over rendering was rejected for that
# reason (2026-08-16, PR #2834) — this one is narrower on purpose.
#
# Mutators only. Local *getters* have legitimate uses even on the server:
# `ical-parser.ts` reads with local getters a value that node-ical built at
# local midnight, which is symmetric and correct, and it documents a TZ probe
# proving it. Mutating in local time has no such counterpart here.
#
# `setDate`/`setHours` are NOT checked yet. Day and hour offsets are currently
# equivalent to plain epoch arithmetic because Argentina has had no DST since
# 2009 — correct today, but resting on an undeclared premise. Those call sites
# are converted separately, and this guard is widened to cover them then.
#
# To suppress a legitimate exception, add a comment on the offending line:
#   // check-local-date-math: ignore
# As of this writing there are none, which is the point.

set -euo pipefail

FAIL=0
PASS_COUNT=0

echo "=== Checking for local-timezone calendar arithmetic on server code (HOS-1010) ==="

SCAN_DIRS="packages/service-core/src packages/db/src packages/schemas/src packages/utils/src packages/billing/src packages/seed/src packages/notifications/src apps/api/src"

# ---------------------------------------------------------------------------
# Check 1: local-timezone month/year mutators
# ---------------------------------------------------------------------------
echo ""
echo "1. Scanning for setMonth()/setFullYear() in local time..."

MATCHES=""
for dir in $SCAN_DIRS; do
    if [ -d "$dir" ]; then
        FOUND=$(grep -rnE --include="*.ts" --include="*.tsx" \
            "\.(setMonth|setFullYear)\(" \
            "$dir" \
            --exclude-dir=dist \
            2>/dev/null \
            | grep -v "\.test\." \
            | grep -v "\.spec\." \
            | grep -v "check-local-date-math: ignore" \
            | grep -vE "^[^:]+:[0-9]+: *(\*|//|/\*)" \
            || true)
        if [ -n "$FOUND" ]; then
            MATCHES="${MATCHES}${FOUND}"$'\n'
        fi
    fi
done
MATCHES=$(echo "$MATCHES" | sed '/^$/d')

if [ -n "$MATCHES" ]; then
    echo "ERROR: local-timezone month/year arithmetic found in server code:"
    echo "$MATCHES"
    echo ""
    echo "  These read and write in the process's timezone, so the result depends"
    echo "  on where the process runs. Use addCalendarMonths/addCalendarYears from"
    echo "  @repo/utils, which work in UTC and take the end-of-month rule as an"
    echo "  explicit argument."
    FAIL=1
else
    echo "  OK — no local-timezone month/year arithmetic in server code."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Check 2: the UTC primitive still exists and is still exported
#
# Without this, deleting or renaming addCalendarMonths would leave check 1
# passing over a repo that has no safe alternative left — the guard would go
# green precisely because the fix was removed.
# ---------------------------------------------------------------------------
echo ""
echo "2. Verifying the UTC-safe primitive is still exported..."

PRIMITIVE_FILE="packages/utils/src/utc-date-math.ts"
if [ ! -f "$PRIMITIVE_FILE" ]; then
    echo "ERROR: $PRIMITIVE_FILE is gone — the safe alternative this guard points to no longer exists."
    FAIL=1
elif ! grep -q "export function addCalendarMonths" "$PRIMITIVE_FILE"; then
    echo "ERROR: addCalendarMonths is no longer exported from $PRIMITIVE_FILE."
    FAIL=1
elif ! grep -q "export \* from './utc-date-math'" packages/utils/src/index.ts; then
    echo "ERROR: utc-date-math is no longer re-exported from the @repo/utils barrel."
    FAIL=1
else
    echo "  OK — addCalendarMonths is exported and reachable from @repo/utils."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Check 3: the timezone inside a Drizzle sql template is never a plain string
#
# `MARKET_TIMEZONE` is a plain string, so every `${MARKET_TIMEZONE}` inside a
# Drizzle `sql` template emits a DISTINCT placeholder — $1 in the SELECT, $5 in
# the GROUP BY. Postgres compares GROUP BY expressions by node identity, not by
# bound value, so it rejects the statement at PARSE TIME:
#
#     ERROR: column "entity_views.viewed_at" must appear in the GROUP BY clause
#
# This has now shipped twice. HOS-1169 hit it in getDailySeries and answered it
# with `marketTimezoneSql()` in packages/db/src/utils/drizzle-helpers.ts, whose
# docblock says it was "found the hard way". HOS-1063 hit it again in both
# rollUpMonth writers, and every unit test stayed green through it: those suites
# mock @repo/db wholesale and assert with toContain over the SQL that gets BUILT,
# never the SQL Postgres ACCEPTS. A statement that cannot execute is invisible to
# a test that never executes it, which is why this is a static check and not
# another test.
#
# Two forms are safe and neither is matched here: `marketTimezoneSql()` (one
# shared node, reused), and resolving the bounds in TypeScript so the statement
# carries no zone at all (getLocalMonthWindow / getLocalDayWindow).
# ---------------------------------------------------------------------------
echo ""
echo "3. Scanning for a bare timezone string inside a Drizzle sql template..."

TZ_MATCHES=""
for dir in $SCAN_DIRS; do
    if [ -d "$dir" ]; then
        FOUND=$(grep -rn --include="*.ts" \
            'AT TIME ZONE ${MARKET_TIMEZONE}' \
            "$dir" \
            --exclude-dir=dist \
            2>/dev/null \
            | grep -v "check-local-date-math: ignore" \
            | grep -vE "^[^:]+:[0-9]+: *(\*|//|/\*)" \
            || true)
        if [ -n "$FOUND" ]; then
            TZ_MATCHES="${TZ_MATCHES}${FOUND}"$'\n'
        fi
    fi
done
TZ_MATCHES=$(echo "$TZ_MATCHES" | sed '/^$/d')

if [ -n "$TZ_MATCHES" ]; then
    echo "ERROR: a plain timezone string is interpolated into a sql template:"
    echo "$TZ_MATCHES"
    echo ""
    echo "  Each interpolation emits its own placeholder, so a GROUP BY that"
    echo "  repeats the expression will not match the SELECT and Postgres rejects"
    echo "  the whole statement at parse time — on every execution, silently, into"
    echo "  a cron's error log."
    echo ""
    echo "  Use marketTimezoneSql() from @repo/db when the zone must be inside the"
    echo "  statement, or resolve the bounds in TypeScript (getLocalMonthWindow,"
    echo "  getLocalDayWindow) so the statement needs no zone at all."
    FAIL=1
else
    echo "  OK — no bare timezone string reaches a sql template."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS_COUNT/3 checks passed ==="

if [ "$FAIL" -eq 1 ]; then
    echo "FAILED — Fix the issues above before merging."
    exit 1
fi

echo "All checks passed."
exit 0
