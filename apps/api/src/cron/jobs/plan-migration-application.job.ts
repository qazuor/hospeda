import { runPlanMigrationS37 } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Runs `S37` hourly so a card row's amount mutation lands minutes after its third
 * notice is sent. Minute 28 is free among the Mercado Pago calling jobs and is
 * checked at startup by `mp-cron-stagger.guard.test.ts` (D-11, HOS-1614).
 */
export const planMigrationApplicationJob: CronJobDefinition = {
    name: 'plan-migration-application',
    description:
        'Apply due plan migration rows seven days before their application date (HOS-1614, AC:B12:4-5).',
    schedule: '28 * * * *',
    exclusive: true,
    enabled: true,
    timeoutMs: 240_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        const clock = getClock().clock;
        if (dryRun) {
            logger.info('Dry run mode - skipping plan migration application');
            return {
                success: true,
                message: 'Dry run - no plan migrations applied',
                processed: 0,
                errors: 0,
                durationMs: clock.now().getTime() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runPlanMigrationS37(
                { limit: 500, correlationId: ctx.correlationId },
                { provider: getPaymentProvider(), clock }
            );
            const { rows, failedIds, ...details } = summary;
            if (summary.failed > 0) {
                logger.warn('Plan migration application had failures', {
                    failedIds,
                    escalated: summary.escalated
                });
            }
            if (summary.escalated > 0) {
                logger.warn('Plan migration application escalated undeliverable notices', {
                    escalated: summary.escalated
                });
            }
            return {
                success: summary.failed === 0,
                message: `Processed ${rows.length} plan migration rows`,
                processed: rows.length,
                errors: summary.failed,
                durationMs: clock.now().getTime() - startedAt.getTime(),
                details: { ...details, failedIds }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Plan migration application failed', { error: message });
            return {
                success: false,
                message: `Plan migration application failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: clock.now().getTime() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
