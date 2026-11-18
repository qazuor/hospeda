/**
 * Session Recording Retention Job (HOS-2347)
 *
 * Deletes the Umami session replays and heatmap events older than the retention
 * the owner configured (14, 30 or 60 days; default 30) in the admin card. It
 * runs even while the recording switch is OFF: data recorded before the switch
 * was turned off still has to go.
 *
 * Needs the restricted Umami database connection (see the purge service). When
 * it is unset the job logs a warning and skips: that is a configuration state, not a
 * failure. A dry run deletes nothing.
 *
 * Schedule: daily at 4:25 Buenos Aires time, inside the off-peak maintenance band.
 *
 * @module cron/jobs/session-recording-retention
 */

import type { CronJobDefinition } from '../types.js';

/** Job definition. */
export const sessionRecordingRetentionJob: CronJobDefinition = {
    name: 'session-recording-retention',
    description:
        'Delete Umami session replays and heatmap events older than the configured retention (HOS-2347)',
    schedule: '25 4 * * *',
    enabled: true,
    timeoutMs: 300_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun, signal } = ctx;

        if (dryRun) {
            logger.info('Dry run mode - skipping session recording retention');
            return {
                success: true,
                message: 'Dry run - no recordings purged',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }

        try {
            // Lazy imports keep the DB singleton and env out of module top-level
            // (same reason as the sibling retention jobs).
            const { PlatformSettingsService } = await import('@repo/service-core');
            const { apiLogger } = await import('../../utils/logger.js');
            const { purgeSessionRecordingsFromEnv, describeSkippedPurge } = await import(
                '../../services/session-recording-purge.js'
            );

            // Read regardless of the on/off switch: only the period matters here.
            const retentionDays = await new PlatformSettingsService({
                logger: apiLogger
            }).getSessionRecordingRetentionDays();
            const outcome = await purgeSessionRecordingsFromEnv({
                retentionDays,
                ...(signal ? { signal } : {})
            });

            if (outcome.status === 'skipped') {
                const message = describeSkippedPurge(outcome.reason);
                logger.warn(`Session recording retention skipped: ${message}`);
                return {
                    success: true,
                    message: `Skipped: ${message}`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { skipped: true, reason: outcome.reason, retentionDays }
                };
            }

            const { replaysDeleted, heatmapEventsDeleted, stoppedEarly } = outcome;
            logger.info('Session recording retention completed', {
                retentionDays,
                replaysDeleted,
                heatmapEventsDeleted,
                stoppedEarly
            });
            return {
                success: true,
                message: `Deleted ${replaysDeleted} replays and ${heatmapEventsDeleted} heatmap events older than ${retentionDays} days`,
                processed: replaysDeleted + heatmapEventsDeleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { retentionDays, replaysDeleted, heatmapEventsDeleted, stoppedEarly }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Session recording retention failed', { error: errorMessage });
            return {
                success: false,
                message: `Session recording retention failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
