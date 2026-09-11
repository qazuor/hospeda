/**
 * The payment receipt for a RECURRING subscription charge (HOS-1238).
 *
 * ## Why this module exists
 *
 * Since HOS-171 every Hospeda subscription is a MercadoPago preapproval, so
 * `subscription_authorized_payment` is not a corner of the money path — it is
 * the ONLY way a subscription is ever charged. That path recorded the charge in
 * `billing_payments` and dispatched nothing: measured in staging on 2026-09-08,
 * four real subscription charges produced zero rows in
 * `billing_notification_log` and not one line in the API log about a
 * notification — no attempt, no skip, no error. The absence of a receipt was
 * indistinguishable from a silent failure.
 *
 * The add-on / preference path (`payment-logic.ts`) does send one, which is why
 * the template was never suspected: `payment_success` worked, for the one flow
 * that is not a subscription.
 *
 * ## What is hung on what, and why it matters
 *
 * The dispatch is anchored on a CHARGE THAT CLEARED — `chargeStatus` plus a
 * `providerPaymentId` — and never on a subscription status transition. That
 * distinction is load-bearing as of HOS-914: the `subscription-drift-reconcile`
 * cron delegates its writes to `processSubscriptionUpdated`, the same function
 * the preapproval webhook uses, so a receipt hung on a transition would be
 * mailed every time a reconciliation sweep corrected a row. Money arriving is an
 * event; a row being reconciled is not.
 *
 * The `chargeStatus` gate lives INSIDE {@link dispatchSubscriptionChargeReceipt}
 * rather than at its call sites, deliberately. A gate replicated at N call sites
 * is a gate that N-1 of them eventually forget; here a caller cannot reach the
 * send without passing the status through the check.
 *
 * ## Loudness
 *
 * Every outcome is reported at a level production actually emits. `LOG_LEVEL`
 * defaults to `info`, so a `debug` line is invisible exactly where it is needed.
 *
 * Escalation is narrower than reporting, deliberately. A receipt that did not go out
 * is logged either way, but only a disposition that is neither retried nor expected
 * (`'error'`) gets `capture`. Paging on every `delivered: false` would alert once per
 * charge for a transport failure the notification service has already enqueued a
 * retry for, for a customer who opted out, and for every charge in an environment
 * with no `HOSPEDA_EMAIL_API_KEY` — noise that teaches people to ignore the one alert
 * that means a receipt is genuinely lost.
 *
 * @module routes/webhooks/mercadopago/subscription-charge-receipt
 */

import type { Major } from '@repo/billing';
import { and, billingNotificationLog, eq, getDb, sql } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { getQZPayBilling } from '../../../middlewares/billing';
import { apiLogger } from '../../../utils/logger';
import { sendPaymentSuccessNotification } from './notifications';

/**
 * The QZPay-normalized status of a charge that actually cleared.
 *
 * The single spelling this module accepts. `'processing'` is NOT terminal (it can
 * still become `'rejected'`), so treating it as cleared would mail a receipt for
 * money that never arrived — the same reasoning that gates the promo-cycle
 * countdown in `subscription-payment-handler.ts`.
 */
const CLEARED_CHARGE_STATUS = 'succeeded';

/**
 * Why a dispatch did not happen. Returned rather than logged-and-forgotten so a
 * caller (and a test) can tell the three non-sends apart.
 */
export type ReceiptSkipReason =
    /** `chargeStatus` was not the cleared spelling — no money to acknowledge. */
    | 'charge-not-settled'
    /** A delivered receipt for this same MercadoPago payment is already on record. */
    | 'already-dispatched'
    /** The send was attempted and the notification service did not deliver it. */
    | 'not-delivered'
    /** Something threw on the way to the send. Distinct from `not-delivered`, which
     * is the service's own verdict: this one means we never got a verdict. */
    | 'dispatch-threw';

/**
 * Outcome of an attempted receipt dispatch.
 */
export interface SubscriptionChargeReceiptOutcome {
    /** `true` only when the notification service reported an actual delivery. */
    readonly dispatched: boolean;
    /** Present exactly when `dispatched` is `false`. */
    readonly reason?: ReceiptSkipReason;
}

/**
 * The idempotency key identifying "the payment-success receipt for THIS
 * MercadoPago payment".
 *
 * Keyed on the PAYMENT, deliberately — not on the notification, and not on the
 * webhook event. See {@link wasPaymentSuccessAlreadyDispatched} for why that
 * distinction is the whole point.
 *
 * Because the key names only the payment, the two producers that can reach a
 * receipt for one charge — this module's subscription path and
 * `payment-logic.ts`'s preference path — dedupe against EACH OTHER rather than
 * only against themselves. Giving the subscription path a key of its own would
 * have been the easy change and would have reopened HOS-676 across paths.
 *
 * @param providerPaymentId - MercadoPago `payment.id`.
 * @returns The key written into `billing_notification_log.metadata`.
 */
export function paymentSuccessIdempotencyKey(providerPaymentId: string): string {
    return `payment-success:mercadopago:${providerPaymentId}`;
}

/**
 * Has the payment-success receipt for this MercadoPago payment already been
 * delivered?
 *
 * ## Why a payment-scoped check exists at all (HOS-757)
 *
 * HOS-763 turned the success notification on. One settled charge can reach that
 * dispatch more than once, from independent producers, and NONE of them is
 * covered by the webhook-event idempotency upstream:
 *
 * - **Two provider notifications for the same payment.** The
 *   `billing_webhook_events` guard in `event-handler.ts` dedupes on
 *   `providerEventId`, and in `@qazuor/qzpay-mercadopago` `mapToQZPayEvent` sets
 *   `id: String(mpEvent.id)` — the id of the NOTIFICATION, not of the payment.
 *   Two notifications about one charge therefore carry two distinct
 *   `providerEventId`s, both pass that guard, and both reach the dispatch. That
 *   guard stops a REDELIVERY of one notification; it cannot stop two
 *   notifications about one payment.
 * - **The polling cron.** `subscription-poll.job.ts` re-enters
 *   `processPaymentUpdated` with a synthetic payload for a charge the webhook may
 *   already have processed, and it writes no `billing_webhook_events` row at all,
 *   so the upstream guard never even looks at it.
 * - **The dead-letter retry cron** (HOS-1238). `webhook-retry.job.ts` re-settles
 *   an authorized payment whose live handler failed. Its own
 *   `paymentAlreadyRecorded` check covers the ledger row; only this lookup covers
 *   the receipt.
 *
 * ## Why `billing_notification_log`
 *
 * It is the repo's existing durable answer to "was this notification already
 * sent?", and the pattern is already load-bearing in `addon-expiry.job.ts`:
 * write an `idempotencyKey` into `metadata`, query it back before sending. It
 * survives a process restart and is shared across instances, unlike the
 * Redis-with-in-memory-fallback scheme in `notification-schedule.job.ts`, whose
 * fallback is per-process and would not hold for a multi-instance webhook.
 *
 * Note the division of labour, which `propagate-plan-price-changes.job.ts`
 * states explicitly for the same mechanism: passing `idempotencyKey` to the
 * sender only RECORDS the key — it does not prevent a second delivery. This
 * pre-send lookup is the gate.
 *
 * The query filters `status = 'sent'`, a deliberate deviation from
 * `addon-expiry.job.ts`, which matches any logged row. A row logged `failed`
 * means the customer did NOT receive the email, so treating it as "already sent"
 * would convert a delivery failure into a permanently missing payment receipt.
 * Excluding it still prevents every real duplicate, because only a delivered
 * notification can be duplicated.
 *
 * FAIL-OPEN on error, matching that precedent verbatim ("allowing send to avoid
 * missing notifications"): a lookup that cannot run must not silence a receipt
 * the customer is owed. The worst case in this direction is the duplicate it is
 * trying to prevent; the worst case in the other is a paying customer told
 * nothing.
 *
 * @param params.customerId - Billing customer id, which narrows the query onto
 *   the existing `(customer_id, type)` index.
 * @param params.providerPaymentId - MercadoPago `payment.id`.
 * @param params.source - Caller label, for the diagnostic log only.
 * @returns `true` only when a DELIVERED payment-success notification is already
 *   on record for this payment; `false` when none is, and `false` when the
 *   lookup itself failed.
 */
export async function wasPaymentSuccessAlreadyDispatched(params: {
    readonly customerId: string;
    readonly providerPaymentId: string;
    readonly source: string;
}): Promise<boolean> {
    const { customerId, providerPaymentId, source } = params;
    const idempotencyKey = paymentSuccessIdempotencyKey(providerPaymentId);

    try {
        const [existing] = await getDb()
            .select({ id: billingNotificationLog.id })
            .from(billingNotificationLog)
            .where(
                and(
                    eq(billingNotificationLog.type, NotificationType.PAYMENT_SUCCESS),
                    eq(billingNotificationLog.customerId, customerId),
                    eq(billingNotificationLog.status, 'sent'),
                    eq(sql`${billingNotificationLog.metadata}->>'idempotencyKey'`, idempotencyKey)
                )
            )
            .limit(1);

        if (existing) {
            apiLogger.info(
                { customerId, providerPaymentId, source },
                'Payment-success notification already delivered for this payment — skipping (idempotent)'
            );
            return true;
        }
        return false;
    } catch (lookupError) {
        apiLogger.warn(
            {
                customerId,
                providerPaymentId,
                source,
                error: lookupError instanceof Error ? lookupError.message : String(lookupError)
            },
            'Payment-success idempotency check failed — proceeding as not-yet-sent'
        );
        return false;
    }
}

/**
 * Mail the customer the receipt for a recurring subscription charge (HOS-1238).
 *
 * Call this from every site that settles a `subscription_authorized_payment`
 * into `billing_payments` — currently the live webhook handler and the
 * dead-letter retry cron. Both are covered by
 * `subscription-charge-receipt-sites.guard.test.ts`, which fails CI if a site
 * that settles such a charge does not also dispatch its receipt.
 *
 * Never throws, and that is a guarantee rather than an observation about today's
 * internals. The money has already moved and is already on record by the time this
 * runs, so a notification problem must never turn a settled charge into a failed
 * webhook (which MercadoPago would redeliver) — and in the dead-letter cron the
 * call sits inside the try whose catch enqueues an ORPHAN PAYMENT, so a throw from
 * here would file a "the ledger write failed" alert about a row that was written
 * perfectly. The outer catch below is what makes that unreachable from every call
 * site at once, instead of asking each one to remember.
 *
 * ## `planId`, and why the charged subscription has to supply it
 *
 * The plan label is resolved from the subscription THIS charge belongs to, not
 * from the customer's subscription list. One account legitimately holds several
 * subscriptions at once across the five product domains — a host who also runs a
 * restaurant and is a partner — so `getByCustomerId()[0]` names an arbitrary one
 * of them. On a gastronomy renewal it would print the accommodation plan, and the
 * customer would be looking at a receipt for a plan they were not charged for.
 *
 * @param params.customerId - Billing customer resolved from the local subscription.
 * @param params.planId - `billing_plans.id` of the subscription that was charged,
 *   or `null` when the local row carries none — in which case the label degrades to
 *   a generic one rather than to a wrong one.
 *
 *   That second half was FALSE until the review caught it. The producer collapsed
 *   `null` and "argument omitted" with `??`, so passing `null` selected the
 *   `getByCustomerId()[0]` fallback — i.e. the wrong plan, which is the exact thing
 *   this parameter exists to prevent — and the test asserting otherwise passed
 *   because it only checked that the `null` was forwarded. It is true now because
 *   the producer distinguishes the two. Unreachable either way while
 *   `billing_subscriptions.plan_id` is `.notNull()`, which is precisely how it could
 *   sit here being wrong with a green test agreeing with it.
 * @param params.providerPaymentId - MercadoPago `payment.id` of the settled charge.
 * @param params.amountMajor - The charged amount in MAJOR units (ARS pesos).
 *   MercadoPago's `transaction_amount` already is; `billing_payments` stores
 *   CENTAVOS, and handing those over is HOS-713 — a real $150.00 charge mailed as
 *   $15.000,00. The {@link Major} brand is what keeps the two apart here.
 * @param params.currency - ISO 4217 code of the charge.
 * @param params.chargeStatus - QZPay-normalized status of the charge, as MAPPED from
 *   the provider's own disposition — never asserted by the caller. Anything other
 *   than the cleared spelling returns without sending, so this gate is only as
 *   truthful as the value handed to it;
 *   `subscription-charge-receipt-sites.guard.test.ts` fails CI on a literal.
 * @param params.billing - QZPay billing instance.
 * @param params.localSubscriptionId - For the log line only.
 * @param params.source - Caller label, recorded in every log line below.
 * @returns Whether a receipt was actually delivered, and if not, which of the
 *   three non-sends happened.
 */
export async function dispatchSubscriptionChargeReceipt(params: {
    readonly customerId: string;
    readonly planId: string | null;
    readonly providerPaymentId: string;
    readonly amountMajor: Major;
    readonly currency: string;
    readonly chargeStatus: string;
    readonly billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    readonly localSubscriptionId: string;
    readonly source: string;
}): Promise<SubscriptionChargeReceiptOutcome> {
    const {
        customerId,
        planId,
        providerPaymentId,
        amountMajor,
        currency,
        chargeStatus,
        billing,
        localSubscriptionId,
        source
    } = params;

    // The gate lives here, not at the call sites — see the module JSDoc.
    if (chargeStatus !== CLEARED_CHARGE_STATUS) {
        apiLogger.info(
            { customerId, providerPaymentId, localSubscriptionId, chargeStatus, source },
            'Subscription charge did not clear — no payment receipt dispatched'
        );
        return { dispatched: false, reason: 'charge-not-settled' };
    }

    try {
        if (await wasPaymentSuccessAlreadyDispatched({ customerId, providerPaymentId, source })) {
            return { dispatched: false, reason: 'already-dispatched' };
        }

        const outcome = await sendPaymentSuccessNotification(
            customerId,
            amountMajor,
            currency,
            // The authorized-payment REST payload carries no payment method: its
            // inner `payment` block holds `{ id, status, status_detail }` and
            // nothing else (verified against authorized payment `7031725770`).
            // The template omits the line rather than guessing one.
            null,
            billing,
            paymentSuccessIdempotencyKey(providerPaymentId),
            planId
        );

        if (!outcome.delivered) {
            // Reported at a level production emits — never `debug`, which was the
            // original defect. But NOT escalated indiscriminately: `delivered: false`
            // covers a receipt that is lost AND one that is merely late, and paging
            // on both means an alert per charge for things that self-heal in a minute
            // or were never meant to send at all.
            //
            // - `'skipped'`: the customer opted out of this notification type. The
            //   system did what it was told; there is nothing to fix.
            // - `'send-failed'`: the transport refused and `NotificationService.send`
            //   already enqueued a retry before returning, so the usual outcome is
            //   delivery ~60s later. If the retries themselves exhaust, that is the
            //   retry service's to report — it owns the attempt count, and this
            //   function cannot see it.
            // - `'unavailable'`: no notification service in the process at all
            //   (`HOSPEDA_EMAIL_API_KEY` unset). Identical for every notification
            //   rather than specific to this charge, and already logged by the helper.
            //
            // Only `'error'` — something threw on the way out — is both unexpected and
            // unretried, so only it is escalated here. The sibling `catch` below does
            // the same for a throw this function can see itself.
            const escalate = outcome.disposition === 'error';
            const detail = {
                customerId,
                providerPaymentId,
                localSubscriptionId,
                planId,
                currency,
                source,
                disposition: outcome.disposition ?? 'unknown'
            };

            if (escalate) {
                apiLogger.error(
                    detail,
                    'Subscription charge receipt was NOT delivered — the customer paid and received no acknowledgement',
                    { capture: true }
                );
            } else {
                apiLogger.warn(
                    detail,
                    'Subscription charge receipt did not go out on this attempt — see `disposition` for whether it is retried, declined by the customer, or environmental'
                );
            }
            return { dispatched: false, reason: 'not-delivered' };
        }

        apiLogger.info(
            { customerId, providerPaymentId, localSubscriptionId, planId, currency, source },
            'Subscription charge receipt dispatched to the customer'
        );
        return { dispatched: true };
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                providerPaymentId,
                localSubscriptionId,
                planId,
                source,
                error: error instanceof Error ? error.message : String(error)
            },
            'Subscription charge receipt threw on the way out — the customer paid and received no acknowledgement',
            { capture: true }
        );
        return { dispatched: false, reason: 'dispatch-threw' };
    }
}
