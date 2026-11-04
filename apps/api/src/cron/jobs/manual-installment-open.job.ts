import { planCatalogModel } from '@repo/db';
import { openDueManualInstallments } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts.js';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1541 / AC:B5:13: open due manual installments and apply S4. */
export const manualInstallmentOpenJob: CronJobDefinition = {
    name: 'manual-installment-open',
    description: 'Open due manual installments through MP5 (HOS-1541, AC:B5:13)',
    schedule: '13 * * * *',
    enabled: true,
    timeoutMs: 300_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping manual installment opening');
            return {
                success: true,
                message: 'Dry run - no manual installments opened',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await openDueManualInstallments(
                { pageSize: 100 },
                {
                    clock: getClock().clock,
                    planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
                    billingFacts: getAnalyticsFactSink()
                }
            );
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Manual installment opening completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Opened ${summary.opened} manual installments`,
                processed: summary.opened,
                errors: summary.errors,
                durationMs,
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Manual installment opening failed', { error: message });
            return {
                success: false,
                message: `Manual installment opening failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
