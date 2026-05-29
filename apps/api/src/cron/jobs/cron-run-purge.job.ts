/**
 * Cron Run Purge Job (SPEC-161)
 *
 * Periodically deletes old `cron_runs` records via {@link CronRunService.purgeOld},
 * keeping the run-history table bounded. Runs daily at 4:00 UTC (a gap between the
 * existing 2/3/5/6 AM jobs).
 *
 * Retention policy (differentiated by outcome):
 * - `success` runs older than 60 days are hard-deleted.
 * - `failed`/`timeout` runs older than 180 days are hard-deleted.
 *
 * @module cron/jobs/cron-run-purge
 */

import { CronRunService } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Keep successful runs this many days. */
const SUCCESS_RETENTION_DAYS = 60;
/** Keep failed/timeout runs this many days. */
const FAILED_RETENTION_DAYS = 180;

/**
 * Cron run purge job definition.
 *
 * Schedule: Daily at 4:00 UTC.
 * Purpose: Prevent unbounded growth of the cron_runs observability table.
 */
export const cronRunPurgeJob: CronJobDefinition = {
    name: 'cron-run-purge',
    description: 'Purge old cron run history (60-day success / 180-day failure retention)',
    schedule: '0 4 * * *', // Daily at 4:00 UTC
    enabled: true,
    timeoutMs: 60_000, // 1 minute timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting cron run purge job', {
            dryRun,
            successRetentionDays: SUCCESS_RETENTION_DAYS,
            failedRetentionDays: FAILED_RETENTION_DAYS,
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
            const service = new CronRunService({ logger: apiLogger });
            const deleted = await service.purgeOld({
                successRetentionDays: SUCCESS_RETENTION_DAYS,
                failedRetentionDays: FAILED_RETENTION_DAYS
            });

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Cron run purge job completed', { deleted, durationMs });

            return {
                success: true,
                message: `Purged ${deleted} old cron run records`,
                processed: deleted,
                errors: 0,
                durationMs,
                details: {
                    deleted,
                    successRetentionDays: SUCCESS_RETENTION_DAYS,
                    failedRetentionDays: FAILED_RETENTION_DAYS
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Cron run purge job failed', {
                error: errorMessage,
                stack: errorStack
            });

            return {
                success: false,
                message: `Cron run purge failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
