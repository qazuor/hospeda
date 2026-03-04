/**
 * Subscription webhook handler for MercadoPago IPN events.
 *
 * Handles subscription_preapproval.updated events. Currently logs the event
 * and marks it as processed without performing business logic. Real subscription
 * state sync is deferred to SPEC-027.
 *
 * @module routes/webhooks/mercadopago/subscription-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { apiLogger } from '../../../utils/logger';
import { markEventProcessedByProviderId } from './utils';

/**
 * Handler for subscription_preapproval.updated events.
 *
 * Logs subscription status changes at warn level for monitoring visibility.
 * Marks the webhook event as processed in the database.
 *
 * @remarks
 * **V1 Limitation:** This handler does NOT sync subscription state from
 * MercadoPago to the local database. It only logs and acknowledges.
 *
 * A full implementation would:
 * 1. Fetch current subscription state from MercadoPago via QZPay
 * 2. Update `billing_subscriptions` with the new status
 * 3. Send notifications for cancellations, suspensions, or reactivations
 * 4. Handle grace periods and entitlement revocation
 *
 * This is tracked in SPEC-027 (Webhook Subscription Sync).
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handleSubscriptionUpdated: QZPayWebhookHandler = async (c, event) => {
    const eventData = event.data as Record<string, unknown> | undefined;

    apiLogger.warn(
        {
            eventId: event.id,
            eventType: event.type,
            status: eventData?.status,
            subscriptionId: eventData?.id,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Subscription updated (not synced - see SPEC-027)'
    );

    await markEventProcessedByProviderId({ providerEventId: String(event.id) });

    return undefined; // Continue to default processing
};
