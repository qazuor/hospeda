#!/usr/bin/env bash
# check-addon-webhook-routing.sh
#
# HOS-847 PR 5 — every code path that acts on a MercadoPago preapproval event
# must decide "add-on or plan?" BEFORE it resolves a local subscription.
#
# WHY THIS IS A GUARD AND NOT A TEST
#
# PR 4 gives every recurring add-on its own MercadoPago preapproval AND its own
# `billing_subscriptions` row (`product_domain = 'addon'`). Both plan-side
# lookups — `processSubscriptionUpdated` and
# `findLocalSubscriptionByPreapprovalId` — resolve by `mp_subscription_id` with
# no domain filter, so an add-on's row satisfies them perfectly and nothing
# fails. The event then runs a customer's whole subscription lifecycle against
# an add-on: a ledger row attributed to their plan, a plan-price divergence
# check, a promo-cycle decrement, a card-first trial conversion.
#
# The defect is therefore not "one handler computes the wrong thing" — it is
# "one of the N places that process this event forgot to route". That is
# invisible to any test of a single site, and it is exactly what happened:
# `webhook-retry.job.ts` carries a SECOND implementation of the
# authorized-payment handler and PR 5's first pass left it unrouted, because the
# coverage argument was made by enumerating the callers of one SYMBOL rather
# than the places that handle the EVENT.
#
# So this enumerates by event.
#
# WHAT IT PROVES
#
#   E-1  Every file that PROCESSES an authorized payment — anything that awaits
#        `fetchAuthorizedPaymentDetails` or `findLocalSubscriptionByPreapprovalId`
#        — also calls `routeAddonAuthorizedPayment`. A third implementation
#        added anywhere fails here on its first commit.
#
#   E-2  In each of those files the routing call comes BEFORE the first
#        local-subscription lookup. Routing after the lookup routes nothing:
#        by then the plan path has already claimed the event.
#
#   E-3  `subscription-logic.ts` — the single entry point all three
#        preapproval-event callers (live webhook, dead-letter retry, polling
#        cron) funnel through — still calls `routeAddonPreapprovalEvent`.
#
# WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
#
#   - It is a call-site check, not a semantic one. A routing call whose result
#     is discarded would pass E-1. The behaviour is asserted against the real
#     handlers in `apps/api/test/webhooks/addon-recurring-webhook-routing.test.ts`
#     and `addon-recurring-preapproval-routing.test.ts`, each with a CONTROL
#     that runs the full plan path when no add-on row claims the preapproval.
#   - E-2 compares the byte offsets of the first occurrence of each token. It
#     cannot see a routing call sitting in a branch the lookup does not go
#     through.
#   - Detection is anchored on `await <symbol>(`, which is how every real call
#     site in this codebase is written. That is deliberate: it excludes the
#     modules that DECLARE or re-export these symbols, which act on no event
#     and must not be enrolled as processors.
#   - `.test.ts` / `.spec.ts` files are excluded throughout: a test may
#     legitimately drive either half on its own.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Checking the add-on webhook routing interception (HOS-847) ==="
echo ""

FAILED=0

ROUTING_MODULE='apps/api/src/routes/webhooks/mercadopago/addon-recurring-handler.ts'

if [ ! -f "$ROUTING_MODULE" ]; then
    echo "ERROR: $ROUTING_MODULE not found — the interception this guard is about is gone."
    echo "  Every preapproval event would now be handled as a plan subscription."
    exit 1
fi

# Anchored on the exported names this guard greps for elsewhere: a rename that
# left the rest of the script matching a dead token would otherwise turn the
# whole guard green precisely because its subject disappeared.
for fn in routeAddonAuthorizedPayment routeAddonPreapprovalEvent; do
    if ! grep -q "export async function $fn" "$ROUTING_MODULE"; then
        echo "ERROR: $ROUTING_MODULE no longer exports $fn."
        FAILED=1
    fi
done

# --- E-1 / E-2 ----------------------------------------------------------------
echo "1. Enumerating the files that process a subscription_authorized_payment..."

PROCESSORS=''

while IFS= read -r -d '' file; do
    if grep -qE 'await (fetchAuthorizedPaymentDetails|findLocalSubscriptionByPreapprovalId)\(' "$file"; then
        PROCESSORS="${PROCESSORS}${file}"$'\n'
    fi
done < <(find apps/api/src -type f -name '*.ts' \
    ! -name '*.test.ts' ! -name '*.spec.ts' \
    ! -path '*/node_modules/*' ! -path '*/dist/*' -print0)

PROCESSORS=$(echo "$PROCESSORS" | sed '/^$/d')

if [ -z "$PROCESSORS" ]; then
    echo "ERROR: no authorized-payment processor found at all."
    echo ""
    echo "  Either the handler moved out of apps/api/src, or the tokens this"
    echo "  guard enumerates by were renamed. Either way it now guards nothing —"
    echo "  point it at the new shape rather than deleting it."
    exit 1
fi

while IFS= read -r file; do
    if ! grep -q 'routeAddonAuthorizedPayment(' "$file"; then
        echo "ERROR: $file processes a subscription_authorized_payment without routing add-ons."
        echo ""
        echo "  It must call routeAddonAuthorizedPayment() BEFORE it resolves a"
        echo "  local subscription. Both plan-side lookups match on"
        echo "  mp_subscription_id with no product-domain filter, so a recurring"
        echo "  add-on's own billing_subscriptions row resolves as if it were the"
        echo "  customer's plan — and the add-on's charge is then booked as a plan"
        echo "  renewal, against a purchase row that stays pending forever while"
        echo "  its payment id is burnt against the ledger's dedupe."
        FAILED=1
        continue
    fi

    ROUTE_AT=$(grep -bo 'routeAddonAuthorizedPayment(' "$file" | head -1 | cut -d: -f1)
    LOOKUP_AT=$(grep -bo 'await findLocalSubscriptionByPreapprovalId(' "$file" \
        | head -1 | cut -d: -f1 || true)

    if [ -n "${LOOKUP_AT:-}" ] && [ "$ROUTE_AT" -gt "$LOOKUP_AT" ]; then
        echo "ERROR: $file routes add-ons AFTER it resolves a local subscription."
        echo ""
        echo "  Routing after the lookup routes nothing — by then the plan path"
        echo "  has already claimed the event."
        FAILED=1
        continue
    fi

    echo "  OK - $file routes add-ons before the local-subscription lookup."
done <<< "$PROCESSORS"

# --- E-3 ----------------------------------------------------------------------
echo ""
echo "2. Verifying the preapproval-event entry point still intercepts..."

SUBSCRIPTION_LOGIC='apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts'

if [ ! -f "$SUBSCRIPTION_LOGIC" ]; then
    echo "ERROR: $SUBSCRIPTION_LOGIC not found — the guard's subject moved."
    FAILED=1
elif grep -q 'routeAddonPreapprovalEvent(' "$SUBSCRIPTION_LOGIC"; then
    echo "  OK - processSubscriptionUpdated calls routeAddonPreapprovalEvent()."
else
    echo "ERROR: $SUBSCRIPTION_LOGIC no longer calls routeAddonPreapprovalEvent()."
    echo ""
    echo "  processSubscriptionUpdated is the single entry point for all three"
    echo "  preapproval-event callers (live webhook, dead-letter retry, polling"
    echo "  cron). Without the interception at its step 1, an add-on preapproval"
    echo "  runs a customer's whole subscription lifecycle: status transitions,"
    echo "  cancellation of every add-on they own, featured sync, and a"
    echo "  \"your subscription is active\" email."
    FAILED=1
fi

echo ""

if [ "$FAILED" -ne 0 ]; then
    echo "Add-on webhook routing guard FAILED."
    exit 1
fi

echo "All checks passed."
exit 0
