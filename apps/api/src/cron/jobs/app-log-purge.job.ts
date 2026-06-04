/**
 * App Log Purge Job (SPEC-184)
 *
 * Periodically deletes old `app_log_entries` records via
 * {@link AppLogEntryService.purgeOld}, keeping the log observability table
 * bounded. Runs daily at 5:00 UTC (one hour after cron-run-purge).
 *
 * Retention policy: uniform 30 days for both WARN and ERROR entries.
 *
 * @module cron/jobs/app-log-purge
 */

import { AppLogEntryService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Keep log entries this many days. */
const RETENTION_DAYS = 30;

/**
 * App log purge job definition.
 *
 * Schedule: Daily at 5:00 UTC.
 * Purpose: Prevent unbounded growth of the app_log_entries observability table.
 */
export const appLogPurgeJob: CronJobDefinition = {
    name: 'app-log-purge',
    description: 'Purge app_log_entries older than 30 days (WARN/ERROR only)',
    schedule: '0 5 * * *', // Daily at 5:00 UTC
    enabled: true,
    timeoutMs: 60_000, // 1 minute timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting app log purge job', {
            dryRun,
            retentionDays: RETENTION_DAYS,
            startedAt: startedAt.toISOString()
        });

        if (dryRun) {
            logger.info('Dry run mode - skipping actual purge');
            return {
                success: true,
                message: 'Dry run - no records purged',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            const service = new AppLogEntryService({ logger: apiLogger });
            const deleted = await service.purgeOld({ retentionDays: RETENTION_DAYS });

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('App log purge job completed', { deleted, durationMs });

            return {
                success: true,
                message: `Purged ${deleted} old app log entries`,
                processed: deleted,
                errors: 0,
                durationMs,
                details: {
                    deleted,
                    retentionDays: RETENTION_DAYS
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('App log purge job failed', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `App log purge failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
