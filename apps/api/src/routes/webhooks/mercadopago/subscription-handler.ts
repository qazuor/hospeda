/**
 * Subscription webhook handler for MercadoPago IPN events.
 *
 * Handles subscription_preapproval.updated events by delegating to
 * processSubscriptionUpdated for full state sync with MercadoPago.
 *
 * @module routes/webhooks/mercadopago/subscription-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { apiLogger } from '../../../utils/logger.js';
import { processSubscriptionUpdated } from './subscription-logic.js';
import { getWebhookDependencies, markEventProcessedByProviderId } from './utils.js';

/**
 * Handler for subscription_preapproval.updated events.
 *
 * Fetches current subscription state from MercadoPago, updates the local
 * database, records an audit log, and sends notifications as appropriate.
 * On failure, the error propagates and the event enters the dead letter queue.
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handleSubscriptionUpdated: QZPayWebhookHandler = async (_c, event) => {
    const deps = getWebhookDependencies();

    if (!deps) {
        apiLogger.warn('Billing not configured, skipping subscription sync');
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
        return undefined;
    }

    const result = await processSubscriptionUpdated({
        event,
        billing: deps.billing,
        paymentAdapter: deps.paymentAdapter,
        providerEventId: String(event.id),
        source: 'webhook'
    });

    if (result.success) {
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    }
    // If !success, the error will propagate and the event handler
    // will mark it as failed + add to dead letter queue

    return undefined;
};
