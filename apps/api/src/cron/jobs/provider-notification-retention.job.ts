import { purgeProviderNotifications } from '@repo/service-core';
import { getClock } from '../../utils/clock.js';
import type { CronJobDefinition } from '../types.js';

/** Removes provider delivery records beyond the technical retention window. */
export const providerNotificationRetentionJob: CronJobDefinition = {
    name: 'provider-notification-retention',
    description: 'Purge provider delivery log entries beyond the retention window.',
    schedule: '30 3 * * *',
    enabled: true,
    timeoutMs: 60_000,
    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping provider delivery retention');
            return {
                success: true,
                message: 'Dry run',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const { deleted } = await purgeProviderNotifications({}, { clock: getClock().clock });
            return {
                success: true,
                message: `Deleted ${deleted} provider delivery records`,
                processed: deleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Provider delivery retention failed', { error: message });
            return {
                success: false,
                message: `Provider delivery retention failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
