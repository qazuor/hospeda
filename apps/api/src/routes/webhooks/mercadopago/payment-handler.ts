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

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { getQZPayBilling } from '../../../middlewares/billing';
import { apiLogger } from '../../../utils/logger';
import { cleanupRequestProviderEventId } from './event-handler';
import { processPaymentUpdated } from './payment-logic';
import { markEventProcessedByProviderId } from './utils';

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
 * Processes payment status changes, including add-on purchases.
 * If the payment is for an add-on, confirms the purchase and applies entitlements.
 * Sends payment success/failure notifications based on payment status.
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
        const billing = getQZPayBilling();

        if (!billing) {
            apiLogger.warn('Billing not configured, skipping add-on processing');
            return undefined;
        }

        const eventData = event.data as unknown;

        if (!eventData || typeof eventData !== 'object') {
            return undefined;
        }

        const data = eventData as Record<string, unknown>;

        await processPaymentUpdated({
            data,
            billing,
            source: 'webhook'
        });
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                eventId: event.id,
                requestId: c.get('requestId')
            },
            'Error processing add-on purchase in webhook'
        );
    }

    await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    cleanupRequestProviderEventId(String(c.get('requestId') || event.id));

    return undefined;
};
