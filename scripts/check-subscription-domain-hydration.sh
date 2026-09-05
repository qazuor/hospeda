#!/usr/bin/env bash
# check-subscription-domain-hydration.sh
#
# HOS-1176 — a file that compares a subscription's `productDomain` against a
# NON-accommodation value must first recover that value, or the comparison is
# a silent no-op.
#
# WHY IT MATTERS
#   `billing.subscriptions.getByCustomerId()` (QZPay's own client) never
#   populates `productDomain` — qzpay-core's mapper builds the returned object
#   field-by-field off its own interface, which predates the column
#   `@qazuor/qzpay-drizzle` added on top of it (see
#   `hydrateSubscriptionProductDomains`'s doc,
#   packages/service-core/src/services/billing/subscription/subscription-product-domain.ts).
#   Every subscription from that call therefore arrives with
#   `productDomain: undefined`. Handed straight to `subscriptionMatchesDomain`,
#   `undefined` reads as "legacy row" and resolves to
#   `domain === 'accommodation'` — true for an accommodation comparison
#   (masking the gap), false for every other domain. A gastronomy/experience
#   comparison against an un-hydrated subscription therefore ALWAYS fails,
#   silently: no thrown error, no log line, just `activeSubscription` coming
#   back `undefined` and the caller taking its "not found" branch.
#
#   This happened for real: HOS-688 (2026-08-20) introduced exactly this
#   comparison in `addon-limit-recalculation.service.ts` without hydrating
#   first. HOS-934 (2026-09-02) swept 9 other call sites onto
#   `hydrateSubscriptionProductDomains()` and missed this one — it stayed
#   broken for 13 days with its test suite green throughout, because that
#   suite's mocks injected `productDomain` by hand instead of reproducing the
#   real (missing) shape.
#
# WHAT IT PROVES
#   A production TypeScript file that calls `subscriptionMatchesDomain(x, d)`
#   with a `d` that is NOT the literal `'accommodation'` /
#   `ProductDomainEnum.ACCOMMODATION` (i.e., a comparison that can be TRUE for
#   a commerce vertical) also contains, somewhere in the same file, either:
#     (a) a call to `hydrateSubscriptionProductDomains(`, which recovers the
#         column before any comparison in the file runs it, or
#     (b) a direct Drizzle read of the column itself — `.from(billingSubscriptions)`
#         — which, typed or bare-`select()`, already carries `productDomain`
#         off the row and never goes through QZPay's mapper at all.
#   `isCommerceSubscription(` is included in the same check even though the
#   symbol does NOT exist: HOS-1081 (`ebfd413e0`) deleted it for having zero
#   callers, and CLAUDE.md no longer points anyone at it. The alternation stays
#   because the function is the obvious shape somebody reaches for the day a
#   union-of-verticals consumer appears, and it would carry the identical
#   hydration risk — cheaper to keep the name covered than to remember to add
#   it back. Match it against a symbol that exists before assuming it works.
#
#   `isAccommodationSubscription(...)` and a literal-accommodation
#   `subscriptionMatchesDomain(x, 'accommodation')` are NEVER flagged: the
#   accommodation domain fails OPEN by design (an unhydrated subscription
#   already reads as accommodation), so hydrating changes nothing there.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is FILE-granularity, not call-site or function-granularity. A file
#     that hydrates in one function and compares un-hydrated in a completely
#     unrelated function still passes. Narrowing to the call site would need a
#     real parser, not grep; the file-level version is what actually caught
#     the addon-limit-recalculation.service.ts gap and is not weaker than the
#     invariant this repo already accepts for its other guards of this shape
#     (see check-commerce-plan-resolution.sh's own header).
#   - It is line-based: a `subscriptionMatchesDomain(` call whose arguments
#     span multiple lines is invisible to it.
#   - Exemption (b) does not confirm the SAME rows reaching the comparison are
#     the ones read from `billingSubscriptions` — only that the file reads the
#     column directly somewhere. A file that reads the column for one purpose
#     and separately calls QZPay's un-hydrated `getByCustomerId()` for the
#     actual comparison would pass this check incorrectly. No such file exists
#     in this codebase today (verified when this guard was written); closing
#     that gap needs call-site-level analysis, not this script.
#   - It says nothing about `apps/admin` or `apps/web` — neither imports
#     `subscriptionMatchesDomain` today.
#
# There is deliberately NO ignore comment / exemption list. The two exemptions
# above are structural (a real hydration call, or a real direct column read)
# and verifiable by grep; a file-path allowlist would let the next call site
# opt out by omission instead of by fixing the gap.

set -euo pipefail

echo "=== Checking subscription domain comparisons are hydrated (HOS-1176) ==="
echo ""

SCAN_DIRS="apps/api/src apps/web/src packages/service-core/src packages/billing/src"

# --- Find every non-comment, non-definition call site -----------------------
CALL_LINES=""
for dir in $SCAN_DIRS; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    FOUND=$(grep -rnE --include="*.ts" --include="*.tsx" \
        '\b(subscriptionMatchesDomain|isCommerceSubscription)\(' \
        "$dir" \
        2>/dev/null \
        | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
        | grep -vE 'function (subscriptionMatchesDomain|isCommerceSubscription)\(' \
        | grep -v '\.test\.' \
        | grep -v '\.spec\.' \
        || true)
    if [ -n "$FOUND" ]; then
        CALL_LINES="${CALL_LINES}${FOUND}"$'\n'
    fi
done
CALL_LINES=$(echo "$CALL_LINES" | sed '/^$/d')

FILES_INSPECTED=$(echo "$CALL_LINES" | cut -d: -f1 | sort -u | sed '/^$/d')
INSPECTED_COUNT=0
if [ -n "$FILES_INSPECTED" ]; then
    INSPECTED_COUNT=$(echo "$FILES_INSPECTED" | wc -l | tr -d ' ')
fi

# --- Keep only comparisons that can be TRUE for a non-accommodation domain --
RISKY_LINES=$(echo "$CALL_LINES" \
    | grep -v "'accommodation'" \
    | grep -v '"accommodation"' \
    | grep -v 'ProductDomainEnum\.ACCOMMODATION' \
    | sed '/^$/d' \
    || true)

if [ -z "$RISKY_LINES" ]; then
    echo "  OK - inspected $INSPECTED_COUNT file(s) with a domain comparison; none compare a"
    echo "  non-accommodation domain, so none needed hydration."
    echo ""
    echo "All checks passed."
    exit 0
fi

# --- For each file with a risky comparison, require one of the two escapes --
UNGUARDED=""
RISKY_FILES=$(echo "$RISKY_LINES" | cut -d: -f1 | sort -u)
while IFS= read -r file; do
    [ -z "$file" ] && continue
    if grep -q 'hydrateSubscriptionProductDomains(' "$file" 2>/dev/null; then
        continue
    fi
    if grep -qE '\.from\(billingSubscriptions\)' "$file" 2>/dev/null; then
        continue
    fi
    FILE_RISKY_LINES=$(echo "$RISKY_LINES" | grep "^${file}:" || true)
    UNGUARDED="${UNGUARDED}${FILE_RISKY_LINES}"$'\n'
done <<<"$RISKY_FILES"
UNGUARDED=$(echo "$UNGUARDED" | sed '/^$/d')

if [ -n "$UNGUARDED" ]; then
    echo "ERROR: a non-accommodation domain comparison is not hydrated in its own file."
    echo ""
    echo "$UNGUARDED"
    echo ""
    echo "  Each line above compares a subscription's productDomain against a value"
    echo "  that is not the literal 'accommodation' — meaning it can be TRUE for a"
    echo "  commerce vertical. billing.subscriptions.getByCustomerId() never"
    echo "  populates productDomain (qzpay-core's mapper drops it), so without"
    echo "  hydration the comparison silently fails CLOSED for every row."
    echo ""
    echo "  This check only proves textual absence in the SAME FILE — not that the"
    echo "  specific rows reaching the comparison were hydrated. Fix by adding, in"
    echo "  this file, right after the billing.subscriptions.getByCustomerId() call"
    echo "  and before any comparison:"
    echo ""
    echo "    const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);"
    echo ""
    echo "  (import from services/billing/subscription/subscription-product-domain.js)."
    echo "  If the rows instead come from a direct Drizzle "'".from(billingSubscriptions)"'" read,"
    echo "  that already carries the real column and needs no hydration call."
    echo ""
    exit 1
fi

echo "  OK - inspected $INSPECTED_COUNT file(s) with a domain comparison; every"
echo "  non-accommodation comparison is paired with hydration (or a direct"
echo "  billingSubscriptions read) in the same file."
echo ""
echo "All checks passed."
exit 0
