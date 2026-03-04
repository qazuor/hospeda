/**
 * Shared dispute/chargeback processing logic.
 *
 * Extracted from dispute-handler.ts to enable reuse in webhook retry job.
 * This module contains no Hono context dependencies and can be called
 * from both webhook handlers and cron jobs.
 *
 * @module routes/webhooks/mercadopago/dispute-logic
 */

import { NotificationType } from '@repo/notifications';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';

/** Input for processing a dispute event */
interface ProcessDisputeEventInput {
    readonly eventData: Record<string, unknown> | undefined;
    readonly eventType: string;
    readonly eventId: string;
}

/**
 * Process a dispute/chargeback event.
 *
 * Logs the dispute at warn level and sends admin notifications.
 * This function is intentionally context-free to support both live
 * webhook processing and dead letter queue retries.
 *
 * @param input - Dispute event data
 * @returns Always resolves to true (disputes are always marked as resolved)
 */
export async function processDisputeEvent({
    eventData,
    eventType,
    eventId
}: ProcessDisputeEventInput): Promise<boolean> {
    apiLogger.warn(
        {
            eventId,
            eventType,
            disputeId: eventData?.id,
            paymentId: eventData?.payment_id ?? eventData?.paymentId,
            status: eventData?.status,
            amount: eventData?.amount ?? eventData?.transaction_amount,
            reason: eventData?.reason
        },
        'Processing dispute/chargeback event. Manual resolution required via MercadoPago Dashboard > Actividad > Disputas.'
    );

    // Send admin notification for disputes
    const adminEmails =
        process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) || [];

    for (const adminEmail of adminEmails) {
        if (adminEmail) {
            const idempotencyKey = `dispute:${eventId}:${new Date().toISOString().slice(0, 10)}`;

            sendNotification({
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                recipientEmail: adminEmail,
                recipientName: 'Admin',
                userId: null,
                severity: 'critical',
                idempotencyKey,
                eventDetails: {
                    eventType,
                    disputeId: eventData?.id,
                    paymentId: eventData?.payment_id ?? eventData?.paymentId,
                    status: eventData?.status,
                    amount: eventData?.amount ?? eventData?.transaction_amount,
                    reason: eventData?.reason
                }
            }).catch((error) => {
                apiLogger.debug(
                    {
                        eventId,
                        adminEmail,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Admin dispute notification failed (will retry)'
                );
            });
        }
    }

    return true;
}
