/**
 * Dispute/chargeback webhook handler for MercadoPago IPN events.
 *
 * Handles dispute and chargeback events by logging them at warn level
 * for immediate visibility. Dispute resolution in v1 is a manual process
 * through the MercadoPago dashboard.
 *
 * @remarks
 * ## v1 Manual Process
 *
 * When a dispute/chargeback is opened:
 * 1. A warn-level log entry is created with full event metadata
 * 2. The webhook event is marked as processed in the database
 * 3. An admin must manually handle the dispute via:
 *    - MercadoPago Dashboard > Actividad > Disputas
 *    - Provide required documentation within the deadline (usually 10 days)
 *    - Monitor the dispute status until resolution
 *
 * ## Future Improvements (v2+)
 *
 * - Dispute tracking in local database
 * - Customer communication workflow
 * - Automatic evidence submission via MercadoPago API
 *
 * @module routes/webhooks/mercadopago/dispute-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { NotificationType } from '@repo/notifications';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { markEventProcessedByProviderId } from './utils';

/**
 * Handler for dispute/chargeback events.
 *
 * Logs the dispute at warn level and marks the event as processed.
 * All dispute resolution is manual in v1.
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handleDisputeOpened: QZPayWebhookHandler = async (c, event) => {
    const eventData = event.data as Record<string, unknown> | undefined;

    apiLogger.warn(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId'),
            disputeId: eventData?.id,
            paymentId: eventData?.payment_id ?? eventData?.paymentId,
            status: eventData?.status,
            amount: eventData?.amount ?? eventData?.transaction_amount,
            reason: eventData?.reason
        },
        'MercadoPago webhook: Dispute/chargeback received. Manual resolution required via MercadoPago Dashboard > Actividad > Disputas.'
    );

    // Send admin notification for disputes (BILL-17)
    const adminEmails =
        process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) || [];

    for (const adminEmail of adminEmails) {
        if (adminEmail) {
            const idempotencyKey = `dispute:${event.id}:${new Date().toISOString().slice(0, 10)}`;

            sendNotification({
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                recipientEmail: adminEmail,
                recipientName: 'Admin',
                userId: null,
                severity: 'critical',
                idempotencyKey,
                eventDetails: {
                    eventType: event.type,
                    disputeId: eventData?.id,
                    paymentId: eventData?.payment_id ?? eventData?.paymentId,
                    status: eventData?.status,
                    amount: eventData?.amount ?? eventData?.transaction_amount,
                    reason: eventData?.reason
                }
            }).catch((error) => {
                apiLogger.debug(
                    {
                        eventId: event.id,
                        adminEmail,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Admin dispute notification failed (will retry)'
                );
            });
        }
    }

    await markEventProcessedByProviderId({
        providerEventId: String(event.id)
    });

    return undefined;
};
