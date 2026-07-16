/**
 * Trial Reconciliation Cron Job
 *
 * Settles trials whose window has elapsed against the payment provider.
 * Runs daily at 2 AM.
 *
 * ⚠️ This job CONVERTS elapsed trials; it does NOT expire or cancel them
 * (HOS-171). Under card-first trials the customer authorized a card on day 1
 * and MercadoPago charges automatically at day N, so an elapsed trial is a
 * customer who is about to pay — or already has. The provider's status, not
 * our clock, decides each outcome. See `TrialService.reconcileExpiredTrials`
 * for the full rationale and the decision table.
 *
 * Features:
 * - Finds local subscriptions with status='trialing' where trial_end < now()
 * - Re-reads each preapproval from MercadoPago and mirrors its verdict:
 *   active → converted, past_due → dunning owns it, cancelled/paused → mirrored
 * - Processes in bounded batches, draining the backlog over successive runs
 * - Writes a TRIAL_RECONCILED event per subscription for audit + idempotency
 *
 * @module cron/jobs/trial-expiry
 */

import { createMercadoPagoAdapter } from '@repo/billing';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { TrialService } from '../../services/trial.service.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Trial reconciliation cron job definition
 *
 * Schedule: Daily at 2 AM (0 2 * * *)
 * Purpose: Settle elapsed trials against the provider (convert, or mirror its status)
 */
export const trialExpiryJob: CronJobDefinition = {
    name: 'trial-reconcile',
    description: 'Reconcile elapsed trials against the payment provider (converts, never cancels)',
    schedule: '0 2 * * *', // Daily at 2 AM
    enabled: true,
    timeoutMs: 300000, // 5 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting trial reconciliation', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let processed = 0;
        let errors = 0;

        try {
            // Get billing instance
            const billing = getQZPayBilling();

            if (!billing) {
                logger.warn('Billing not configured, skipping trial reconciliation');
                return {
                    success: true,
                    message: 'Skipped - Billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // Reconciliation sends no email: a converting customer was already
            // warned by TRIAL_ENDING_REMINDER before the charge, and a failed
            // charge is the dunning cron's story to tell. TrialService therefore
            // no longer takes a notification sender.
            const trialService = new TrialService(billing);

            if (dryRun) {
                // Dry run mode - count how many trials would be expired
                logger.info('Running in dry-run mode');

                // Get all trialing subscriptions using pagination
                const allSubscriptionsResult = await billing.subscriptions.list({
                    filters: { status: 'trialing' }
                });

                if (!allSubscriptionsResult?.data || allSubscriptionsResult.data.length === 0) {
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
                let elapsedCount = 0;

                // Filter for trialing subscriptions
                for (const subscription of allSubscriptionsResult.data) {
                    // Skip if not trialing
                    if (subscription.status !== 'trialing') {
                        continue;
                    }

                    const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                    if (trialEnd && now > trialEnd) {
                        elapsedCount++;
                        logger.debug('Would reconcile elapsed trial subscription', {
                            subscriptionId: subscription.id,
                            customerId: subscription.customerId,
                            trialEnd: trialEnd.toISOString()
                        });
                    }
                }

                return {
                    success: true,
                    message: `Dry run - Would reconcile ${elapsedCount} elapsed trial subscriptions`,
                    processed: elapsedCount,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: {
                        dryRun: true,
                        totalSubscriptions: allSubscriptionsResult.data.length
                    }
                };
            }

            // Production mode - reconcile against the provider
            logger.info('Running in production mode - reconciling elapsed trials');

            // The cron builds its own MP adapter (same pattern as
            // subscription-poll.job.ts / webhook-retry.job.ts): qzpay-core's
            // getPaymentAdapter() returns the generic adapter interface, and
            // reconciliation needs the MercadoPago-typed subscriptions.retrieve().
            const paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });

            const reconciledCount = await trialService.reconcileExpiredTrials({ paymentAdapter });

            processed = reconciledCount;

            logger.info('Trial reconciliation completed', {
                reconciledCount,
                durationMs: Date.now() - startedAt.getTime()
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: true,
                message: `Successfully reconciled ${reconciledCount} elapsed trial subscriptions`,
                processed,
                errors,
                durationMs,
                details: {
                    reconciledCount
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            // SPEC-180: trial reconciliation failure is actionable — forward to Sentry.
            logger.error(
                'Trial reconciliation failed',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to reconcile elapsed trials: ${errorMessage}`,
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
