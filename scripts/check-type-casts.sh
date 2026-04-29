#!/usr/bin/env bash
# check-type-casts.sh
#
# SPEC-039 — guard that every `as unknown as X` double-cast in production
# source carries a justification comment. Two accepted markers:
#
#   - // DRIZZLE-LIMITATION: <reason>   for casts inside packages/db/src/models/**
#                                       (Drizzle ORM type-inference gaps)
#   - // TYPE-WORKAROUND:   <reason>   for casts elsewhere (route-factory generics,
#                                       branded-type compatibility, JSONB shape, etc.)
#
# Either marker may appear on the SAME line as the cast (end-of-line comment) or
# on any of the 5 lines immediately above (multi-line cast expressions can have
# the comment a few lines above the `as unknown as` token).
#
# CI fails if any cast lacks a marker. To resolve a failure:
#   1. Replace the cast with a Zod parse, narrowing, or transform fn (preferred).
#   2. If genuinely necessary, add the appropriate marker comment with a
#      reviewer-friendly justification. PR reviewers MUST verify each new marker.
#
# Test files are excluded from the guard.

set -eu

SCAN_DIRS=(
    "packages/billing/src"
    "packages/service-core/src"
    "packages/notifications/src"
    "packages/utils/src"
    "packages/db/src/models"
    "apps/api/src"
    "apps/admin/src"
    "apps/web/src"
)

undocumented_count=0
undocumented_list=""
total=0

for dir in "${SCAN_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue

    while IFS= read -r match; do
        # Parse "file:lineno:content"
        file=$(echo "$match" | cut -d: -f1)
        lineno=$(echo "$match" | cut -d: -f2)
        line=$(echo "$match" | cut -d: -f3-)

        total=$((total + 1))

        # Same-line check
        if [[ "$line" == *"DRIZZLE-LIMITATION:"* ]] || [[ "$line" == *"TYPE-WORKAROUND:"* ]]; then
            continue
        fi

        # Look back up to 5 lines for the marker
        start=$((lineno - 5))
        [[ $start -lt 1 ]] && start=1
        context=$(sed -n "${start},${lineno}p" "$file")

        if echo "$context" | grep -qE "DRIZZLE-LIMITATION:|TYPE-WORKAROUND:"; then
            continue
        fi

        undocumented_count=$((undocumented_count + 1))
        undocumented_list="${undocumented_list}${file}:${lineno}: ${line}"$'\n'
    done < <(grep -rn "as unknown as" --include="*.ts" --include="*.tsx" "$dir" 2>/dev/null \
        | awk '!/\.test\./ && !/\.spec\./ && !/\/test\// && !/\/__tests__\//')
done

echo "=== SPEC-039 type-cast documentation guard ==="
echo "  scanned:      $total casts in production source"
echo "  undocumented: $undocumented_count"

if [[ "$undocumented_count" -gt 0 ]]; then
    echo ""
    echo "FAIL: $undocumented_count cast(s) lack a justification comment."
    echo ""
    echo "Required markers:"
    echo "  - // DRIZZLE-LIMITATION: <reason>   inside packages/db/src/models/**"
    echo "  - // TYPE-WORKAROUND:   <reason>   everywhere else"
    echo ""
    echo "Place the marker on the cast's line (end-of-line) or on one of the 5"
    echo "lines above it. Each marker MUST include a 1-sentence reason."
    echo ""
    echo "Undocumented sites:"
    echo "$undocumented_list"
    exit 1
fi

echo ""
echo "OK — all casts documented."
exit 0
