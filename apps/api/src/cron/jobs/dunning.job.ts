/**
 * Dunning Cron Job
 *
 * Processes payment retries and grace period expirations for past-due subscriptions.
 * Runs daily at 6:00 AM UTC (3:00 AM Argentina time) to manage the full dunning
 * lifecycle: retries on failed payments and cancellations after grace period ends.
 *
 * Features:
 * - Uses QZPay's SubscriptionLifecycleService to process payment retries
 * - Cancels subscriptions that have exceeded the grace period with no remaining retries
 * - Retry schedule: [1, 3, 5, 7] days between attempts (4 max attempts).
 *   NOTE: The original spec (SPEC-021 BILL-04) proposed [1, 3, 7] (3 attempts).
 *   The implemented schedule adds a Day 5 attempt to maximize payment recovery
 *   before cancellation. This was a deliberate product decision to be more aggressive
 *   on retries given Argentine payment ecosystem transient failures.
 * - Grace period: 7 days from first payment failure before cancellation
 * - Supports dry-run mode to preview actions without making changes
 * - Emits lifecycle events: retry_scheduled, retry_succeeded, retry_failed, canceled_nonpayment
 *
 * @module cron/jobs/dunning
 */

import { createSubscriptionLifecycle } from '@qazuor/qzpay-core';
import type { LifecycleEvent, QZPayCurrency } from '@qazuor/qzpay-core';
import { DUNNING_GRACE_PERIOD_DAYS, DUNNING_RETRY_INTERVALS } from '@repo/billing';
import { billingDunningAttempts, getDb } from '@repo/db';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Record a dunning attempt in the billing_dunning_attempts table for auditing.
 * Best-effort: logs errors but does not throw to avoid disrupting the dunning flow.
 */
async function recordDunningAttempt(event: LifecycleEvent): Promise<void> {
    const isRetryEvent =
        event.type === 'subscription.retry_succeeded' || event.type === 'subscription.retry_failed';

    if (!isRetryEvent) {
        return;
    }

    try {
        const db = getDb();
        const data = event.data as Record<string, unknown>;

        const result = event.type === 'subscription.retry_succeeded' ? 'success' : 'failed';

        await db.insert(billingDunningAttempts).values({
            subscriptionId: event.subscriptionId,
            customerId: event.customerId,
            attemptNumber: (data.attemptNumber as number) ?? 0,
            result,
            amount: (data.amount as number) ?? undefined,
            currency: (data.currency as string) ?? undefined,
            paymentId: (data.paymentId as string) ?? undefined,
            failureCode: (data.failureCode as string) ?? undefined,
            errorMessage: (data.error as string) ?? undefined,
            provider: (data.provider as string) ?? 'mercadopago',
            metadata: {
                eventType: event.type,
                ...(typeof data === 'object' ? data : {})
            },
            attemptedAt: event.timestamp
        });
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId: event.subscriptionId,
                eventType: event.type,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to record dunning attempt (non-blocking)'
        );
    }
}

/**
 * Number of days after payment failure when retry attempts are made.
 * Schedule: Day 1, Day 3, Day 5, Day 7 (4 attempts total).
 *
 * Intentionally more aggressive than the SPEC-021 proposal of [1, 3, 7]
 * to maximize recovery rate in the Argentine payment ecosystem where
 * transient bank/card failures are common.
 */
/** Local alias for dunning retry intervals from @repo/billing */
const RETRY_INTERVALS: readonly number[] = DUNNING_RETRY_INTERVALS;

/**
 * Maximum number of retry attempts before cancellation.
 */
const MAX_RETRY_ATTEMPTS = RETRY_INTERVALS.length;

/** Local alias for dunning grace period from @repo/billing */
const GRACE_PERIOD_DAYS = DUNNING_GRACE_PERIOD_DAYS;

/**
 * Dunning cron job definition.
 *
 * Schedule: Daily at 6:00 AM UTC (0 6 * * *)
 * Purpose: Retry failed subscription payments and cancel subscriptions
 *          that have exhausted all retry attempts and exceeded the grace period.
 */
export const dunningJob: CronJobDefinition = {
    name: 'dunning',
    description:
        'Retry failed subscription payments and cancel past-due subscriptions after grace period',
    schedule: '0 6 * * *', // Daily at 6:00 AM UTC
    enabled: true,
    timeoutMs: 300000, // 5 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting dunning job', {
            dryRun,
            startedAt: startedAt.toISOString(),
            retryIntervals: RETRY_INTERVALS,
            maxRetryAttempts: MAX_RETRY_ATTEMPTS,
            gracePeriodDays: GRACE_PERIOD_DAYS
        });

        try {
            // Resolve the QZPay billing instance
            const billing = getQZPayBilling();

            if (!billing) {
                logger.warn('Billing not configured, skipping dunning job');
                return {
                    success: true,
                    message: 'Skipped - Billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // Get the storage adapter from the billing instance
            const storage = billing.getStorage();

            // Build the subscription lifecycle service with Hospeda's dunning config
            const lifecycle = createSubscriptionLifecycle(billing, storage, {
                gracePeriodDays: GRACE_PERIOD_DAYS,
                retryIntervals: [...RETRY_INTERVALS],
                trialConversionDays: 0,

                /**
                 * Process a payment by delegating to QZPay billing's payment layer.
                 * The billing instance already has the MercadoPago adapter wired in,
                 * so we use billing.payments.process() which routes through the adapter.
                 */
                processPayment: async (input) => {
                    try {
                        const payment = await billing.payments.process({
                            customerId: input.customerId,
                            amount: input.amount,
                            currency: input.currency as QZPayCurrency,
                            paymentMethodId: input.paymentMethodId,
                            subscriptionId: input.metadata.subscriptionId,
                            metadata: {
                                type: input.metadata.type
                            }
                        });

                        return {
                            success: payment.status === 'succeeded',
                            paymentId: payment.id,
                            error:
                                payment.status !== 'succeeded'
                                    ? `Payment ${payment.status}`
                                    : undefined
                        };
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        apiLogger.error(
                            { customerId: input.customerId, error: errorMessage },
                            'Dunning payment attempt failed'
                        );
                        return { success: false, error: errorMessage };
                    }
                },

                /**
                 * Retrieve the customer's default saved payment method from storage.
                 * Returns null if no default method is configured, which causes the
                 * lifecycle service to skip the retry for that subscription.
                 */
                getDefaultPaymentMethod: async (customerId) => {
                    const paymentMethod =
                        await storage.paymentMethods.findDefaultByCustomerId(customerId);

                    if (!paymentMethod) {
                        return null;
                    }

                    // Use the first available provider payment method ID
                    const providerPaymentMethodId = Object.values(
                        paymentMethod.providerPaymentMethodIds
                    )[0];

                    if (!providerPaymentMethodId) {
                        return null;
                    }

                    return {
                        id: paymentMethod.id,
                        providerPaymentMethodId
                    };
                },

                /**
                 * Lifecycle event handler for observability, debugging, and audit logging.
                 * Logs each event at the appropriate level and records retry attempts
                 * in the billing_dunning_attempts table for auditing.
                 */
                onEvent: async (event) => {
                    const logData = {
                        subscriptionId: event.subscriptionId,
                        customerId: event.customerId,
                        eventType: event.type,
                        ...event.data
                    };

                    switch (event.type) {
                        case 'subscription.retry_succeeded':
                            apiLogger.info(logData, 'Dunning: payment retry succeeded');
                            break;
                        case 'subscription.canceled_nonpayment':
                            apiLogger.warn(
                                logData,
                                'Dunning: subscription canceled due to non-payment'
                            );
                            break;
                        case 'subscription.retry_failed':
                            apiLogger.warn(logData, 'Dunning: payment retry failed');
                            break;
                        case 'subscription.retry_scheduled':
                            apiLogger.info(logData, 'Dunning: next retry scheduled');
                            break;
                        default:
                            apiLogger.debug(logData, `Dunning lifecycle event: ${event.type}`);
                    }

                    // Record retry attempts in the audit table (best-effort)
                    await recordDunningAttempt(event);
                }
            });

            if (dryRun) {
                // Dry-run: load all past-due subscriptions to report counts without mutating
                logger.info('Running in dry-run mode - loading past-due subscriptions');

                const allSubscriptions = await billing.subscriptions.list();
                const pastDue = (allSubscriptions?.data ?? []).filter(
                    (sub) => sub.status === 'past_due'
                );

                logger.info('Dry run complete - would process past-due subscriptions', {
                    pastDueCount: pastDue.length,
                    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
                    gracePeriodDays: GRACE_PERIOD_DAYS
                });

                return {
                    success: true,
                    message: `Dry run - Would process ${pastDue.length} past-due subscriptions`,
                    processed: pastDue.length,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: {
                        dryRun: true,
                        pastDueCount: pastDue.length,
                        retryIntervals: RETRY_INTERVALS,
                        gracePeriodDays: GRACE_PERIOD_DAYS
                    }
                };
            }

            // Production mode: run payment retries and grace period cancellations
            logger.info(
                'Running in production mode - processing payment retries and cancellations'
            );

            // Run retries BEFORE cancellations to avoid a race where a subscription
            // could be picked up by both processes simultaneously.
            const retriesResult = await lifecycle.processRetries();
            const cancellationsResult = await lifecycle.processCancellations();

            const totalProcessed = retriesResult.processed + cancellationsResult.processed;
            const cancellationsFailed =
                'failed' in cancellationsResult ? (cancellationsResult.failed as number) : 0;
            const totalErrors = retriesResult.failed + cancellationsFailed;
            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Dunning job completed', {
                retries: {
                    processed: retriesResult.processed,
                    succeeded: retriesResult.succeeded,
                    failed: retriesResult.failed
                },
                cancellations: {
                    processed: cancellationsResult.processed
                },
                durationMs
            });

            return {
                success: true,
                message: [
                    `Retries: ${retriesResult.succeeded}/${retriesResult.processed} succeeded`,
                    `Cancellations: ${cancellationsResult.processed} processed`
                ].join('. '),
                processed: totalProcessed,
                errors: totalErrors,
                durationMs,
                details: {
                    retries: {
                        processed: retriesResult.processed,
                        succeeded: retriesResult.succeeded,
                        failed: retriesResult.failed,
                        details: retriesResult.details
                    },
                    cancellations: {
                        processed: cancellationsResult.processed,
                        details: cancellationsResult.details
                    }
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Dunning job failed with unexpected error', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Dunning job failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        }
    }
};
