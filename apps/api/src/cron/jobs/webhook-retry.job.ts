/**
 * Webhook Retry Cron Job
 *
 * Retries failed webhook events from the dead letter queue.
 * Runs hourly to re-attempt processing of failed webhook events.
 *
 * Features:
 * - Finds unresolved events in billing_webhook_dead_letter (resolved_at IS NULL)
 * - Re-attempts webhook processing via webhook handler
 * - Updates status on success (sets resolved_at timestamp)
 * - Increments attempts count on failure
 * - Marks as permanently failed after 5 attempts with admin alert
 * - Processes in batches of 50 to avoid timeouts
 * - Uses pg_try_advisory_lock to prevent concurrent execution across instances
 *
 * @module cron/jobs/webhook-retry
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import { createMercadoPagoAdapter } from '@repo/billing';
import {
    and,
    billingWebhookDeadLetter,
    billingWebhookEvents,
    eq,
    getDb,
    isNull,
    lt,
    sql,
    withTransaction
} from '@repo/db';
import type { DrizzleClient } from '@repo/db';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { processDisputeEvent } from '../../routes/webhooks/mercadopago/dispute-logic.js';
import { processPaymentUpdated } from '../../routes/webhooks/mercadopago/payment-logic.js';
import { processSubscriptionUpdated } from '../../routes/webhooks/mercadopago/subscription-logic.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Maximum number of retry attempts before marking as permanently failed
 */
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Maximum number of events to process per cron run
 */
const BATCH_SIZE = 50;

/**
 * Retry a MercadoPago payment.updated event from the dead letter queue.
 *
 * Delegates to the shared processPaymentUpdated logic extracted from
 * payment-handler.ts, avoiding duplication of business logic.
 *
 * @param payload - The stored event payload from the dead letter queue
 * @returns Promise resolving to true if processing succeeded, false otherwise
 */
async function retryMercadoPagoPaymentUpdated(payload: unknown): Promise<boolean> {
    const billing = getQZPayBilling();

    if (!billing) {
        apiLogger.warn('Billing not configured, skipping payment.updated retry');
        return true;
    }

    const payloadObj =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const eventData = payloadObj?.data;

    if (!eventData || typeof eventData !== 'object') {
        apiLogger.debug('No event data in payload, skipping payment.updated retry');
        return true;
    }

    const data = eventData as Record<string, unknown>;

    const result = await processPaymentUpdated({
        data,
        billing,
        source: 'dead-letter-retry'
    });

    return result.success;
}

/**
 * Retry a subscription_preapproval.updated event from the dead letter queue.
 *
 * Delegates to the shared processSubscriptionUpdated logic, reconstructing
 * a minimal QZPayWebhookEvent from the stored payload.
 *
 * @param payload - The stored event payload from the dead letter queue
 * @param providerEventId - The MercadoPago event ID
 * @returns Promise resolving to true if processing succeeded, false otherwise
 */
async function retrySubscriptionUpdated(
    payload: unknown,
    providerEventId: string
): Promise<boolean> {
    const billing = getQZPayBilling();

    if (!billing) {
        apiLogger.warn('Billing not configured, skipping subscription retry');
        return true;
    }

    let paymentAdapter: ReturnType<typeof createMercadoPagoAdapter>;
    try {
        paymentAdapter = createMercadoPagoAdapter();
    } catch (error) {
        apiLogger.error({ error }, 'Failed to create MercadoPago adapter for subscription retry');
        return false;
    }

    // Reconstruct a minimal QZPayWebhookEvent from the stored payload
    const payloadObj =
        payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;

    if (!payloadObj) {
        apiLogger.debug('No payload in dead letter entry, skipping subscription retry');
        return true;
    }

    const reconstructedEvent: QZPayWebhookEvent = {
        id: providerEventId,
        type: 'subscription_preapproval.updated',
        data: (payloadObj.data as Record<string, unknown>) ?? payloadObj,
        created: new Date((payloadObj.date_created as string) ?? Date.now())
    };

    const result = await processSubscriptionUpdated({
        event: reconstructedEvent,
        billing,
        paymentAdapter,
        providerEventId,
        source: 'dead-letter-retry'
    });

    return result.success;
}

/**
 * Re-process a webhook event from the dead letter queue.
 *
 * Routes the retry to the appropriate provider-specific handler based on
 * `event.provider` and `event.type`. The payload is already trusted (sourced
 * from the dead letter queue) so signature verification is skipped.
 *
 * Idempotency for MercadoPago is handled by QZPay at the `billingWebhookEvents`
 * level. If the event was already processed, the handler returns true without
 * re-processing business logic.
 *
 * Supported providers:
 * - `mercadopago` — routes to per-type business logic
 *
 * @param event - Dead letter event to retry
 * @returns Promise resolving to true if processing succeeded, false otherwise
 */
async function retryWebhookEvent(event: {
    id: string;
    providerEventId: string;
    provider: string;
    type: string;
    payload: unknown;
    attempts: number;
}): Promise<boolean> {
    try {
        apiLogger.debug(
            {
                eventId: event.id,
                providerEventId: event.providerEventId,
                provider: event.provider,
                type: event.type,
                attempts: event.attempts
            },
            'Retrying webhook event from dead letter queue'
        );

        if (event.provider !== 'mercadopago') {
            apiLogger.warn(
                { provider: event.provider, eventId: event.id },
                'Unknown webhook provider in dead letter queue - marking as resolved'
            );
            return true;
        }

        // Check if the corresponding billingWebhookEvents entry already processed
        const db = getDb();
        const existingRows = await db
            .select({ status: billingWebhookEvents.status })
            .from(billingWebhookEvents)
            .where(eq(billingWebhookEvents.providerEventId, event.providerEventId))
            .limit(1);

        const existing = existingRows[0];

        if (existing?.status === 'processed') {
            apiLogger.info(
                { eventId: event.id, providerEventId: event.providerEventId },
                'Webhook event already processed in billingWebhookEvents - resolving dead letter'
            );
            return true;
        }

        // Route to appropriate handler by event type
        switch (event.type) {
            case 'payment.updated': {
                return await retryMercadoPagoPaymentUpdated(event.payload);
            }

            case 'chargebacks':
            case 'payment.dispute': {
                const disputePayload =
                    event.payload && typeof event.payload === 'object'
                        ? (event.payload as Record<string, unknown>)
                        : null;
                const disputeData = disputePayload?.data as Record<string, unknown> | undefined;

                return await processDisputeEvent({
                    eventData: disputeData,
                    eventType: event.type,
                    eventId: event.id
                });
            }

            case 'payment.created': {
                // payment.created has no custom business logic beyond persistence.
                apiLogger.info(
                    { eventId: event.id, type: event.type },
                    'No business logic to retry for event type - resolving dead letter'
                );
                return true;
            }

            case 'subscription_preapproval.updated': {
                return await retrySubscriptionUpdated(event.payload, event.providerEventId);
            }

            default: {
                apiLogger.warn(
                    { eventId: event.id, type: event.type, provider: event.provider },
                    'Unrecognized MercadoPago event type in dead letter queue - resolving'
                );
                return true;
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            {
                eventId: event.id,
                providerEventId: event.providerEventId,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            },
            'Failed to retry webhook event'
        );

        return false;
    }
}

/**
 * Mark webhook event as resolved
 *
 * Updates the dead letter record to indicate successful processing.
 *
 * @param db - Database instance
 * @param eventId - Dead letter event ID
 */
async function markAsResolved(db: DrizzleClient, eventId: string): Promise<void> {
    await db
        .update(billingWebhookDeadLetter)
        .set({
            resolvedAt: new Date()
        })
        .where(eq(billingWebhookDeadLetter.id, eventId));

    apiLogger.info({ eventId }, 'Marked webhook event as resolved');
}

/**
 * Increment retry attempt count for webhook event
 *
 * Updates the attempts counter and optionally marks as permanently failed
 * if max attempts have been reached.
 *
 * @param db - Database instance
 * @param eventId - Dead letter event ID
 * @param currentAttempts - Current number of attempts
 */
async function incrementAttempts(
    db: DrizzleClient,
    eventId: string,
    currentAttempts: number
): Promise<void> {
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_RETRY_ATTEMPTS) {
        // Mark as permanently failed by setting resolved_at with error flag
        await db
            .update(billingWebhookDeadLetter)
            .set({
                attempts: newAttempts,
                error: `Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`,
                resolvedAt: new Date() // Mark as "resolved" (failed permanently)
            })
            .where(eq(billingWebhookDeadLetter.id, eventId));

        apiLogger.error(
            {
                eventId,
                attempts: newAttempts
            },
            `🚨 ADMIN ALERT: Webhook event permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`
        );
    } else {
        await db
            .update(billingWebhookDeadLetter)
            .set({
                attempts: newAttempts
            })
            .where(eq(billingWebhookDeadLetter.id, eventId));

        apiLogger.debug({ eventId, attempts: newAttempts }, 'Incremented webhook retry attempts');
    }
}

/**
 * Discriminated union returned by the withTransaction callback in the cron handler.
 * Allows the outer handler to distinguish lock-skip from real execution results.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

/**
 * Webhook retry cron job definition
 *
 * Schedule: Hourly at the top of each hour
 * Purpose: Retry failed webhook events from dead letter queue
 */
export const webhookRetryJob: CronJobDefinition = {
    name: 'webhook-retry',
    description: 'Retries failed webhook events from dead letter queue',
    schedule: '0 */1 * * *', // Every hour on the hour
    enabled: true,
    timeoutMs: 300000, // 5 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        let processed = 0;
        let errors = 0;
        let resolved = 0;
        let permanentlyFailed = 0;

        try {
            // Prevent overlapping cron executions via PostgreSQL advisory lock (GAP-009).
            // Lock key 1001 is reserved for this job. Uses pg_try_advisory_xact_lock
            // (transaction-level) instead of pg_try_advisory_lock (session-level) for
            // compatibility with Neon's transaction pooling (PgBouncer). Transaction-level
            // locks auto-release on commit/rollback — no manual unlock needed.
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(1001) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting webhook retry job', {
                    dryRun,
                    startedAt: startedAt.toISOString()
                });

                // Query unresolved events from dead letter queue
                // Unresolved = resolved_at IS NULL
                const unresolvedEvents = await tx
                    .select()
                    .from(billingWebhookDeadLetter)
                    .where(
                        and(
                            isNull(billingWebhookDeadLetter.resolvedAt),
                            lt(billingWebhookDeadLetter.attempts, MAX_RETRY_ATTEMPTS)
                        )
                    )
                    .limit(BATCH_SIZE);

                if (unresolvedEvents.length === 0) {
                    logger.info('No unresolved webhook events found in dead letter queue');
                    return {
                        skipped: false,
                        success: true,
                        message: 'No unresolved webhook events to retry',
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }

                logger.info('Found unresolved webhook events to retry', {
                    count: unresolvedEvents.length,
                    batchSize: BATCH_SIZE
                });

                if (dryRun) {
                    // Dry run mode - count events that would be retried
                    logger.info('Running in dry-run mode');

                    for (const event of unresolvedEvents) {
                        logger.debug('Would retry webhook event', {
                            eventId: event.id,
                            providerEventId: event.providerEventId,
                            provider: event.provider,
                            type: event.type,
                            attempts: event.attempts
                        });
                    }

                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run - Would retry ${unresolvedEvents.length} webhook events`,
                        processed: unresolvedEvents.length,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime(),
                        details: {
                            dryRun: true,
                            totalEvents: unresolvedEvents.length
                        }
                    };
                }

                // Production mode - actually retry the events
                logger.info('Running in production mode - retrying webhook events');

                // Process each event individually
                // Don't let one failure stop processing others
                for (const event of unresolvedEvents) {
                    try {
                        processed++;

                        // Attempt to retry the webhook
                        const success = await retryWebhookEvent({
                            id: event.id,
                            providerEventId: event.providerEventId,
                            provider: event.provider,
                            type: event.type,
                            payload: event.payload,
                            attempts: event.attempts
                        });

                        if (success) {
                            // Mark as resolved
                            await markAsResolved(tx, event.id);
                            resolved++;
                        } else {
                            // Increment attempts
                            await incrementAttempts(tx, event.id, event.attempts);
                            errors++;

                            // Check if permanently failed
                            if (event.attempts + 1 >= MAX_RETRY_ATTEMPTS) {
                                permanentlyFailed++;
                            }
                        }
                    } catch (error) {
                        // Error handling for individual event processing
                        errors++;

                        const errorMessage = error instanceof Error ? error.message : String(error);

                        logger.error('Error processing webhook event retry', {
                            eventId: event.id,
                            providerEventId: event.providerEventId,
                            error: errorMessage,
                            stack: error instanceof Error ? error.stack : undefined
                        });

                        // Still increment attempts even if processing threw an error
                        try {
                            await incrementAttempts(tx, event.id, event.attempts);

                            if (event.attempts + 1 >= MAX_RETRY_ATTEMPTS) {
                                permanentlyFailed++;
                            }
                        } catch (updateError) {
                            logger.error('Failed to update webhook event attempts after error', {
                                eventId: event.id,
                                error:
                                    updateError instanceof Error
                                        ? updateError.message
                                        : String(updateError)
                            });
                        }
                    }
                }

                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Webhook retry job completed', {
                    processed,
                    resolved,
                    errors,
                    permanentlyFailed,
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: `Processed ${processed} webhook events: ${resolved} resolved, ${errors} failed, ${permanentlyFailed} permanently failed`,
                    processed,
                    errors,
                    durationMs,
                    details: {
                        resolved,
                        permanentlyFailed,
                        remaining: unresolvedEvents.length - processed
                    }
                };
                // End of withTransaction callback — lock auto-releases on commit
            });

            // Handle lock-not-acquired case from inside the transaction
            if (cronResult.skipped) {
                logger.warn(
                    'webhook-retry cron: skipping — previous run still holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped — another instance is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                ...(cronResult.details ? { details: cronResult.details } : {})
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Webhook retry job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to retry webhook events: ${errorMessage}`,
                processed,
                errors: errors + 1,
                durationMs,
                details: {
                    error: errorMessage,
                    resolved,
                    permanentlyFailed
                }
            };
        }
        // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
        // transaction commit/rollback. The lock was scoped to the withTransaction call above.
    }
};
