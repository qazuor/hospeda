/**
 * Trial Expiry Cron Job
 *
 * Checks for expired trial subscriptions and updates their status.
 * Runs daily at 2 AM to process trials that have passed their end date.
 *
 * Features:
 * - Finds all subscriptions with status='trialing' where trial_end_date <= now()
 * - Updates expired trials to 'expired' status
 * - Processes in batches of 100 to avoid memory issues
 * - Logs all expiry actions for audit trail
 *
 * @module cron/jobs/trial-expiry
 */

import { getQZPayBilling } from '../../middlewares/billing.js';
import { TrialService } from '../../services/trial.service.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Trial expiry cron job definition
 *
 * Schedule: Daily at 2 AM (0 2 * * *)
 * Purpose: Automatically expire trials that have passed their end date
 */
export const trialExpiryJob: CronJobDefinition = {
    name: 'trial-expiry',
    description: 'Check and expire trials that have passed their end date',
    schedule: '0 2 * * *', // Daily at 2 AM
    enabled: true,
    timeoutMs: 300000, // 5 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting trial expiry check', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let processed = 0;
        let errors = 0;

        try {
            // Get billing instance
            const billing = getQZPayBilling();

            if (!billing) {
                logger.warn('Billing not configured, skipping trial expiry check');
                return {
                    success: true,
                    message: 'Skipped - Billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // Create trial service
            const trialService = new TrialService(billing);

            if (dryRun) {
                // Dry run mode - count how many trials would be expired
                logger.info('Running in dry-run mode');

                // Get all trialing subscriptions using pagination
                const allSubscriptionsResult = await billing.subscriptions.list({
                    filters: { status: 'trialing' }
                });

                if (
                    !allSubscriptionsResult ||
                    !allSubscriptionsResult.data ||
                    allSubscriptionsResult.data.length === 0
                ) {
                    logger.info('No subscriptions found');
                    return {
                        success: true,
                        message: 'Dry run - No subscriptions found',
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }

                const now = new Date();
                let expiredCount = 0;

                // Filter for trialing subscriptions
                for (const subscription of allSubscriptionsResult.data) {
                    // Skip if not trialing
                    if (subscription.status !== 'trialing') {
                        continue;
                    }

                    const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                    if (trialEnd && now > trialEnd) {
                        expiredCount++;
                        logger.debug('Would expire trial subscription', {
                            subscriptionId: subscription.id,
                            customerId: subscription.customerId,
                            trialEnd: trialEnd.toISOString()
                        });
                    }
                }

                return {
                    success: true,
                    message: `Dry run - Would expire ${expiredCount} trial subscriptions`,
                    processed: expiredCount,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: {
                        dryRun: true,
                        totalSubscriptions: allSubscriptionsResult.data.length
                    }
                };
            }

            // Production mode - actually expire the trials
            logger.info('Running in production mode - expiring trials');

            const blockedCount = await trialService.blockExpiredTrials();

            processed = blockedCount;

            logger.info('Trial expiry check completed', {
                blockedCount,
                durationMs: Date.now() - startedAt.getTime()
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: true,
                message: `Successfully expired ${blockedCount} trial subscriptions`,
                processed,
                errors,
                durationMs,
                details: {
                    blockedCount
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('Trial expiry check failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to check expired trials: ${errorMessage}`,
                processed,
                errors,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        }
    }
};
