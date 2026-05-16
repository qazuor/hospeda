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
import { getQZPayBilling } from '../../../middlewares/billing.js';
import { env } from '../../../utils/env.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    type MPAuthorizedPaymentDetails,
    fetchAuthorizedPaymentDetails
} from '../../../utils/mp-authorized-payment.js';
import { cleanupRequestProviderEventId } from './event-handler.js';
import { markEventProcessedByProviderId } from './utils.js';

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
    } catch (recordErr) {
        apiLogger.error(
            {
                eventId: event.id,
                requestId,
                authorizedPaymentId,
                error: recordErr instanceof Error ? recordErr.message : String(recordErr)
            },
            'MercadoPago webhook: unexpected error while recording subscription_authorized_payment — event acknowledged'
        );
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
