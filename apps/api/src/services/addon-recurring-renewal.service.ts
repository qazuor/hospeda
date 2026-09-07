/**
 * What a MercadoPago charge against a recurring add-on's own preapproval does
 * (HOS-847 PR 5).
 *
 * The sibling of `subscription-payment-handler.ts` for add-ons, and the reason
 * `subscription-logic.ts`'s `GAP-043-53` comment is now wrong: it claimed
 * *"MercadoPago handles add-on recurring billing externally"*, when in truth
 * nobody had ever asked MercadoPago for an add-on preapproval, so there was
 * nothing to handle. PR 4 asks for one. This is what answers.
 *
 * ## Two independent defences against a redelivery
 *
 * MercadoPago redelivers. A second copy of one `subscription_authorized_payment`
 * must not book the money twice and must not buy the customer a second month:
 *
 *  1. **The ledger dedupes by MercadoPago payment id** — the same
 *     `provider_payment_ids->>'mercadopago'` lookup the one-time add-on path
 *     and every subscription flow already use, reused verbatim through
 *     `addon-payment-ledger.ts`. Only a call that actually INSERTED a row is
 *     allowed to touch the period.
 *  2. **The period only advances for a charge at or after the window it
 *     already paid for** (`computeNextAddonPeriod`). This one is wider than the
 *     first: it also absorbs MercadoPago's own retry of a failed charge, which
 *     arrives with a DIFFERENT payment id and so sails straight past the ledger
 *     dedupe.
 *
 * Either alone would hold for an exact redelivery. Both together are what makes
 * "how many periods did this customer buy" answerable from the charge history
 * rather than from webhook delivery luck.
 *
 * ## A settled charge can also ACTIVATE
 *
 * If `preapproval.updated` never arrives — and HOS-159 is the production
 * incident where MercadoPago webhooks silently stopped arriving for a whole
 * period — the charge event is the only evidence the customer paid. So a
 * succeeded charge against a still-`'pending'` purchase activates it first.
 * That mirrors why `subscription-payment-handler.ts` converts a card-first
 * trial here rather than waiting for a cron.
 *
 * @module services/addon-recurring-renewal.service
 */

import type { QZPayBilling, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import { apiLogger } from '../utils/logger.js';
import type { MPAuthorizedPaymentDetails } from '../utils/mp-authorized-payment.js';
import { ADDON_RECURRING_PAYMENT_FLOW, recordAddonPayment } from './addon-payment-ledger.js';
import { activateRecurringAddonPurchase } from './addon-recurring-activation.service.js';
import {
    computeNextAddonPeriod,
    findRecurringAddonPurchaseByPreapprovalId,
    normalizeAddonBillingInterval,
    type RecurringAddonPurchaseRow,
    resolveAddonPeriodAnchorDay
} from './addon-recurring-period.js';

/** Fallback currency, matching the plan-side handler. */
const FALLBACK_CURRENCY = 'ARS';

/**
 * The only purchase status whose billing period a charge may move.
 *
 * `findRecurringAddonPurchaseByPreapprovalId` is deliberately UNFILTERED by
 * status — routing a `'canceled'` purchase's charge to the plan handler is the
 * worst available outcome (HOS-751) — so every write downstream of it has to
 * re-check the status for itself. Without this, a charge against a purchase
 * that `supersedePendingPurchase` marked `'canceled'` (a buyer who reopened
 * checkout after the 3-hour window, whose first preapproval then charged late)
 * books the money AND writes a fresh period onto a dead row, which reads as a
 * perfectly healthy subscription to PR 7's reconciler — the one thing that
 * would otherwise have caught it.
 */
const ADVANCEABLE_PURCHASE_STATUS = 'active' as const;

/** Input for {@link settleRecurringAddonCharge}. */
export interface SettleRecurringAddonChargeInput {
    readonly billing: QZPayBilling;
    /** The purchase the preapproval id routed to. */
    readonly purchase: RecurringAddonPurchaseRow;
    /** The authorized payment, already fetched from MercadoPago REST. */
    readonly details: MPAuthorizedPaymentDetails;
    /** QZPay-mapped disposition of the charge. */
    readonly status: QZPayPaymentStatus;
    /**
     * When the charge settled, as WE observe it.
     *
     * Injected by the caller (the webhook passes `new Date()`) and never read
     * from the MercadoPago payload. `next_payment_date` and `debit_date`
     * describe the plan's terms, and HOS-1012 removed the last place this repo
     * believed them: in production those fields promised fourteen free days and
     * a charge landed one hundred and eighteen seconds later.
     */
    readonly settledAt: Date;
    /** For log correlation. */
    readonly triggerSource: string;
}

/** What {@link settleRecurringAddonCharge} did. */
export interface SettleRecurringAddonChargeOutcome {
    /** Whether this call moved the purchase from `'pending'` to `'active'`. */
    readonly activated: boolean;
    /** Whether a NEW `billing_payments` row was written. */
    readonly ledgerInserted: boolean;
    /** Whether the billing period moved forward. */
    readonly periodAdvanced: boolean;
}

/**
 * Advance a purchase's billing period after a confirmed charge.
 *
 * Only ever called with a charge that inserted a fresh ledger row, and only
 * when {@link computeNextAddonPeriod} says the charge falls outside the window
 * already paid for. Non-fatal: the money is booked either way, and PR 7's
 * reconciler is the backstop for a period that failed to move.
 *
 * @param params.purchase - The purchase, re-read after any activation.
 * @param params.settledAt - When the charge settled.
 * @returns Whether the period was moved.
 */
async function advancePeriodForConfirmedCharge(params: {
    readonly purchase: RecurringAddonPurchaseRow;
    readonly settledAt: Date;
    readonly triggerSource: string;
}): Promise<boolean> {
    const { purchase, settledAt, triggerSource } = params;

    const next = computeNextAddonPeriod({
        currentPeriodEnd: purchase.currentPeriodEnd,
        settledAt,
        billingInterval: normalizeAddonBillingInterval(purchase.billingInterval),
        // The buyer's ORIGINAL day-of-month, so a February clamp does not become
        // the permanent billing day.
        anchorDay: resolveAddonPeriodAnchorDay(purchase.purchasedAt)
    });

    if (next === null) {
        apiLogger.debug(
            {
                purchaseId: purchase.id,
                currentPeriodEnd: purchase.currentPeriodEnd?.toISOString() ?? null,
                settledAt: settledAt.toISOString(),
                triggerSource
            },
            'HOS-847: add-on charge settled inside the period it already paid for — period left untouched'
        );
        return false;
    }

    try {
        const { getDb, and, eq, isNull } = await import('@repo/db');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        await getDb()
            .update(billingAddonPurchases)
            .set({
                currentPeriodStart: next.currentPeriodStart,
                currentPeriodEnd: next.currentPeriodEnd,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(billingAddonPurchases.id, purchase.id),
                    // Belt to the caller's braces: the status was checked before
                    // this function was called, but the predicate lives in the
                    // WHERE too so a row cancelled between the read and this
                    // write cannot receive a period either.
                    eq(billingAddonPurchases.status, ADVANCEABLE_PURCHASE_STATUS),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        apiLogger.info(
            {
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                previousPeriodEnd: purchase.currentPeriodEnd?.toISOString() ?? null,
                currentPeriodStart: next.currentPeriodStart.toISOString(),
                currentPeriodEnd: next.currentPeriodEnd.toISOString(),
                triggerSource
            },
            'HOS-847: recurring add-on renewed — billing period advanced from a confirmed MercadoPago charge'
        );
        return true;
    } catch (error) {
        apiLogger.error(
            {
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                error: error instanceof Error ? error.message : String(error),
                triggerSource
            },
            'HOS-847: charge booked but the add-on billing period could not be advanced — the purchase now under-states what it has paid for',
            { capture: true }
        );
        return false;
    }
}

/**
 * Settle one MercadoPago charge taken against a recurring add-on's preapproval.
 *
 * Sequence — and the ORDER is the whole point of the first step:
 *  1. **The charge is booked in `billing_payments` FIRST**, with
 *     `metadata.flow = 'addon-recurring'` and its real disposition. A rejected
 *     charge is recorded too, exactly as the plan-side handler records one,
 *     because the ledger is a record of what the provider did, not of what we
 *     wanted. It runs before the activation because the activation CAN throw
 *     (see {@link activateRecurringAddonPurchase}), and every caller above this
 *     one consumes the event: an activation failure ahead of the ledger write
 *     left MercadoPago's money with no `billing_payments` row, no orphan-queue
 *     row (the queue lives INSIDE `recordAddonPayment`, which never ran) and no
 *     redelivery — the exact state HOS-714/HOS-1001 built the orphan queue to
 *     make impossible.
 *  2. A SUCCEEDED charge against a still-`'pending'` purchase activates it (the
 *     lost-`preapproval.updated` path), inside a guard. The row is then re-read,
 *     because the activation just wrote the very `current_period_end` step 3
 *     reasons about.
 *  3. Only a SUCCEEDED charge that produced a fresh terminal ledger row — an
 *     INSERT, or an existing non-terminal row advanced to its final status —
 *     may move the period, and only on an `'active'` purchase.
 *
 * **Never inserts a second purchase row.** A renewal is the same purchase, one
 * period later; `idx_addon_purchases_active_unique` would reject a second
 * active row anyway, and silently, since this runs inside a webhook.
 *
 * Does not throw: every step is either non-throwing by construction
 * (`recordAddonPayment`, `advancePeriodForConfirmedCharge`) or guarded here.
 * The caller must ack the webhook.
 *
 * @param input - See {@link SettleRecurringAddonChargeInput}.
 * @returns What happened, for the caller's log line.
 */
export async function settleRecurringAddonCharge(
    input: SettleRecurringAddonChargeInput
): Promise<SettleRecurringAddonChargeOutcome> {
    const { billing, details, status, settledAt, triggerSource } = input;
    let purchase = input.purchase;

    if (!details.paymentId) {
        // Guarded upstream too; here so this function is safe on its own terms.
        return { activated: false, ledgerInserted: false, periodAdvanced: false };
    }

    const currency = details.currencyId || FALLBACK_CURRENCY;
    const amountInCents = Math.round(details.transactionAmount * 100);

    const ledger = await recordAddonPayment({
        billing,
        customerId: purchase.customerId,
        // The customer's PLAN subscription, which is what
        // `billing_addon_purchases.subscription_id` holds and what the refund
        // and reconciliation paths expect on a `billing_payments` row.
        //
        // `undefined` when the purchase has none — NEVER the purchase id.
        // `billing_payments.subscription_id` carries a foreign key to
        // `billing_subscriptions.id`, and a `billing_addon_purchases` id is not
        // in that table: the insert would fail with SQLSTATE 23503 on EVERY
        // charge, be swallowed into the orphan queue, and report
        // `inserted: false` — so the period would never advance and the caller
        // would never see the error. The column is nullable and
        // `applyRefundLifecycle` already guards for a payment with no
        // subscription.
        subscriptionId: purchase.subscriptionId ?? undefined,
        purchaseId: purchase.id,
        addonSlug: purchase.addonSlug,
        providerPaymentId: details.paymentId,
        amountInCents,
        currency,
        flow: ADDON_RECURRING_PAYMENT_FLOW,
        status
    });

    let activated = false;
    if (status === 'succeeded' && purchase.status === 'pending') {
        try {
            const activation = await activateRecurringAddonPurchase({
                billing,
                purchase,
                activatedAt: settledAt,
                providerPaymentId: details.paymentId,
                triggerSource
            });
            activated = activation.activated;
        } catch (activationError) {
            // The money is already on the ledger (step 1), so this is a granted
            // benefit missing — recoverable by the next charge event or by
            // PR 7's reconciler — rather than a payment that vanished.
            apiLogger.error(
                {
                    purchaseId: purchase.id,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    mpPaymentId: details.paymentId,
                    triggerSource,
                    error:
                        activationError instanceof Error
                            ? activationError.message
                            : String(activationError)
                },
                'HOS-847: a recurring add-on charge was booked but its activation threw — the customer paid and holds no entitlement until this is reconciled',
                { capture: true }
            );
        }

        if (activated) {
            // Re-read: the activation wrote `current_period_start/end`, and the
            // in-memory row still carries the pre-activation nulls. Advancing
            // off a stale null would hand this charge a second period.
            const refreshed = await findRecurringAddonPurchaseByPreapprovalId(
                details.preapprovalId
            );
            if (refreshed) {
                purchase = refreshed;
            }
        }
    }

    // A fresh ledger row, or an existing one that just reached its terminal
    // disposition. The second half is what keeps an `in_process` → `approved`
    // pair — ONE MercadoPago payment id, two deliveries — from consuming the
    // insert on the first and then being refused the period on the second.
    const ledgerIsFreshlyTerminal = ledger.inserted || ledger.statusAdvanced;

    let periodAdvanced = false;
    if (status === 'succeeded' && ledgerIsFreshlyTerminal) {
        if (purchase.status === ADVANCEABLE_PURCHASE_STATUS) {
            periodAdvanced = await advancePeriodForConfirmedCharge({
                purchase,
                settledAt,
                triggerSource
            });
        } else {
            // MercadoPago charged a preapproval whose purchase is no longer
            // live. The money is recorded (it exists, and a refund needs the
            // ledger row); nothing is granted and no period is written, because
            // a fresh period on a dead row is indistinguishable from a healthy
            // subscription to every sweep that reads these rows.
            apiLogger.error(
                {
                    purchaseId: purchase.id,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    purchaseStatus: purchase.status,
                    mpSubscriptionId: purchase.mpSubscriptionId,
                    mpPaymentId: details.paymentId,
                    amountInCents,
                    currency,
                    triggerSource
                },
                'HOS-847: MercadoPago charged a recurring add-on preapproval whose purchase is not active — money recorded, nothing granted, period NOT advanced; the preapproval must be cancelled and the charge refunded',
                { capture: true }
            );
        }
    } else if (status !== 'succeeded') {
        // NOT handed to dunning on purpose. HOS-847 plan OQ-3: an add-on is not
        // the customer's subscription, and seven days of "your subscription is
        // overdue" mail plus a cancellation that revokes their WHOLE add-on
        // portfolio, over one add-on's charge, is the R4 failure mode. PR 7's
        // reconciler is what will act on a preapproval MercadoPago gives up on.
        apiLogger.warn(
            {
                purchaseId: purchase.id,
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: purchase.mpSubscriptionId,
                mpPaymentId: details.paymentId,
                status,
                triggerSource
            },
            'HOS-847: a recurring add-on charge did not succeed — recorded, period NOT advanced, and deliberately kept out of subscription dunning'
        );
    }

    return { activated, ledgerInserted: ledger.inserted, periodAdvanced };
}
