import { runReconciliationSweep } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1602, AC:B11:1: reconcile the owned billing inventory every day. */
export const billingReconciliationSweepJob: CronJobDefinition = {
    name: 'billing-reconciliation-sweep',
    description:
        'Read owned billing inventory by provider id and open marks for divergences (HOS-1602, AC:B11:1)',
    schedule: '0 6 * * *',
    enabled: true,
    timeoutMs: 600_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping billing reconciliation sweep');
            return {
                success: true,
                message: 'Dry run - no billing inventory reconciled',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runReconciliationSweep(
                {},
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock
                }
            );
            const { failures, ...details } = summary;
            return {
                success: summary.rowsFailed === 0,
                message: `Processed ${summary.rowsRead} billing subscriptions`,
                processed: summary.rowsRead,
                errors: summary.rowsFailed,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId)
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Billing reconciliation sweep failed', { error: message });
            return {
                success: false,
                message: `Billing reconciliation sweep failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
