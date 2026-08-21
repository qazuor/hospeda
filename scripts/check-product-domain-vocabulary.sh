#!/usr/bin/env bash
# check-product-domain-vocabulary.sh
#
# HOS-685 — the product-domain vocabulary gains `gastronomy` and `experience`,
# and NOTHING in the type system defends the widening. TIGHTENED by HOS-695
# (release C): the transitional `commerce` value this guard used to tolerate
# — as long as a line also named `gastronomy` — is now retired from
# `ProductDomainEnum` entirely, so there is no longer ANY legitimate reason
# for a `productDomain`-named symbol to be compared against a hardcoded
# `'commerce'` literal, enumeration or not.
#
# Verified when the issue was written, and re-verified here: there is no
# `Record<ProductDomainEnum, …>`, no `switch` over the enum without a `default`,
# and no `satisfies` anywhere on it. Adding or removing a member produces ZERO
# type errors. Every failure is a string comparison that silently stops
# matching — a commerce listing goes dark, and the build stays green.
#
# This guard is that missing check.
#
# WHAT IT PROVES
#   A line of production TypeScript that names a `productDomain` symbol never
#   carries a quoted `commerce` literal, full stop — not even alongside an
#   explicit `gastronomy` enumeration. `ProductDomainEnum.COMMERCE` references
#   fail the TypeScript build directly (the member does not exist); this catches
#   the raw-string escape hatch a compiler cannot: `productDomain === 'commerce'`,
#   a `'commerce'` entry in a hand-rolled literal union or `z.enum([...])`, etc.
#
#   The anchor is the `productDomain` symbol, NOT the domain literals. Anchoring
#   on `'accommodation'` was measured and rejected: that literal appears in ~239
#   files as an `entityType`, an i18n key and a query key, none of which have
#   anything to do with billing product domains.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is line-based. A union split across several lines is invisible to it.
#   - `.astro` is out of scope. The one domain-aware page,
#     `mi-cuenta/suscripcion/index.astro`, becomes three-way in HOS-689 (AC-21);
#     widening its type here without its copy would be half a change.
#   - `apps/admin`'s `PRODUCT_DOMAINS` array derives from
#     `Object.values(ProductDomainEnum)` rather than a literal list, so it is
#     out of scope here on purpose — it auto-narrows with the enum and needs no
#     guard of its own.
#   - It says nothing about snake_case `product_domain` in raw SQL or seed
#     files — that is a separate guard, `check-product-domain-raw-sql.sh`
#     (HOS-692 / HOS-695 AC-33), which scans the full living-source tree for
#     the same hardcoded-'commerce' pattern expressed as a raw string instead
#     of a TypeScript symbol.
#   - It says nothing about database rows. Release A changes none.
#
# There is deliberately NO ignore comment. An exception would mean the
# vocabulary really is binary somewhere, which is the thing being forbidden.

set -euo pipefail

echo "=== Checking product-domain vocabulary (HOS-685) ==="
echo ""

SCAN_DIRS="apps/api/src apps/web/src packages/service-core/src packages/schemas/src packages/billing/src"

MATCHES=""

for dir in $SCAN_DIRS; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    FOUND=$(grep -rnE --include="*.ts" --include="*.tsx" \
        '[Pp]roductDomain' \
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
    echo "ERROR: product-domain vocabulary still hardcodes the retired 'commerce' value."
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Each line above names a productDomain symbol against a hardcoded"
    echo "  'commerce' literal. HOS-695 retired the value entirely — there is no"
    echo "  longer a transitional carve-out for enumerating it alongside"
    echo "  gastronomy/experience."
    echo ""
    echo "  Fix by deriving from the vocabulary instead of restating it:"
    echo "    - types/schemas -> ProductDomainEnum / ProductDomainScope"
    echo "    - dispatch      -> subscriptionMatchesDomain(sub, domain) / isCommerceSubscription(sub)"
    exit 1
fi

echo "  OK - no binary accommodation|commerce contract left in production source."
echo ""
echo "All checks passed."
exit 0
