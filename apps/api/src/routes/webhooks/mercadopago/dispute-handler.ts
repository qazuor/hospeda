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
import { processDisputeEvent } from './dispute-logic';
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
export const handleDisputeOpened: QZPayWebhookHandler = async (_c, event) => {
    const eventData = event.data as Record<string, unknown> | undefined;

    await processDisputeEvent({
        eventData,
        eventType: event.type,
        eventId: String(event.id)
    });

    await markEventProcessedByProviderId({
        providerEventId: String(event.id)
    });

    return undefined;
};
