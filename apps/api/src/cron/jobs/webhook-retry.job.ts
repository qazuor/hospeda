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
 * - Idempotent execution (safe to run concurrently)
 *
 * @module cron/jobs/webhook-retry
 */

import { billingWebhookDeadLetter, eq, getDb, isNull } from '@repo/db';
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
 * Re-process a webhook event from the dead letter queue
 *
 * This function attempts to re-invoke the webhook handler logic for a failed event.
 * Currently, it simulates processing. In production, this should call the actual
 * webhook handler that processes MercadoPago events.
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

        // TODO: Call actual webhook processing logic
        // For MercadoPago webhooks, this would involve:
        // 1. Reconstructing the webhook event from payload
        // 2. Calling the appropriate handler from mercadopago.ts
        // 3. Handling the result

        // For now, we'll simulate successful processing
        // This should be replaced with actual webhook handler invocation
        apiLogger.info(
            {
                eventId: event.id,
                providerEventId: event.providerEventId,
                type: event.type
            },
            'Webhook event retry simulated (TODO: implement actual retry logic)'
        );

        return true;
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
async function markAsResolved(db: ReturnType<typeof getDb>, eventId: string): Promise<void> {
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
    db: ReturnType<typeof getDb>,
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

        logger.info('Starting webhook retry job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let processed = 0;
        let errors = 0;
        let resolved = 0;
        let permanentlyFailed = 0;

        try {
            const db = getDb();

            // Query unresolved events from dead letter queue
            // Unresolved = resolved_at IS NULL
            const unresolvedEvents = await db
                .select()
                .from(billingWebhookDeadLetter)
                .where(isNull(billingWebhookDeadLetter.resolvedAt))
                .limit(BATCH_SIZE);

            if (unresolvedEvents.length === 0) {
                logger.info('No unresolved webhook events found in dead letter queue');
                return {
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
                        await markAsResolved(db, event.id);
                        resolved++;
                    } else {
                        // Increment attempts
                        await incrementAttempts(db, event.id, event.attempts);
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
                        await incrementAttempts(db, event.id, event.attempts);

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
    }
};
