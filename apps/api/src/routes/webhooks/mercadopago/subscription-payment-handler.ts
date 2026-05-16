/**
 * Subscription Recurring Payment Webhook Handler (SPEC-126 D4)
 *
 * Handles MercadoPago `subscription_authorized_payment.{created,updated}`
 * events — the IPN notifications MP fires when a recurring monthly charge
 * is scheduled / executed against an active preapproval (subscription).
 *
 * Scope (intentionally narrow):
 * - Acknowledges the event so MP stops retrying.
 * - Logs the authorized-payment ID + raw payload status for ops
 *   observability.
 * - Marks the webhook event row as processed (idempotency dedup).
 *
 * Deferred to a post-SPEC-126 follow-up (same gap pattern as D1 annual):
 * - Fetching the full authorized-payment object from MP (the IPN payload
 *   carries only the authorized-payment ID, not the linked
 *   `preapproval_id` / `transaction_amount` / `payment.id`). qzpay-core
 *   does not expose a public helper for `/authorized_payments/:id`, so
 *   pulling full details would require dropping to the raw MercadoPago
 *   SDK — same architectural gap that pushed D1 annual to a follow-up.
 * - Inserting a row in `billing_payments` for the recurring charge.
 * - Recovering a `past_due` subscription back to `active` when a retry
 *   succeeds (this happens upstream via the regular
 *   `subscription_preapproval.updated` event, so the gap is bounded).
 *
 * @module routes/webhooks/mercadopago/subscription-payment-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { apiLogger } from '../../../utils/logger.js';
import { cleanupRequestProviderEventId } from './event-handler.js';
import { markEventProcessedByProviderId } from './utils.js';

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
 * Handler for `subscription_authorized_payment.{created,updated}` events.
 *
 * MP fires `.created` when a recurring charge enters the system (status
 * `scheduled` / `processed` / `recycling` / `cancelled`) and `.updated`
 * on state transitions. The two events share the same payload shape, so
 * one handler covers both.
 *
 * Errors are intentionally swallowed (logged, not re-thrown) because a
 * single noisy event must not block the webhook bucket. The event is
 * still marked processed so MP stops retrying.
 */
export const handleSubscriptionAuthorizedPayment: QZPayWebhookHandler = async (c, event) => {
    const requestId = String(c.get('requestId') || event.id);

    const authorizedPaymentId = extractAuthorizedPaymentId(event);

    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId,
            authorizedPaymentId
        },
        'MercadoPago webhook: subscription_authorized_payment event received (acknowledge-only; full payment record deferred to follow-up)'
    );

    try {
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
    } catch (markErr) {
        // Non-blocking: failure to mark the event processed just means MP
        // will retry the same event later; the handler stays idempotent
        // because the next run hits the same code path and re-logs.
        apiLogger.warn(
            {
                eventId: event.id,
                error: markErr instanceof Error ? markErr.message : String(markErr)
            },
            'Failed to mark subscription_authorized_payment event as processed'
        );
    }

    cleanupRequestProviderEventId(requestId);
    return undefined;
};

/**
 * Exported for unit tests so the helper can be exercised without
 * spinning up a full Hono context.
 */
export const _internals = {
    extractAuthorizedPaymentId
};
