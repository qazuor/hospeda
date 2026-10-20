import { runCreationsSweep } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { env } from '../../utils/env.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1610, AC:B11:23: recover unanswered authorization creations and cancel duplicate pending ones. */
export const billingCreationsSweepJob: CronJobDefinition = {
    name: 'billing-creations-sweep',
    description:
        'Recover unanswered subscription creations and cancel duplicates (HOS-1610, AC:B11:23)',
    schedule: '*/5 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping billing creations sweep');
            return {
                success: true,
                message: 'Dry run - no creations swept',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runCreationsSweep(
                { correlationId: ctx.correlationId },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    returnUrl: env.HOSPEDA_SITE_URL
                }
            );
            const { failures, ...details } = summary;
            return {
                success: summary.rowsFailed === 0,
                message: `Examined ${summary.rowsExamined} pending subscription creations`,
                processed: summary.rowsExamined,
                errors: summary.rowsFailed,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId)
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Billing creations sweep failed', { error: message });
            return {
                success: false,
                message: `Billing creations sweep failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
