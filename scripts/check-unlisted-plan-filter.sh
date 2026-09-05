#!/usr/bin/env bash
# check-unlisted-plan-filter.sh
#
# HOS-1062 F1 / AC-14 — no plan-listing endpoint may enumerate a plan marked as
# unlisted. There are TWO such endpoints, and this guard watches both.
#
# WHY IT MATTERS
#   `GET /api/v1/public/plans` is `skipAuth: true` and answers with full prices.
#   `GET /api/v1/protected/plans` answers ANY authenticated user — an ordinary
#   tourist account included — with the same prices and raw `metadata`. A
#   negotiated plan (a municipality's agreement, a partner's exclusive price)
#   that reaches either one publishes that agreement. Nothing reports the
#   failure: the response is well formed, the page renders, no log line is
#   written, and nobody opens a ticket to say they saw a price they were not
#   meant to. The defence is a filter in each handler, which is exactly the kind
#   of line a refactor removes without anyone noticing.
#
#   Watching only one of the two doors would be worse than watching neither: it
#   would report as covered what is not.
#
# WHAT IT PROVES
#   1. The public handler still exists.
#   2. It still calls the shared predicate on the plan list it serves.
#   3. No `return` in that handler answers the RAW service items. This is the
#      check that covers the branch a reader forgets: when the DOMAIN query
#      fails, `accommodation` deliberately serves an unfiltered-BY-DOMAIN list
#      (HOS-685). Serving `result.data.items` there would restore the leak while
#      check 2 stayed green, because the filter would still be present higher up.
#   4. The predicate is still POSITIVE (`=== 'listed'`). Rewritten as
#      `!== 'unlisted'` it would publish any plan whose mark went missing, which
#      is the difference between "withhold on doubt" and "publish on doubt".
#   5. The metadata key literal lives in exactly one production file. A second
#      site is a second spelling waiting to drift from the first.
#   6. The protected handler still exists.
#   7. Its `servablePlans` still applies BOTH marks, and BOTH branches call it —
#      `?active=true` and the paginated default. Two call sites are required
#      because a mark added to one branch and not the other is the exact shape
#      of this bug: `?active=true` is the branch a consumer reaches for first.
#   8. No response in the protected handler hands back a raw qzpay result
#      (`data: active`, `data: result.data`). Same reasoning as check 3.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is line-based. A filter call split across lines, or a return built via
#     an intermediate alias several statements away, is outside what it can see.
#   - It says nothing about the DATABASE. A plan an operator forgot to mark is a
#     data problem, not a source one.
#   - It says nothing about `pagination.total`. That the numbers describe the
#     FILTERED list is asserted by the route's own tests, not here.
#   - It knows about these two endpoints. A third listing endpoint would need a
#     line added here; nothing detects one automatically.
#
# TEST INJECTION (used by scripts/__tests__/check-unlisted-plan-filter.test.ts)
#   - HANDLER_FILE_OVERRIDE   — path checked by checks 1-3 instead of the public route.
#   - PREDICATE_FILE_OVERRIDE — path checked by check 4 instead of the schema.
#   - PROTECTED_FILE_OVERRIDE — path checked by checks 6-8 instead of the protected route.
#   Check 5 always scans the repository, so an override run cannot make it pass
#   by pointing it at an empty tree.
#
# There is deliberately NO ignore comment. An exception would mean a response
# really is wanted for an unlisted plan, which is the thing forbidden.

set -euo pipefail

echo "=== Checking unlisted plans cannot reach any plan listing (HOS-1062 AC-14) ==="
echo ""

HANDLER="${HANDLER_FILE_OVERRIDE:-apps/api/src/routes/billing/public/listPlans.ts}"
PREDICATE="${PREDICATE_FILE_OVERRIDE:-packages/schemas/src/api/billing/billing-plan.schema.ts}"
PROTECTED="${PROTECTED_FILE_OVERRIDE:-apps/api/src/routes/billing/protected-plans-list.ts}"
KEY_DEFINITION_FILE='packages/schemas/src/api/billing/billing-plan.schema.ts'

FAILED=0

# --- 1. The handler still exists --------------------------------------------
if [ ! -f "$HANDLER" ]; then
    echo "ERROR: $HANDLER is missing."
    echo "  The public plans handler is where the unlisted-plan filter lives. If the"
    echo "  route moved, move this guard with it — do not delete it."
    exit 1
fi

if [ ! -f "$PREDICATE" ]; then
    echo "ERROR: $PREDICATE is missing."
    echo "  isPubliclyListedPlan is the single site that decides what the public sees."
    exit 1
fi

if [ ! -f "$PROTECTED" ]; then
    echo "ERROR: $PROTECTED is missing."
    echo "  The protected /plans override is the SECOND door. Without it, qzpay-hono's"
    echo "  prebuilt GET /plans answers every storage plan to any authenticated user."
    exit 1
fi

echo "  Public handler:    $HANDLER"
echo "  Protected handler: $PROTECTED"
echo "  Predicate:         $PREDICATE"
echo ""

# --- 2. The handler filters the list it serves -------------------------------
# Anchored on the exact call. A rename of the predicate trips this check rather
# than sliding past it, which is the safe direction: the author is forced to
# update the guard deliberately.
if ! grep -qE '\.filter\(isPubliclyListedPlan\)' "$HANDLER"; then
    echo "ERROR: the public plans handler no longer filters unlisted plans."
    echo ""
    echo "  Expected a call of the form:"
    echo "      const publiclyListedPlans = result.data.items.filter(isPubliclyListedPlan);"
    echo ""
    echo "  Without it every ACTIVE plan is public, including a negotiated one. That"
    echo "  failure is silent: the endpoint answers 200 with a correct-looking body."
    echo ""
    FAILED=1
fi

# --- 3. Nothing returns the unfiltered service items -------------------------
# Comment lines are dropped: the handler's own docblocks name `result.data.items`
# when explaining what the filter consumes, and a guard that flagged prose is a
# guard somebody turns off. `grep -n` prefixes each line with `NN:`, so the
# comment anchor is applied after that prefix.
RAW_RETURNS=$(grep -nE 'return[^;]*result\.data\.items' "$HANDLER" \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
    || true)

if [ -n "$RAW_RETURNS" ]; then
    echo "ERROR: the public plans handler returns the UNFILTERED service items:"
    echo ""
    echo "$RAW_RETURNS"
    echo ""
    echo "  Every return must answer from the already-filtered array. The domain"
    echo "  filter fails OPEN for accommodation on purpose (HOS-685); the visibility"
    echo "  mark must fail CLOSED in that same branch."
    echo ""
    FAILED=1
fi

# --- 4. The predicate is still a positive test -------------------------------
if ! grep -qE "publicListing === 'listed'" "$PREDICATE"; then
    echo "ERROR: isPubliclyListedPlan is no longer a positive test for 'listed'."
    echo ""
    echo "  Expected: return plan.publicListing === 'listed';"
    echo ""
    echo "  A negative test ( !== 'unlisted' ) publishes any plan whose mark went"
    echo "  missing — a mapper that dropped the field, a payload from an older"
    echo "  service. Withhold on doubt, never publish on doubt."
    echo ""
    FAILED=1
fi

if grep -qE "publicListing !== 'unlisted'" "$PREDICATE"; then
    echo "ERROR: isPubliclyListedPlan tests the mark negatively ( !== 'unlisted' )."
    echo "  See above: that inverts the failure direction."
    echo ""
    FAILED=1
fi

# --- 5. The metadata key has exactly one production site ---------------------
# Everyone else must reach it through PLAN_PUBLIC_LISTING_METADATA_KEY or
# through the resolver, so a rename cannot leave a second spelling behind.
KEY_SITES=$(grep -rlE --include="*.ts" --include="*.tsx" --include="*.astro" \
    "['\"]publicListing['\"]" \
    apps packages 2>/dev/null \
    | grep -v '/node_modules/' \
    | grep -v '/dist/' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -vE "^${KEY_DEFINITION_FILE}$" \
    || true)

if [ -n "$KEY_SITES" ]; then
    echo "ERROR: the 'publicListing' metadata key is spelled outside its definition:"
    echo ""
    echo "$KEY_SITES"
    echo ""
    echo "  Use PLAN_PUBLIC_LISTING_METADATA_KEY, resolvePlanPublicListing() or"
    echo "  isPubliclyListedPlan() from @repo/schemas instead."
    echo ""
    FAILED=1
fi

# --- 6/7. The protected handler filters on BOTH branches ---------------------
# `servablePlans` is the one function both branches call. It must apply both
# marks, and it must be called at least twice — once per branch.
if ! grep -qE 'function servablePlans' "$PROTECTED"; then
    echo "ERROR: the protected plans handler no longer defines servablePlans()."
    echo ""
    echo "  It is the single function both branches filter through. Without it the"
    echo "  ?active=true branch and the paginated one drift apart, which is how a"
    echo "  mark ends up applied to one door and not the other."
    echo ""
    FAILED=1
else
    if ! grep -qE 'isTestPlan\(plan\)' "$PROTECTED" || ! grep -qE 'isPubliclyListedStoragePlan\(plan\)' "$PROTECTED"; then
        echo "ERROR: servablePlans() no longer applies both marks."
        echo ""
        echo "  Expected both, in one predicate:"
        echo "      !isTestPlan(plan) && isPubliclyListedStoragePlan(plan)"
        echo ""
        FAILED=1
    fi
fi

# Each branch is asserted by NAME rather than by counting call sites: a count of
# two is satisfied by one branch calling it twice, which is exactly the state
# this check exists to reject.
if ! grep -qE 'data:[[:space:]]*servablePlans\(' "$PROTECTED"; then
    echo "ERROR: the ?active=true branch no longer filters through servablePlans()."
    echo ""
    echo "  Expected:  return c.json({ success: true, data: servablePlans(active) });"
    echo ""
    echo "  This is the branch a consumer reaches for first — no pagination envelope,"
    echo "  the shape most callers use — so an unlisted plan escaping HERE is the"
    echo "  likelier of the two leaks."
    echo ""
    FAILED=1
fi

if ! grep -qE 'return servablePlans\(' "$PROTECTED"; then
    echo "ERROR: the paginated branch's catalogue loader no longer filters."
    echo ""
    echo "  Expected loadServableCatalog() to answer 'return servablePlans(collected);'"
    echo "  — filtering BEFORE the window is applied, so pagination.total counts what"
    echo "  the response carries instead of announcing plans it withholds."
    echo ""
    FAILED=1
fi

# The presence of ONE filtered return is not enough: a second, unfiltered return
# of the raw accumulator would leave the first in place and green. Measured —
# an early `return collected;` inside the paging loop kept both checks above
# passing while five route tests went red.
RAW_ACCUMULATOR_RETURNS=$(grep -nE 'return[^;]*\bcollected\b' "$PROTECTED" \
    | grep -v 'servablePlans(collected)' \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
    || true)

# The protected adapter must DELEGATE the verdict, never restate it. A local
# `.publicListing === 'listed'` here would be a second comparison free to drift
# from the shared one — and one that cannot even be tested: the resolver is total
# over two values, so `=== 'listed'` and `!== 'unlisted'` are the same expression
# at this call site. Measured: that mutation survived all 15 route tests.
if ! grep -qE 'isPubliclyListedPlan\(resolvePlanPublicListing\(' "$PROTECTED"; then
    echo "ERROR: the protected handler no longer delegates the listing verdict."
    echo ""
    echo "  Expected:  isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }))"
    echo ""
    echo "  Restating the comparison here creates a second decision site that no"
    echo "  mutation can catch, because the resolver only ever answers one of two"
    echo "  values. Compose the two shared functions instead."
    echo ""
    FAILED=1
fi

if [ -n "$RAW_ACCUMULATOR_RETURNS" ]; then
    echo "ERROR: the catalogue loader returns its RAW accumulator:"
    echo ""
    echo "$RAW_ACCUMULATOR_RETURNS"
    echo ""
    echo "  Every exit must answer servablePlans(collected). qzpay's pages carry"
    echo "  every storage plan, negotiated ones included."
    echo ""
    FAILED=1
fi

# --- 8. Nothing in the protected handler answers a raw qzpay result ----------
PROTECTED_RAW_RETURNS=$(grep -nE 'data:[[:space:]]*(active\b|[A-Za-z_$][A-Za-z0-9_$]*\.data\b)' "$PROTECTED" \
    | grep -vE '^[0-9]+:[[:space:]]*(//|\*|/\*)' \
    || true)

if [ -n "$PROTECTED_RAW_RETURNS" ]; then
    echo "ERROR: the protected plans handler answers with a RAW qzpay result:"
    echo ""
    echo "$PROTECTED_RAW_RETURNS"
    echo ""
    echo "  Every payload must be built from servablePlans(...). qzpay returns every"
    echo "  storage plan, unfiltered by active or by anything else."
    echo ""
    FAILED=1
fi

if [ "$FAILED" -eq 1 ]; then
    exit 1
fi

echo "  OK - the public handler filters unlisted plans on every return path."
echo "  OK - the predicate withholds on doubt."
echo "  OK - the metadata key has one production site."
echo "  OK - the protected handler filters both branches through servablePlans()."
echo ""
echo "All checks passed."
exit 0
