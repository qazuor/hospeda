#!/usr/bin/env bash
# check-addon-product-domain.sh
#
# HOS-1178 — the fourth time in this epic that a defense reads as installed and
# never executes. The previous three:
#
#   1. the empty hardcoded `Set` in `commerce-entitlement.ts` (HOS-1119);
#   2. the SPEC-239 T-034 comment claiming to exclude commerce, excluding
#      nothing (HOS-1104);
#   3. `EXTRA_GASTRONOMIES_ADDON`'s JSDoc asserting that "product_domain is the
#      real discriminator" while no add-on carried the field at all.
#
# The fourth was HOS-1060 declaring `productDomain` on all eight add-ons while
# `createAddonCheckout` — the only path that takes money — never read it. Anyone
# opening `addons.config.ts` afterwards saw eight add-ons neatly tagged with
# their vertical and took the separation as done.
#
# This guard exists so there is no fifth. It is the ONLY thing in this change
# that keeps failing after everyone who wrote it has moved on.
#
# WHAT IT PROVES
#
#   G-1  `createAddonCheckout` CALLS `subscriptionMatchesDomain`. Not that a
#        comment mentions the domain, not that a field exists — that the paying
#        path actually invokes the repo's single domain comparator. Delete the
#        check and this fails.
#
#   G-2  `AddonResponseSchema` declares `productDomain`. If the field stops
#        travelling on the wire, every consumer is silently pushed back to
#        deriving it, which is the two-sources-of-truth state HOS-1178 closed.
#
#   G-3  Nobody DERIVES an add-on's product domain from `affectsLimitKey`
#        again. That derivation (`apps/web/src/lib/billing/addon-domain.ts`,
#        HOS-689) was the second decider; it was retired in favour of the
#        declared field, and a new copy of it would re-open the disagreement —
#        with the presentation layer and the paying route able to answer
#        differently for the same add-on.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#
#   - It does NOT prove an add-on declares a domain. That is enforced two ways
#     already, both stronger than a grep: `AddonDefinition.productDomain` is a
#     REQUIRED property, so a literal omitting it does not compile, and
#     `packages/billing/test/addons.test.ts` asserts every entry of
#     `ALL_ADDONS` resolves to one and matches its owner-decided value slug by
#     slug.
#   - G-1 is a call-site check, not a semantic one. It cannot tell whether the
#     comparison is used to REFUSE anything; a call whose result is discarded
#     would pass. The behaviour is asserted end to end against the real route
#     in `apps/api/test/e2e/flows/billing/addon-purchase.test.ts`.
#   - G-3 anchors on `affectsLimitKey` reaching `productDomainForLimitKey`.
#     `productDomainForLimitKey` itself stays perfectly legal — it is the
#     canonical answer for a LIMIT key, and the addon recalculator and the usage
#     page rightly call it. Only feeding an add-on's `affectsLimitKey` into it
#     is forbidden.
#   - `.test.ts` / `.spec.ts` files are excluded from G-3: a test may
#     legitimately assert what the retired derivation used to do.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Checking the add-on product-domain gate (HOS-1178) ==="
echo ""

FAILED=0

# --- G-1: the paying path invokes the domain comparator -----------------------
CHECKOUT='apps/api/src/services/addon.checkout.ts'

if [ ! -f "$CHECKOUT" ]; then
    echo "ERROR: $CHECKOUT not found — the guard's subject moved."
    echo "  Point this script at the module that creates the add-on checkout,"
    echo "  or the gate becomes unguarded the moment the file is renamed."
    exit 1
fi

if grep -q 'subscriptionMatchesDomain(' "$CHECKOUT"; then
    echo "  OK - createAddonCheckout calls subscriptionMatchesDomain()."
else
    echo "ERROR: $CHECKOUT no longer calls subscriptionMatchesDomain()."
    echo ""
    echo "  The add-on purchase route is the ONLY path that takes money for an"
    echo "  add-on, and it is shared between accommodation and commerce. Without"
    echo "  this call a gastronomy owner can buy 'extra-experiences-1' again:"
    echo "  targetCategories cannot separate them, because all six commerce"
    echo "  plans declare category 'owner' — the same value the accommodation"
    echo "  plans carry (HOS-1178)."
    echo ""
    echo "  Do NOT hand-write the comparison instead. subscriptionMatchesDomain"
    echo "  reads asymmetric on purpose: 'accommodation' fails OPEN because the"
    echo "  product_domain column post-dates almost every host row, and a"
    echo "  \`sub.productDomain === domain\` here would refuse every legacy host."
    FAILED=1
fi

# --- G-2: the domain travels on the wire --------------------------------------
SCHEMA='packages/schemas/src/api/billing/addon.schema.ts'

if [ ! -f "$SCHEMA" ]; then
    echo "ERROR: $SCHEMA not found — the guard's subject moved."
    exit 1
fi

if grep -q 'productDomain:' "$SCHEMA"; then
    echo "  OK - AddonResponseSchema carries productDomain."
else
    echo "ERROR: $SCHEMA no longer declares productDomain."
    echo ""
    echo "  Dropping the field from the wire does not make consumers ask the"
    echo "  server — it makes them GUESS, which is the derivation HOS-1178"
    echo "  retired (apps/web/src/lib/billing/addon-domain.ts)."
    FAILED=1
fi

# --- G-3: nobody derives the domain from a limit key again --------------------
DERIVATIONS=''

while IFS= read -r -d '' file; do
    # Whole-file scan so the two tokens may sit on different lines, bounded to
    # 200 characters so two unrelated mentions far apart cannot match.
    if grep -Pzo 'productDomainForLimitKey\([^)]{0,200}affectsLimitKey' "$file" >/dev/null 2>&1; then
        DERIVATIONS="${DERIVATIONS}${file}"$'\n'
    fi
done < <(find apps packages -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.astro' \) \
    ! -name '*.test.ts' ! -name '*.test.tsx' ! -name '*.spec.ts' \
    ! -path '*/node_modules/*' ! -path '*/dist/*' -print0)

DERIVATIONS=$(echo "$DERIVATIONS" | sed '/^$/d')

if [ -n "$DERIVATIONS" ]; then
    echo "ERROR: an add-on's product domain is being DERIVED from affectsLimitKey."
    echo ""
    echo "$DERIVATIONS"
    echo ""
    echo "  Read AddonResponse.productDomain / AddonDefinition.productDomain"
    echo "  instead. The derivation was the second decider for one fact and"
    echo "  could disagree with the catalogue (HOS-1178): it has nothing to read"
    echo "  for an add-on whose affectsLimitKey is null, and it cannot tell"
    echo "  apart two add-ons raising the same cap for different verticals."
    echo ""
    echo "  productDomainForLimitKey() is still the right answer for a LIMIT"
    echo "  key — only feeding an add-on's affectsLimitKey into it is forbidden."
    FAILED=1
else
    echo "  OK - no add-on domain is derived from affectsLimitKey."
fi

echo ""

if [ "$FAILED" -ne 0 ]; then
    echo "Add-on product-domain guard FAILED."
    exit 1
fi

echo "All checks passed."
exit 0
