#!/usr/bin/env bash
# check-unsafe-ilike.sh
#
# Detects raw ilike() usage that bypasses safeIlike().
#
# Rules:
# 1. Only drizzle-helpers.ts may import 'ilike' from 'drizzle-orm'.
# 2. No production source file may call ilike() directly (must use safeIlike()).
#
# To suppress a legitimate exception, add a comment:
#   // check-unsafe-ilike: ignore
# on the import or call line.

set -euo pipefail

FAIL=0
PASS_COUNT=0

echo "=== Checking for unsafe ilike() usage ==="

# ---------------------------------------------------------------------------
# Check 1: ilike imported from drizzle-orm outside drizzle-helpers.ts
# ---------------------------------------------------------------------------
echo ""
echo "1. Scanning for raw ilike import from drizzle-orm..."

IMPORT_MATCHES=$(grep -rn --include="*.ts" --include="*.tsx" \
    "from ['\"]drizzle-orm['\"]" \
    packages/ apps/ \
    --exclude-dir=dist \
    --exclude-dir=examples \
    2>/dev/null \
    | grep "\bilike\b" \
    | grep -v "drizzle-helpers.ts" \
    | grep -v "check-unsafe-ilike: ignore" \
    | grep -v "\.test\." \
    | grep -v "\.spec\." \
    || true)

if [ -n "$IMPORT_MATCHES" ]; then
    echo "ERROR: Raw ilike imported from drizzle-orm outside drizzle-helpers.ts:"
    echo "$IMPORT_MATCHES"
    echo ""
    echo "  Use safeIlike() from @repo/db instead of raw ilike() from drizzle-orm."
    FAIL=1
else
    echo "  OK — no raw ilike imports found."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Check 2: ilike() function calls outside drizzle-helpers.ts (production code)
# ---------------------------------------------------------------------------
echo ""
echo "2. Scanning for raw ilike() calls in production source..."

CALL_DIRS="packages/db/src packages/service-core/src apps/api/src apps/admin/src apps/web/src"
CALL_MATCHES=""

for dir in $CALL_DIRS; do
    if [ -d "$dir" ]; then
        FOUND=$(grep -rn --include="*.ts" --include="*.tsx" \
            "\bilike(" \
            "$dir" \
            2>/dev/null \
            | grep -v "drizzle-helpers.ts" \
            | grep -v "check-unsafe-ilike: ignore" \
            || true)
        if [ -n "$FOUND" ]; then
            CALL_MATCHES="${CALL_MATCHES}${FOUND}"$'\n'
        fi
    fi
done

# Trim trailing newline
CALL_MATCHES=$(echo "$CALL_MATCHES" | sed '/^$/d')

if [ -n "$CALL_MATCHES" ]; then
    echo "ERROR: Raw ilike() calls found in production source outside drizzle-helpers.ts:"
    echo "$CALL_MATCHES"
    echo ""
    echo "  Use safeIlike() from @repo/db instead."
    FAIL=1
else
    echo "  OK — no raw ilike() calls found."
    PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: $PASS_COUNT/2 checks passed ==="

if [ "$FAIL" -eq 1 ]; then
    echo "FAILED — Fix the issues above before merging."
    exit 1
fi

echo "All checks passed."
exit 0
