import { applyDueScheduledChanges } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import type { CronJobDefinition } from '../types.js';

/** Applies due subscription plan changes without contacting the payment provider. */
export const subscriptionScheduledChangeJob: CronJobDefinition = {
    name: 'subscription-scheduled-change',
    description: 'Apply due scheduled subscription changes (HOS-1577, AC:B8b:15).',
    schedule: '53 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping scheduled subscription changes');
            return {
                success: true,
                message: 'Dry run - no scheduled change applied',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await applyDueScheduledChanges(
                { limit: 100 },
                { clock: getClock().clock, coverageNotices: getCoverageNotices() }
            );
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Due scheduled changes completed', { summary, durationMs });
            return {
                success: true,
                message: `Applied ${summary.applied} scheduled changes`,
                processed:
                    summary.applied + summary.waiting + summary.notApplicable + summary.failed,
                errors: summary.failed,
                durationMs,
                details: summary
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Due scheduled changes failed', { error: message });
            return {
                success: false,
                message: `Due scheduled changes failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
