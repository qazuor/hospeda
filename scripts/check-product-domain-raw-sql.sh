#!/usr/bin/env bash
# check-product-domain-raw-sql.sh
#
# HOS-692 AC-33 — closes the gap `check-product-domain-vocabulary.sh`
# explicitly leaves open: "It says nothing about snake_case `product_domain`
# in raw SQL or seed files."
#
# The proven case: `packages/seed/src/example/gastronomies.seed.ts:309` ran
# `sql\`UPDATE billing_subscriptions SET product_domain = 'commerce' ...\`` —
# a raw template-literal SQL string, invisible to both the compiler and any
# symbol-based search (`grep -w productDomain` never matches `product_domain`
# inside a template literal, and `check-product-domain-vocabulary.sh` itself
# does not scan `packages/seed/src` at all). It is fixed as part of HOS-692,
# but a re-introduction (this file, a future seed fixture, a hand-rolled
# migration) would be just as invisible without a guard that greps the raw
# SQL text itself rather than a TypeScript symbol.
#
# WHAT IT PROVES
#   No production TypeScript source contains the literal snake_case string
#   `product_domain` together with a hardcoded `'commerce'` (or `"commerce"`)
#   value on the same line, unless the SAME line also names `gastronomy` or
#   `experience` (an explicit multi-value enumeration is fine) or derives the
#   value from `ProductDomainEnum` (also fine).
#
# WHAT IT DOES NOT PROVE
#   - It is line-based, same limitation as the sibling HOS-685 guard.
#   - It does not run against already-applied migration files under
#     `packages/seed/src/data-migrations/` or `packages/db/src/migrations/`:
#     those are historical record of what a migration DID at the time it ran,
#     not living source that dispatches on the vocabulary today. A migration
#     that legitimately writes 'commerce' (the pre-rewrite value) or reads it
#     is not a bug — HOS-692's own forward/undo migrations do both by design.
#   - It says nothing about `.sql` files under `packages/db/src/migrations/`
#     (generated, not hand-authored) or `extras/` (hand-authored but a
#     historical, already-applied record, same reasoning as above).

set -euo pipefail

echo "=== Checking for raw-SQL / seed-file product_domain='commerce' writes (HOS-692 AC-33) ==="
echo ""

# Living source only — explicitly excludes packages/seed/src/data-migrations
# and packages/db/src/migrations (historical record, see header) and every
# already-scanned dir from the sibling HOS-685 guard is included here too,
# since that guard is TS-symbol-based and misses raw strings even where it
# already scans.
SCAN_DIRS="packages/seed/src/example packages/seed/src/required packages/seed/src/test-users packages/seed/src/utils apps/api/src apps/web/src packages/service-core/src packages/schemas/src packages/billing/src packages/db/src/models packages/db/src/schemas packages/db/src/utils"

MATCHES=""

for dir in $SCAN_DIRS; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    FOUND=$(grep -rnE --include="*.ts" --include="*.tsx" \
        'product_domain' \
        "$dir" \
        2>/dev/null \
        | grep -E "['\"]commerce['\"]" \
        | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
        | grep -v '\.test\.' \
        | grep -v '\.spec\.' \
        | grep -v 'gastronomy' \
        | grep -v 'experience' \
        | grep -v 'ProductDomainEnum' \
        || true)
    if [ -n "$FOUND" ]; then
        MATCHES="${MATCHES}${FOUND}"$'\n'
    fi
done

MATCHES=$(echo "$MATCHES" | sed '/^$/d')

if [ -n "$MATCHES" ]; then
    echo "ERROR: raw-SQL/seed-file product_domain still hardcodes the binary 'commerce' value."
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Each line above writes or compares raw \`product_domain\` text against"
    echo "  'commerce' without deriving from the entity's own vertical."
    echo ""
    echo "  Fix by deriving from entityType/vertical instead of hardcoding:"
    echo "    entityType === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE"
    echo "  (see apps/api/src/services/commerce-subscription-attach.service.ts for the"
    echo "  established idiom, and packages/seed/src/example/gastronomies.seed.ts for"
    echo "  the raw-SQL case)."
    exit 1
fi

echo "  OK - no raw-SQL/seed-file 'commerce' hardcoding found outside historical migrations."
echo ""
echo "All checks passed."
exit 0
