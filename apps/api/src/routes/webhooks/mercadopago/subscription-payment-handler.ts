/**
 * Subscription Recurring Payment Webhook Handler (SPEC-141 D4).
 *
 * Handles MercadoPago `subscription_authorized_payment.{created,updated}`
 * events — the IPN notifications MP fires when a recurring monthly charge
 * is scheduled / executed against an active preapproval (subscription).
 *
 * What this handler does:
 * - Fetches the full authorized-payment object from MP REST (since the
 *   IPN payload only carries the authorized-payment ID).
 * - Resolves the linked local `billing_subscriptions` row from MP's
 *   `preapproval_id`.
 * - Inserts a `billing_payments` row for the recurring charge, with
 *   per-MP-payment-id idempotency so webhook retries do not duplicate.
 * - Always acknowledges the event so MP stops retrying, even on upstream
 *   failures (errors are logged, never re-thrown).
 *
 * What this handler does NOT do:
 * - Recover a `past_due` subscription back to `active` when a retry
 *   succeeds — that transition flows through the
 *   `subscription_preapproval.updated` event and is handled upstream.
 *
 * @module routes/webhooks/mercadopago/subscription-payment-handler
 */

import type { QZPayCurrency, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { and, billingPayments, billingSubscriptions, eq, getDb, isNull, sql } from '@repo/db';
import { resolveRenewalPromoEffect } from '@repo/service-core';
import { getQZPayBilling } from '../../../middlewares/billing.js';
import { restoreFullPriceMutation } from '../../../services/promo-renewal-mp.service.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    type MPAuthorizedPaymentDetails,
    fetchAuthorizedPaymentDetails
} from '../../../utils/mp-authorized-payment.js';
import { cleanupRequestProviderEventId } from './event-handler.js';
import { markEventFailedByProviderId, markEventProcessedByProviderId } from './utils.js';

const MP_PROVIDER_KEY = 'mercadopago';
const FALLBACK_CURRENCY: QZPayCurrency = 'ARS';

/**
 * Extract the authorized-payment ID from a MercadoPago webhook event
 * payload, if present. MP wraps the ID in `data.id`. Defensive against
 * malformed payloads (returns `null` rather than throwing).
 */
function extractAuthorizedPaymentId(event: { data: unknown }): string | null {
    const data = event.data;
    if (!data || typeof data !== 'object') {
        return null;
    }
    const candidate = (data as Record<string, unknown>).id;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

/**
 * Map a MercadoPago authorized-payment status to a `QZPayPaymentStatus`.
 *
 * Prefers the inner `payment.status` (reflects the actual gateway
 * disposition) and falls back to the outer authorization-lifecycle
 * `status` when the inner block is absent.
 */
function mapMpStatusToQZPayStatus(details: MPAuthorizedPaymentDetails): QZPayPaymentStatus {
    const source = details.paymentStatus ?? details.status;
    switch (source) {
        case 'approved':
        case 'processed':
            return 'succeeded';
        case 'rejected':
            return 'failed';
        case 'cancelled':
        case 'canceled':
            return 'canceled';
        case 'refunded':
            return 'refunded';
        case 'in_process':
        case 'in_mediation':
            return 'processing';
        default:
            return 'pending';
    }
}

/**
 * Find the local `billing_subscriptions` row mapped to a MercadoPago
 * preapproval ID. Returns the bare minimum needed to record a payment
 * (`id`, `customerId`).
 */
async function findLocalSubscriptionByPreapprovalId(
    preapprovalId: string
): Promise<{ id: string; customerId: string } | null> {
    const db = getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.mpSubscriptionId, preapprovalId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);
    return rows[0] ?? null;
}

/**
 * Check whether a `billing_payments` row already exists for the given
 * MercadoPago payment ID. Uses the JSONB `provider_payment_ids` map
 * (shape `{ mercadopago: paymentId }`) for the lookup, matching the
 * pattern used by qzpay-drizzle's repository.
 */
async function paymentAlreadyRecorded(providerPaymentId: string): Promise<boolean> {
    const db = getDb();
    const rows = await db
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(
            and(
                sql`${billingPayments.providerPaymentIds}->>${MP_PROVIDER_KEY} = ${providerPaymentId}`,
                isNull(billingPayments.deletedAt)
            )
        )
        .limit(1);
    return rows.length > 0;
}

/**
 * Mark a webhook event as processed without ever throwing — logs the
 * failure if the update itself fails so MP can retry.
 */
async function safeMarkProcessed(eventId: string | number): Promise<void> {
    try {
        await markEventProcessedByProviderId({ providerEventId: String(eventId) });
    } catch (err) {
        apiLogger.warn(
            { eventId, error: err instanceof Error ? err.message : String(err) },
            'Failed to mark subscription_authorized_payment event as processed'
        );
    }
}

/**
 * Apply the SPEC-262 multi-cycle promo discount decision after a recurring
 * charge is confirmed.
 *
 * Calls `resolveRenewalPromoEffect` (service-core decides + persists the
 * decremented `promo_effect_remaining_cycles`), then EXECUTES the MercadoPago
 * mutation only when the discount has just been exhausted (`restore-full`).
 *
 * Never throws — a failure here must not block the webhook bucket (the charge
 * already settled). The MP restore is best-effort-with-retry inside
 * `restoreFullPriceMutation`, which reports to Sentry on exhaustion.
 *
 * @internal
 */
async function handleRenewalPromoEffect(params: {
    localSubscriptionId: string;
    mpSubscriptionId: string;
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    eventId: string | number;
    requestId: string;
}): Promise<void> {
    const { localSubscriptionId, mpSubscriptionId, billing, eventId, requestId } = params;

    try {
        const decision = await resolveRenewalPromoEffect({ subscriptionId: localSubscriptionId });

        if (!decision.success) {
            apiLogger.warn(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    error: decision.error.message
                },
                'MercadoPago webhook: failed to resolve renewal promo effect — skipping amount reconciliation'
            );
            return;
        }

        const data = decision.data;

        // comp / noop / apply-discount (still discounted): no MP mutation needed.
        // - comp: never charged, no preapproval to mutate.
        // - apply-discount: the amount is already at the discounted value (set at
        //   apply time); the counter was just decremented by service-core.
        // - noop: no promo, non-discount effect, or already exhausted.
        if (data.action !== 'restore-full') {
            apiLogger.debug(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    action: data.action,
                    remainingCyclesAfter: data.remainingCyclesAfter ?? null
                },
                'MercadoPago webhook: renewal promo effect resolved — no MP amount mutation required'
            );
            return;
        }

        // restore-full: the last discounted cycle just charged. Raise the
        // preapproval amount back to full price for the NEXT cycle (best-effort).
        if (data.targetTransactionAmountMajor === undefined) {
            apiLogger.error(
                { eventId, requestId, localSubscriptionId },
                'MercadoPago webhook: restore-full decision missing targetTransactionAmountMajor — skipping MP restore'
            );
            return;
        }

        const restoreResult = await restoreFullPriceMutation({
            billing,
            mpSubscriptionId,
            targetTransactionAmountMajor: data.targetTransactionAmountMajor,
            subscriptionId: localSubscriptionId
        });

        if (!restoreResult.success) {
            // Already logged + Sentry-captured inside restoreFullPriceMutation.
            apiLogger.warn(
                {
                    eventId,
                    requestId,
                    localSubscriptionId,
                    mpSubscriptionId,
                    error: restoreResult.error.message
                },
                'MercadoPago webhook: full-price restore failed (best-effort) — preapproval may stay discounted one extra cycle'
            );
        }
    } catch (renewalErr) {
        // Defensive: resolveRenewalPromoEffect already returns typed errors, but
        // a thrown error must never bubble up and block the webhook ack.
        apiLogger.error(
            {
                eventId,
                requestId,
                localSubscriptionId,
                error: renewalErr instanceof Error ? renewalErr.message : String(renewalErr)
            },
            'MercadoPago webhook: unexpected error during renewal promo effect handling — webhook still acknowledged'
        );
    }
}

/**
 * Handler for `subscription_authorized_payment.{created,updated}` events.
 *
 * MP fires `.created` when a recurring charge enters the system (status
 * `scheduled` / `processed` / `recycling` / `cancelled`) and `.updated`
 * on state transitions. Both share the same payload shape, so one
 * handler covers both.
 *
 * Errors are intentionally swallowed (logged, not re-thrown) — a single
 * noisy event must not block the webhook bucket. The event is always
 * marked processed so MP stops retrying.
 */
export const handleSubscriptionAuthorizedPayment: QZPayWebhookHandler = async (c, event) => {
    const requestId = String(c.get('requestId') || event.id);
    const authorizedPaymentId = extractAuthorizedPaymentId(event);

    if (!authorizedPaymentId) {
        apiLogger.warn(
            { eventId: event.id, requestId },
            'MercadoPago webhook: subscription_authorized_payment event has no extractable authorized-payment ID'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const accessToken = env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
        apiLogger.error(
            { eventId: event.id, requestId, authorizedPaymentId },
            'MercadoPago webhook: HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN not configured — cannot fetch authorized-payment details'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const billing = getQZPayBilling();
    if (!billing) {
        apiLogger.error(
            { eventId: event.id, requestId, authorizedPaymentId },
            'MercadoPago webhook: QZPay billing instance unavailable — cannot record payment'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const fetchResult = await fetchAuthorizedPaymentDetails({
        authorizedPaymentId,
        accessToken
    });

    if (fetchResult.kind !== 'ok') {
        apiLogger.warn(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                kind: fetchResult.kind,
                message: fetchResult.kind === 'error' ? fetchResult.message : undefined
            },
            'MercadoPago webhook: failed to fetch authorized-payment details — event acknowledged without recording'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    const details = fetchResult.details;

    // No real payment.id yet (status='scheduled' or pre-settlement): nothing
    // to record. A later .updated event will carry the settled paymentId.
    if (!details.paymentId) {
        apiLogger.info(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                preapprovalId: details.preapprovalId,
                status: details.status
            },
            'MercadoPago webhook: authorized-payment has no settled payment yet; nothing to record'
        );
        await safeMarkProcessed(event.id);
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    try {
        const sub = await findLocalSubscriptionByPreapprovalId(details.preapprovalId);
        if (!sub) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    preapprovalId: details.preapprovalId
                },
                'MercadoPago webhook: no local subscription found for preapproval ID — payment NOT recorded'
            );
            await safeMarkProcessed(event.id);
            cleanupRequestProviderEventId(requestId);
            return undefined;
        }

        if (await paymentAlreadyRecorded(details.paymentId)) {
            apiLogger.info(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    mpPaymentId: details.paymentId,
                    localSubscriptionId: sub.id
                },
                'MercadoPago webhook: payment already recorded for this MP payment ID; idempotent skip'
            );
            await safeMarkProcessed(event.id);
            cleanupRequestProviderEventId(requestId);
            return undefined;
        }

        // Convert major units (e.g. 999.50 ARS) to integer centavos for storage.
        const amountInCentavos = Math.round(details.transactionAmount * 100);
        const status = mapMpStatusToQZPayStatus(details);
        const currency: QZPayCurrency = (details.currencyId as QZPayCurrency) || FALLBACK_CURRENCY;

        if (details.currencyId !== currency) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    requestId,
                    authorizedPaymentId,
                    receivedCurrency: details.currencyId,
                    fallbackCurrency: currency
                },
                'MercadoPago webhook: authorized-payment currency mismatch; fell back to default'
            );
        }

        const recorded = await billing.payments.record({
            id: crypto.randomUUID(),
            customerId: sub.customerId,
            amount: amountInCentavos,
            currency,
            status,
            provider: MP_PROVIDER_KEY,
            providerPaymentId: details.paymentId,
            subscriptionId: sub.id,
            metadata: {
                mpAuthorizedPaymentId: details.authorizedPaymentId,
                mpDebitDate: details.debitDate ?? null
            }
        });

        apiLogger.info(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                mpPaymentId: details.paymentId,
                localSubscriptionId: sub.id,
                billingPaymentId: recorded.id,
                amountInCentavos,
                currency,
                status
            },
            'MercadoPago webhook: recurring payment recorded in billing_payments'
        );

        // SPEC-262 T-007 (B2 fix): Only decrement the cycle counter when the
        // charge SUCCEEDED. A rejected/failed/pending charge must not consume a
        // discounted cycle — the next MP retry (different paymentId, passes the
        // per-paymentId dedup) would decrement again → discount ends early.
        // 'processing' (MP 'in_process'/'in_mediation') is NOT terminal: it can
        // still transition to 'rejected', so decrementing on it and again on the
        // eventual retry double-consumes a cycle. Gate strictly on 'succeeded'.
        if (status === 'succeeded') {
            // SPEC-262 T-007: multi-cycle promo discount renewal handling.
            // Anchor the discounted-cycle countdown on this post-charge event
            // (spike doc §5.2). service-core DECIDES + persists the decremented
            // counter; this handler EXECUTES the MP restore when the discount is
            // exhausted. Never blocks the webhook — the charge already happened.
            //
            // NIT: handleRenewalPromoEffect is fire-and-forget (void) so the
            // internal restore-retry loop (up to 3×500ms) does NOT add latency
            // to the webhook ACK path. The charge already settled; the restore
            // is best-effort and Sentry-reported on exhaustion.
            void handleRenewalPromoEffect({
                localSubscriptionId: sub.id,
                mpSubscriptionId: details.preapprovalId,
                billing,
                eventId: event.id,
                requestId
            });
        }
    } catch (recordErr) {
        // Transient / unexpected error (DB hiccup, record() failure). Mark the
        // event failed so the dead-letter queue can retry it rather than
        // silently treating it as processed. MP will not retry acknowledged
        // events, so our own retry mechanism is the only recovery path.
        const errMessage = recordErr instanceof Error ? recordErr.message : String(recordErr);
        apiLogger.error(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                error: errMessage
            },
            'MercadoPago webhook: unexpected error while recording subscription_authorized_payment — marking event failed for retry'
        );
        try {
            await markEventFailedByProviderId({
                providerEventId: String(event.id),
                errorMessage: errMessage
            });
        } catch (markErr) {
            apiLogger.warn(
                {
                    eventId: event.id,
                    error: markErr instanceof Error ? markErr.message : String(markErr)
                },
                'Failed to mark subscription_authorized_payment event as failed — event may be reprocessed'
            );
        }
        cleanupRequestProviderEventId(requestId);
        return undefined;
    }

    await safeMarkProcessed(event.id);
    cleanupRequestProviderEventId(requestId);
    return undefined;
};

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    extractAuthorizedPaymentId,
    mapMpStatusToQZPayStatus,
    findLocalSubscriptionByPreapprovalId,
    paymentAlreadyRecorded,
    safeMarkProcessed
};

// ---------------------------------------------------------------------------
// Shared helpers — exported for reuse by the dead-letter retry cron job.
// Naming convention: production-safe exports use a `sharedForRetry` namespace
// to distinguish them from the test-only `_internals` object.
// ---------------------------------------------------------------------------

/**
 * Resolve a local `billing_subscriptions` row from a MercadoPago preapproval
 * ID. Shared between the live webhook handler and the dead-letter retry job
 * so both use the same lookup logic.
 *
 * @param preapprovalId - The MercadoPago preapproval (subscription) ID.
 * @returns The local subscription's `id` and `customerId`, or `null` if not found.
 */
export { findLocalSubscriptionByPreapprovalId };

/**
 * Check whether a `billing_payments` row already exists for a given
 * MercadoPago payment ID. Used by both the live handler and the dead-letter
 * retry cron to prevent duplicate records.
 *
 * @param providerPaymentId - The MercadoPago payment ID to check.
 * @returns `true` if a record already exists.
 */
export { paymentAlreadyRecorded };
