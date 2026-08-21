#!/usr/bin/env bash
# check-product-domain-raw-sql.sh
#
# HOS-692 AC-33 (raw-SQL / seed-file coverage), WIDENED by HOS-695 AC-33
# (full retirement of the `commerce` value across every living source tree).
#
# The proven case: `packages/seed/src/example/gastronomies.seed.ts:309` ran
# `sql\`UPDATE billing_subscriptions SET product_domain = 'commerce' ...\`` —
# a raw template-literal SQL string, invisible to both the compiler and any
# symbol-based search (`grep -w productDomain` never matches `product_domain`
# inside a template literal, and `check-product-domain-vocabulary.sh` itself
# does not scan `packages/seed/src` at all). It was fixed as part of HOS-692,
# but a re-introduction (a seed fixture, a hand-rolled migration, any other
# living file) would be just as invisible without a guard that greps the raw
# SQL text itself rather than a TypeScript symbol.
#
# HOS-695 (release C) retired `commerce` from `ProductDomainEnum` entirely —
# there is no longer ANY legitimate reason for living source to hardcode the
# string `'commerce'` next to `product_domain`, not even alongside an explicit
# `gastronomy`/`experience` enumeration (that carve-out existed only for the
# HOS-685→HOS-692 transitional window, which is now over) and not by deriving
# it from `ProductDomainEnum` (the member itself no longer exists, so a
# `ProductDomainEnum.COMMERCE` reference fails the TypeScript build before this
# guard would ever see it). So this version drops both exemptions and widens
# the scanned tree to the full living-source surface, matching the sibling
# HOS-685 guard's intent but for raw/snake_case occurrences it cannot see.
#
# WHAT IT PROVES
#   No production TypeScript source contains the literal snake_case string
#   `product_domain` together with a hardcoded `'commerce'` (or `"commerce"`)
#   value on the same line, anywhere in the living source tree (HOS-695 AC-33
#   — "ningún fuente de producción, incluido SQL crudo y archivos de seed").
#
# WHAT IT DOES NOT PROVE
#   - It is line-based, same limitation as the sibling HOS-685 guard.
#   - It does not run against already-applied migration files under
#     `packages/seed/src/data-migrations/` or `packages/db/src/migrations/`:
#     those are historical record of what a migration DID at the time it ran,
#     not living source that dispatches on the vocabulary today. A migration
#     that legitimately wrote 'commerce' (the pre-rewrite value) or read it is
#     not a bug — HOS-692's own migrations do both by design, and HOS-695's
#     retirement does not rewrite history.
#   - It says nothing about `.sql` files under `packages/db/src/migrations/`
#     (generated, not hand-authored) or `extras/` (hand-authored but a
#     historical, already-applied record, same reasoning as above).
#   - It excludes `.test.ts` / `.spec.ts` files: a test asserting that the
#     retired value is now REJECTED legitimately needs the literal string.

set -euo pipefail

echo "=== Checking for raw-SQL / seed-file product_domain='commerce' writes (HOS-695 AC-33) ==="
echo ""

# Living source only — explicitly excludes packages/seed/src/data-migrations
# and packages/db/src/migrations (historical record, see header). Covers every
# app and package with production TypeScript source, not just the ones that
# happened to need it for HOS-692's seed-only case.
SCAN_DIRS="packages/seed/src/example packages/seed/src/required packages/seed/src/test-users packages/seed/src/utils packages/seed/src/data packages/seed/src/pointOfInterestCatalog packages/seed/src/schemas apps/api/src apps/web/src apps/admin/src packages/service-core/src packages/schemas/src packages/billing/src packages/db/src/models packages/db/src/schemas packages/db/src/utils packages/db/src/billing packages/db/src/base packages/db/src/constants"

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
        || true)
    if [ -n "$FOUND" ]; then
        MATCHES="${MATCHES}${FOUND}"$'\n'
    fi
done

MATCHES=$(echo "$MATCHES" | sed '/^$/d')

if [ -n "$MATCHES" ]; then
    echo "ERROR: raw-SQL/seed-file product_domain still hardcodes the retired 'commerce' value."
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Each line above writes or compares raw \`product_domain\` text against"
    echo "  'commerce' — retired entirely by HOS-695. There is no longer a valid"
    echo "  reason to hardcode it, not even alongside an explicit gastronomy/"
    echo "  experience enumeration (that transitional carve-out ended with HOS-695)."
    echo ""
    echo "  Fix by deriving from entityType/vertical instead of hardcoding:"
    echo "    entityType === 'gastronomy' ? ProductDomainEnum.GASTRONOMY : ProductDomainEnum.EXPERIENCE"
    echo "  (see apps/api/src/services/commerce-subscription-attach.service.ts for the"
    echo "  established idiom). If this is a historical migration record, move it under"
    echo "  packages/seed/src/data-migrations/ or packages/db/src/migrations/, which this"
    echo "  guard does not scan."
    exit 1
fi

echo "  OK - no raw-SQL/seed-file 'commerce' hardcoding found outside historical migrations."
echo ""
echo "All checks passed."
exit 0
