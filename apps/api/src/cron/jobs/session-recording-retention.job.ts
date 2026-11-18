/**
 * Session Recording Retention Job (HOS-2347)
 *
 * Deletes the Umami session replays and heatmap events older than the retention
 * the owner configured (14, 30 or 60 days; default 30) in the admin card. It
 * runs even while the recording switch is OFF: data recorded before the switch
 * was turned off still has to go.
 *
 * Needs the restricted Umami database connection (see the purge service). When
 * it is unset the job logs a warning and skips outside production; in production
 * the run is reported as FAILED so the missing configuration shows red instead of
 * silently keeping data past the promised period. When another purge holds the
 * advisory lock the job skips with a log. A dry run deletes nothing.
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
            const { env } = await import('../../utils/env.js');
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

            if (outcome.status === 'locked') {
                logger.info('Session recording retention skipped: another purge is running');
                return {
                    success: true,
                    message: 'Skipped: another purge is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { skipped: true, reason: 'LOCKED', retentionDays }
                };
            }

            if (outcome.status === 'skipped') {
                const message = describeSkippedPurge(outcome.reason);
                const production = env.NODE_ENV === 'production';
                if (production) {
                    logger.error(`Session recording retention cannot run: ${message}`);
                } else {
                    logger.warn(`Session recording retention skipped: ${message}`);
                }
                return {
                    // Production keeping recordings past the promised period is a failure, not a no-op.
                    success: !production,
                    message: production ? `Cannot run: ${message}` : `Skipped: ${message}`,
                    processed: 0,
                    errors: production ? 1 : 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { skipped: true, reason: outcome.reason, retentionDays }
                };
            }

            const { replaysDeleted, heatmapEventsDeleted, savedReplaysDeleted, stoppedEarly } =
                outcome;
            logger.info('Session recording retention completed', {
                retentionDays,
                replaysDeleted,
                heatmapEventsDeleted,
                savedReplaysDeleted,
                stoppedEarly
            });
            return {
                success: true,
                message: `Deleted ${replaysDeleted} replays, ${heatmapEventsDeleted} heatmap events and ${savedReplaysDeleted} saved pointers older than ${retentionDays} days`,
                processed: replaysDeleted + heatmapEventsDeleted + savedReplaysDeleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    retentionDays,
                    replaysDeleted,
                    heatmapEventsDeleted,
                    savedReplaysDeleted,
                    stoppedEarly
                }
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
