/**
 * Subscription webhook handler for MercadoPago IPN events.
 *
 * Handles BOTH `subscription_preapproval.created` (SPEC-126 D3) and
 * `subscription_preapproval.updated` events by delegating to
 * {@link processSubscriptionUpdated}, which fetches the current MP
 * subscription state, syncs the local DB row, records an audit log,
 * and sends notifications.
 *
 * Why one handler covers both events:
 * The MP `subscription_preapproval.created` event arrives once the user
 * authorizes the recurring charge in the MP-hosted page (MP status flips
 * to `authorized`). qzpay-mercadopago maps MP `authorized` -> qzpay
 * `active`, and `QZPAY_TO_HOSPEDA_STATUS` in `subscription-logic.ts` maps
 * that to `SubscriptionStatusEnum.ACTIVE`. The same status-sync logic
 * that handles subsequent `.updated` events (pause/cancel/etc.) therefore
 * handles the initial `pending_provider`/`incomplete` -> `active`
 * transition out of the box. No separate code path is needed.
 *
 * On failure the error propagates and the event enters the dead letter
 * queue via the upstream `handleWebhookError` callback.
 *
 * @module routes/webhooks/mercadopago/subscription-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { apiLogger } from '../../../utils/logger.js';
import { cleanupRequestProviderEventId } from './event-handler.js';
import { processSubscriptionUpdated } from './subscription-logic.js';
import { getWebhookDependencies, markEventProcessedByProviderId } from './utils.js';

/**
 * Handler for `subscription_preapproval.{created,updated}` events.
 *
 * Fetches current subscription state from MercadoPago, updates the local
 * database, records an audit log, and sends notifications as appropriate.
 * On failure, the error propagates and the event enters the dead letter
 * queue.
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handleSubscriptionPreapprovalEvent: QZPayWebhookHandler = async (c, event) => {
    const deps = getWebhookDependencies();
    const requestId = String(c.get('requestId') || event.id);

    if (!deps) {
        apiLogger.warn('Billing not configured, skipping subscription sync');
        await markEventProcessedByProviderId({ providerEventId: String(event.id) });
        cleanupRequestProviderEventId(requestId);
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
        cleanupRequestProviderEventId(requestId);
    }
    // If !success, the error will propagate and the event handler
    // will mark it as failed + add to dead letter queue

    return undefined;
};

/**
 * Backwards-compatible alias for the existing import name. Pre-SPEC-126
 * code imported `handleSubscriptionUpdated`; new code should prefer
 * {@link handleSubscriptionPreapprovalEvent} which more accurately
 * describes the dual-event responsibility.
 *
 * @deprecated Use {@link handleSubscriptionPreapprovalEvent} instead.
 */
export const handleSubscriptionUpdated = handleSubscriptionPreapprovalEvent;
