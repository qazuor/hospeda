/**
 * Payment webhook handlers for MercadoPago IPN events.
 *
 * Handles payment.created and payment.updated events, including:
 * - Add-on purchase confirmation via AddonService
 * - Payment success/failure notification dispatch
 * - Webhook event idempotency tracking
 *
 * @module routes/webhooks/mercadopago/payment-handler
 */

import type { QZPayProviderPayment } from '@qazuor/qzpay-core';
import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { captureBillingError } from '../../../lib/sentry';
import { apiLogger } from '../../../utils/logger';
import { cleanupRequestProviderEventId } from './event-handler';
import { processPaymentUpdated } from './payment-logic';
import {
    getWebhookDependencies,
    markEventFailedByProviderId,
    markEventProcessedByProviderId
} from './utils';

/**
 * Handler for payment.created events.
 *
 * Logs new payment creation for monitoring.
 * Updates webhook event status after successful processing.
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handlePaymentCreated: QZPayWebhookHandler = async (c, event) => {
    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Payment created'
    );

    await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    cleanupRequestProviderEventId(String(c.get('requestId') || event.id));

    return undefined; // Continue to default processing
};

/**
 * Handler for payment.updated events.
 *
 * Processes payment status changes (annual subscription confirmation, plan
 * upgrade confirmation, add-on purchase confirmation, success/failure
 * notifications).
 *
 * MercadoPago's IPN format only carries `data.id` in the webhook body —
 * the full payment object (status, amount, currency, metadata, …) must be
 * fetched from MP via `paymentAdapter.payments.retrieve(id)` before the
 * downstream dispatchers in `processPaymentUpdated` can do anything useful.
 * Before SPEC-143 T-143-09 this fetch was missing and every dispatch path
 * silently no-op'd because `extractPaymentInfo` returned null on the
 * field-less `{ id }` data.
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handlePaymentUpdated: QZPayWebhookHandler = async (c, event) => {
    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Payment updated'
    );

    try {
        const dependencies = getWebhookDependencies();

        if (!dependencies) {
            apiLogger.warn(
                { eventId: event.id, requestId: c.get('requestId') },
                'Billing not configured, skipping payment.updated processing'
            );
            await markEventProcessedByProviderId({ providerEventId: String(event.id) });
            cleanupRequestProviderEventId(String(c.get('requestId') || event.id));
            return undefined;
        }

        const eventData = event.data as unknown;
        const paymentId =
            eventData !== null &&
            typeof eventData === 'object' &&
            'id' in eventData &&
            (typeof (eventData as { id: unknown }).id === 'string' ||
                typeof (eventData as { id: unknown }).id === 'number')
                ? String((eventData as { id: unknown }).id)
                : null;

        if (!paymentId) {
            apiLogger.warn(
                { eventId: event.id, requestId: c.get('requestId') },
                'payment.updated event missing data.id — skipping'
            );
            await markEventProcessedByProviderId({ providerEventId: String(event.id) });
            cleanupRequestProviderEventId(String(c.get('requestId') || event.id));
            return undefined;
        }

        // Fetch the full payment object — IPN carries only data.id.
        // A failure here is a transient provider error — mark failed so the
        // dead-letter queue can retry it, instead of silently treating it as
        // processed. MercadoPago will not retry acknowledged (2xx) events, so
        // we rely on our own retry/DLQ mechanism for recovery.
        let providerPayment: QZPayProviderPayment;
        try {
            providerPayment = await dependencies.paymentAdapter.payments.retrieve(paymentId);
        } catch (retrieveErr) {
            const errMessage =
                retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr);
            apiLogger.error(
                {
                    paymentId,
                    eventId: event.id,
                    requestId: c.get('requestId'),
                    error: errMessage
                },
                'Failed to retrieve payment from MercadoPago — marking event failed for retry'
            );
            captureBillingError(
                retrieveErr instanceof Error ? retrieveErr : new Error(errMessage),
                { operation: 'payment_retrieve' }
            );
            await markEventFailedByProviderId({
                providerEventId: String(event.id),
                errorMessage: errMessage
            });
            cleanupRequestProviderEventId(String(c.get('requestId') || event.id));
            return undefined;
        }

        // Map the QZPayProviderPayment shape (qzpay's normalized type) to the
        // MP-raw-ish shape that the existing extractors (extractPaymentInfo,
        // extractAnnualSubscriptionMetadata, …) consume. The mapping is
        // straightforward: amount → transaction_amount and currency →
        // currency_id; status and metadata pass through unchanged. Fields
        // that exist only in MP raw (status_detail, payment_method_id) stay
        // null — those are used only by failure notification copy, not by
        // any dispatch decision.
        const data: Record<string, unknown> = {
            id: providerPayment.id,
            transaction_amount: providerPayment.amount,
            currency_id: providerPayment.currency,
            status: providerPayment.status,
            metadata: providerPayment.metadata
        };

        await processPaymentUpdated({
            data,
            billing: dependencies.billing,
            source: 'webhook'
        });
    } catch (error) {
        // Transient / unexpected error from processPaymentUpdated (e.g. DB
        // hiccup, provider sync failure). Mark the event failed so the
        // dead-letter queue can retry it. Never silently treat it as processed.
        const errMessage = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            {
                error: errMessage,
                stack: error instanceof Error ? error.stack : undefined,
                eventId: event.id,
                requestId: c.get('requestId')
            },
            'Error processing payment.updated in webhook — marking event failed for retry'
        );
        captureBillingError(error instanceof Error ? error : new Error(errMessage), {
            operation: 'payment_updated_webhook'
        });
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
                'Failed to mark payment.updated event as failed — event may be reprocessed'
            );
        }
        cleanupRequestProviderEventId(String(c.get('requestId') || event.id));
        return undefined;
    }

    await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    cleanupRequestProviderEventId(String(c.get('requestId') || event.id));

    return undefined;
};
