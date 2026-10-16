import { sendPromoEndingNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Enqueues PLAZO:14 promo-ending notices after the 06:00 next-charge sync (HOS-1589). */
export const billingPromoEndingNoticeJob: CronJobDefinition = {
    name: 'billing-promo-ending-notice',
    description:
        'Enqueue the configurable PLAZO:14 promo-ending notice before the last discounted charge (HOS-1589, AC:B9b:5).',
    schedule: '0 9 * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping promo ending notices');
            return {
                success: true,
                message: 'Dry run - no promo ending notices enqueued',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await sendPromoEndingNotices(
                { limit: 1000 },
                { clock: getClock().clock }
            );
            const processed = summary.enqueued;
            const errors = summary.failed;
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Promo ending notices completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Enqueued ${processed} promo ending notices`,
                processed,
                errors,
                durationMs,
                details: summary
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Promo ending notices failed', { error: message });
            return {
                success: false,
                message: `Promo ending notices failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
