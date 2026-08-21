/**
 * Generic and error webhook handlers for MercadoPago IPN events.
 *
 * The generic handler persists all incoming events to the database and
 * enforces idempotency. The error handler updates failed events in the
 * database and captures errors in Sentry.
 *
 * @module routes/webhooks/mercadopago/event-handler
 */

import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { billingWebhookEvents, eq, getDb } from '@repo/db';
import { captureWebhookError } from '../../../lib/sentry';
import { apiLogger } from '../../../utils/logger';
import { classifyWebhookError } from './error-classification';
import { markEventFailedByProviderId, markEventProcessedByProviderId } from './utils';

/**
 * Maps requestId to providerEventId for error handling within the same request.
 *
 * Unlike the deprecated module-level webhookEventIds Map, this is used only
 * to pass the providerEventId from onEvent to onError within the same request
 * lifecycle. This is safe in serverless since both handlers execute in the
 * same invocation.
 */
const requestProviderEventIds = new Map<string, string>();

/**
 * Clean up the requestProviderEventIds entry for a given requestId.
 * Must be called after successful webhook processing to prevent memory leaks.
 *
 * @param requestId - The request ID to clean up
 */
export function cleanupRequestProviderEventId(requestId: string): void {
    requestProviderEventIds.delete(requestId);
}

/**
 * Generic event handler for all webhook events.
 *
 * Logs all webhook events for monitoring and debugging.
 * Persists webhook events to database before processing.
 * Implements idempotency to prevent duplicate event processing.
 *
 * Uses optimistic locking approach:
 * 1. Try INSERT first (most common case - new event)
 * 2. On duplicate, SELECT with status check
 * 3. Race condition window is minimized by checking status immediately
 *
 * @param c - Hono context
 * @param event - Parsed QZPay webhook event
 */
export const handleWebhookEvent: QZPayWebhookHandler = async (c, event) => {
    apiLogger.debug(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Event received'
    );

    try {
        // getDb() is used directly here because no BillingWebhookEventService or model
        // exists in @repo/db / @repo/service-core to abstract INSERT + SELECT on
        // billing_webhook_events. The optimistic-insert idempotency pattern requires
        // fine-grained control over the insert/select retry loop that a generic service
        // could not easily expose. withServiceTransaction is not used because the insert
        // and fallback SELECT are logically a single idempotency unit, not a multi-table
        // atomic write.
        const db = getDb();
        const providerEventId = String(event.id);
        const requestId = String(c.get('requestId') || event.id);

        // Optimistic approach: try INSERT first (fastest path for new events)
        try {
            const result = await db
                .insert(billingWebhookEvents)
                .values({
                    provider: 'mercadopago',
                    type: event.type,
                    providerEventId,
                    status: 'pending',
                    payload: event
                })
                .returning();

            const webhookEvent = result[0];

            if (webhookEvent) {
                requestProviderEventIds.set(requestId, providerEventId);

                apiLogger.debug(
                    {
                        webhookEventId: webhookEvent.id,
                        eventId: event.id,
                        eventType: event.type,
                        requestId
                    },
                    'Webhook event persisted to database'
                );
            }

            return undefined; // Continue to processing
        } catch (insertError) {
            // Drizzle wraps DB errors so `error.message` only carries the
            // generic "Failed query: insert into ..." string, not the
            // underlying pg message. The original pg error is preserved
            // on `error.cause` (or directly on the error in older drizzle
            // builds), and the structured `code` field is the only
            // language-agnostic way to detect a unique-violation:
            //   - 23505 = unique_violation (Postgres SQLSTATE)
            // String-matching on the message would falsely miss
            // duplicates whenever the wrapper drops the inner text or the
            // server's lc_messages is non-English.
            const pgCode =
                (insertError as { cause?: { code?: string }; code?: string }).cause?.code ??
                (insertError as { code?: string }).code;
            const isDuplicateError = pgCode === '23505';

            if (!isDuplicateError) {
                throw insertError;
            }

            // Duplicate detected - check existing event status
            let existingEvent: typeof billingWebhookEvents.$inferSelect | null | undefined = null;
            const MAX_STATUS_CHECK_ATTEMPTS = 3;

            for (let attempt = 1; attempt <= MAX_STATUS_CHECK_ATTEMPTS; attempt++) {
                const result = await db
                    .select()
                    .from(billingWebhookEvents)
                    .where(eq(billingWebhookEvents.providerEventId, providerEventId))
                    .limit(1);

                if (result.length > 0) {
                    existingEvent = result[0];
                    break;
                }

                if (attempt < MAX_STATUS_CHECK_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }

            if (!existingEvent) {
                apiLogger.error(
                    {
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook detected but event not found in database - possible race condition'
                );
                throw new Error('Webhook event not found after duplicate detection');
            }

            if (existingEvent.status === 'processed') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook skipped - already processed'
                );

                return c.json(
                    {
                        success: true,
                        message: 'Webhook already processed'
                    },
                    200
                );
            }

            if (existingEvent.status === 'pending') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook skipped - currently being processed'
                );

                return c.json(
                    {
                        success: true,
                        message: 'Webhook currently being processed'
                    },
                    200
                );
            }

            if (existingEvent.status === 'failed') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Reprocessing previously failed webhook event'
                );

                await db
                    .update(billingWebhookEvents)
                    .set({
                        status: 'pending',
                        payload: event,
                        error: null,
                        processedAt: null
                    })
                    .where(eq(billingWebhookEvents.id, existingEvent.id));

                requestProviderEventIds.set(requestId, providerEventId);

                return undefined;
            }
        }
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.id,
                eventType: event.type
            },
            'Failed to persist webhook event to database'
        );
    }

    return undefined; // Continue to default processing
};

/**
 * Error handler for webhook processing failures.
 *
 * Splits the failure into the two answers MercadoPago can act on, using
 * {@link classifyWebhookError} (HOS-707):
 *
 * **Terminal** — the delivery references something the provider says does not
 * exist (or is not ours; MP answers 404 for both). No retry can ever succeed,
 * so we return an explicit `200` and MercadoPago stops. The stored event is
 * marked `processed` rather than `failed`, and nothing is sent to Sentry: this
 * is not a fault of ours, and recording it as one is the same "the log lies
 * about its own severity" defect as HOS-682. Logged at `warn` with the reason
 * and the recovered provider status so the delivery is still traceable.
 *
 * **Retryable** — anything else: a real provider outage, a timeout, a DB
 * hiccup, or an error this handler cannot positively classify. Behaviour is
 * unchanged from before HOS-707 — log at `error`, capture in Sentry, mark the
 * stored event `failed`, and return `undefined`. Returning `undefined` does NOT
 * make the response 200: the `@qazuor/qzpay-hono` router's `onError` falls
 * through to its own default, `response.error(message, 500)`, and MercadoPago
 * retries on its documented backoff schedule. `SubscriptionNotResolvedError`
 * (HOS-276 — a settled charge with no resolvable local subscription) lands here
 * by design: it carries no provider status, so it stays retryable.
 *
 * @param error - The error that occurred during processing
 * @param c - Hono context
 * @returns A `200` acknowledgement for terminal conditions, `undefined` to let
 *   the router answer 500 for retryable ones.
 */
export const handleWebhookError = async (
    error: Error,
    c: Parameters<QZPayWebhookHandler>[0]
): Promise<Response | undefined> => {
    const requestId = String(c.get('requestId'));

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const classification = classifyWebhookError(error);
    const providerEventId = requestProviderEventIds.get(requestId);

    if (classification.disposition === 'terminal') {
        apiLogger.warn(
            {
                error: errorMessage,
                requestId,
                reason: classification.reason,
                providerStatus: classification.providerStatus,
                providerCode: classification.providerCode
            },
            'MercadoPago webhook: nothing to process for this delivery — acknowledging so the provider stops retrying'
        );

        if (providerEventId) {
            await markEventProcessedByProviderId({ providerEventId });
            requestProviderEventIds.delete(requestId);
        }

        // 200, not 4xx: the delivery itself was well-formed and correctly
        // signed — MercadoPago did nothing wrong and has nothing to fix. A 4xx
        // would say "change the request"; there is no request to change. This
        // mirrors the router's `legacy-ipn-duplicate` drop and the
        // already-processed duplicate ack above.
        return c.json({ received: true, ignored: classification.reason }, 200);
    }

    apiLogger.error(
        {
            error: errorMessage,
            stack: errorStack,
            requestId,
            reason: classification.reason,
            providerStatus: classification.providerStatus,
            providerCode: classification.providerCode
        },
        'MercadoPago webhook: Processing failed'
    );

    captureWebhookError(error instanceof Error ? error : new Error(errorMessage), {
        provider: 'mercadopago',
        eventType: 'unknown',
        retryCount: 0
    });

    if (providerEventId) {
        await markEventFailedByProviderId({
            providerEventId,
            errorMessage
        });

        requestProviderEventIds.delete(requestId);
    }

    return undefined; // Falls through to the router's default error response (HTTP 500) — MercadoPago retries
};
