import { expireManualGraces } from '@repo/service-core';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1542 / AC:B5:17: expire unpaid manual grace periods through MP3 and S6. */
export const manualGraceExpiryJob: CronJobDefinition = {
    name: 'manual-grace-expiry',
    description: 'Suspend expired unpaid manual graces (HOS-1542, AC:B5:17)',
    schedule: '43 * * * *',
    enabled: true,
    timeoutMs: 300_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping manual grace expiry');
            return {
                success: true,
                message: 'Dry run - no manual graces expired',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await expireManualGraces(
                { pageSize: 100 },
                { clock: getClock().clock, beforeCancelNotice }
            );
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Manual grace expiry completed', { ...summary, durationMs });
            return {
                success: true,
                message: `Suspended ${summary.suspended} manual graces`,
                processed: summary.suspended,
                errors: summary.errors,
                durationMs,
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Manual grace expiry failed', { error: message });
            return {
                success: false,
                message: `Manual grace expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
