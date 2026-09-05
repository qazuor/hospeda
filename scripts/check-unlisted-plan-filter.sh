#!/usr/bin/env bash
# check-unlisted-plan-filter.sh
#
# HOS-1062 F1 / AC-14 — the public plans endpoint must never enumerate a plan
# marked as unlisted.
#
# WHY IT MATTERS
#   `GET /api/v1/public/plans` is `skipAuth: true` and answers with full prices.
#   A negotiated plan (a municipality's agreement, a partner's exclusive price)
#   that reaches it publishes that agreement. Nothing reports the failure: the
#   response is well formed, the pricing page renders, no log line is written,
#   and nobody opens a ticket to say they saw a price they were not meant to.
#   The only defence is a single filter in a single handler, which is exactly
#   the kind of line a refactor removes without anyone noticing.
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
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#   - It is line-based. A filter call split across lines, or a return built via
#     an intermediate alias several statements away, is outside what it can see.
#   - It says nothing about the DATABASE. A plan an operator forgot to mark is a
#     data problem, not a source one.
#   - It covers the PUBLIC endpoint only. `GET /api/v1/protected/plans`
#     (`routes/billing/protected-plans-list.ts`) serves every storage plan to any
#     authenticated user and filters only `metadata.testPlan`; extending the mark
#     there is a scope decision, not something this guard can assume.
#
# TEST INJECTION (used by scripts/__tests__/check-unlisted-plan-filter.test.ts)
#   - HANDLER_FILE_OVERRIDE   — path checked by checks 1-3 instead of the route.
#   - PREDICATE_FILE_OVERRIDE — path checked by check 4 instead of the schema.
#   Check 5 always scans the repository, so an override run cannot make it pass
#   by pointing it at an empty tree.
#
# There is deliberately NO ignore comment. An exception would mean a public
# response really is wanted for an unlisted plan, which is the thing forbidden.

set -euo pipefail

echo "=== Checking unlisted plans cannot reach the public catalogue (HOS-1062 AC-14) ==="
echo ""

HANDLER="${HANDLER_FILE_OVERRIDE:-apps/api/src/routes/billing/public/listPlans.ts}"
PREDICATE="${PREDICATE_FILE_OVERRIDE:-packages/schemas/src/api/billing/billing-plan.schema.ts}"
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

echo "  Handler:   $HANDLER"
echo "  Predicate: $PREDICATE"
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

if [ "$FAILED" -eq 1 ]; then
    exit 1
fi

echo "  OK - the public handler filters unlisted plans on every return path."
echo "  OK - the predicate withholds on doubt."
echo "  OK - the metadata key has one production site."
echo ""
echo "All checks passed."
exit 0
