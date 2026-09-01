#!/usr/bin/env bash
# check-trial-not-derived-from-free-trial.sh
#
# HOS-936.
#
# THE PROVEN CASE
#   MercadoPago grants a preapproval's free trial once per
#   `(payer, preapproval_plan)`. `auto_recurring.free_trial` and
#   `first_invoice_offset` therefore describe the PLAN'S TERMS, not "this
#   subscription is on a trial" — and they are byte-identical on a preapproval
#   whose trial will run and one whose trial was already spent.
#
#   Measured 2026-08-31 against the live API with two preapprovals for the same
#   payer on the same plan, created two seconds apart. Both reported
#   `free_trial: {frequency: 30, frequency_type: 'days'}` and
#   `first_invoice_offset: 30`. Only `next_payment_date` differed: +30 days on
#   the first, the creation instant itself on the second — i.e. MercadoPago was
#   charging the second one immediately.
#
#   `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` used to
#   read `auto_recurring.free_trial` to decide the local trial window
#   (`livePreapprovalHasFreeTrial`). On that data it writes a 30-day trial onto
#   a subscription being charged in that same second.
#
# WHAT IT PROVES
#   No production TypeScript source reads `free_trial`, `first_invoice_offset`
#   or `firstInvoiceOffset` off a provider payload. The trial window is derived
#   from `next_payment_date - date_created` and from nothing else
#   (`apps/api/src/services/billing/trial-window-derivation.ts`).
#
# WHAT IT DOES NOT PROVE
#   - It is line-based, and it excludes lines that OPEN with a comment marker
#     (`//`, `*`, `/*`), same convention as the sibling guards in this
#     directory. Prose about `free_trial` — including this file's own
#     rationale, and the module JSDoc that has to name the field to explain why
#     it is not read — stays legal. Code does not.
#   - It says nothing about `freeTrialDays`, which is OURS: the day count
#     resolved at checkout by `resolveCheckoutFreeTrialDays` and sent TO
#     MercadoPago when creating a preapproval. Asking for a trial is fine; the
#     bug is believing the answer.
#   - `free_trial_extension` is also ours — a `promoCode.type` in
#     `packages/billing/src/config/promo-codes.config.ts`, unrelated to the
#     MercadoPago field — so it is matched and skipped explicitly.
#   - It excludes `.test.ts` / `.spec.ts`: a regression proving the field is
#     IGNORED legitimately needs to put it in a fixture, and HOS-936's tests do
#     exactly that.
#
# There is deliberately NO escape hatch. A comment that switches the guard off
# is how a fail-open re-enters, and the whole point of this file is that the
# next person to reach for `free_trial` has to argue with a reviewer instead of
# with a regex.

set -euo pipefail

echo "=== Checking the trial window is not derived from free_trial (HOS-936) ==="
echo ""

SCAN_DIRS="apps/api/src packages/service-core/src packages/billing/src packages/db/src"

MATCHES=""

for dir in $SCAN_DIRS; do
    if [ ! -d "$dir" ]; then
        continue
    fi
    FOUND=$(grep -rnE --include="*.ts" --include="*.tsx" \
        'free_trial|first_invoice_offset|firstInvoiceOffset' \
        "$dir" \
        2>/dev/null \
        | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
        | grep -v 'free_trial_extension' \
        | grep -v '\.test\.' \
        | grep -v '\.spec\.' \
        || true)
    if [ -n "$FOUND" ]; then
        MATCHES="${MATCHES}${FOUND}"$'\n'
    fi
done

MATCHES=$(echo "$MATCHES" | sed '/^$/d')

if [ -n "$MATCHES" ]; then
    echo "ERROR: production source reads a MercadoPago trial field that cannot be trusted."
    echo ""
    echo "$MATCHES"
    echo ""
    echo "  Each line above reads \`free_trial\` / \`first_invoice_offset\` off a"
    echo "  provider payload. Both describe the PLAN'S terms and read identically"
    echo "  on a preapproval MercadoPago is charging right now — measured"
    echo "  2026-08-31 on two preapprovals two seconds apart (HOS-936)."
    echo ""
    echo "  Derive the window from the provider's own dates instead:"
    echo "    import { readTrialWindowFromPreapprovalPayload }"
    echo "      from 'apps/api/src/services/billing/trial-window-derivation.js';"
    echo "    const { outcome, trialEnd } = readTrialWindowFromPreapprovalPayload(preapproval);"
    echo ""
    echo "  Asking MercadoPago FOR a trial is still fine — that is \`freeTrialDays\`,"
    echo "  and this guard does not touch it. What is banned is believing the answer."
    exit 1
fi

echo "  OK - the trial window is derived from next_payment_date only."
echo ""
echo "All checks passed."
exit 0
