/**
 * Venue Events Past Cleanup Job (HOS-2254)
 *
 * Hard-deletes the one-off venue agenda events that ended more than 60 days
 * ago. See `services/venue-events-past-cleanup.ts` for the exact scope and why
 * it never touches weekly events.
 *
 * Schedule: daily at 4:15 Buenos Aires time, inside the off-peak maintenance
 * band (the scheduler runs in the AR timezone, like its siblings).
 *
 * @module cron/jobs/venue-events-past-cleanup
 */

import type { CronJobDefinition } from '../types.js';

/** Job definition. */
export const venueEventsPastCleanupJob: CronJobDefinition = {
    name: 'venue-events-past-cleanup',
    description: 'Hard-delete one-off venue events that ended more than 60 days ago (HOS-2254)',
    schedule: '15 4 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        if (dryRun) {
            logger.info('Dry run mode - skipping past venue events cleanup');
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
            // Lazy import keeps the DB singleton out of module top-level (same
            // reason as the sibling retention jobs).
            const { purgePastVenueEvents } = await import(
                '../../services/venue-events-past-cleanup.js'
            );
            const { deleted, scanned, maxDate } = await purgePastVenueEvents({ now: startedAt });

            logger.info('Past venue events cleanup completed', { deleted, scanned, maxDate });

            return {
                success: true,
                message: `Deleted ${deleted} past venue events`,
                processed: deleted,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { deleted, scanned, maxDate }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Past venue events cleanup failed', { error: errorMessage });
            return {
                success: false,
                message: `Past venue events cleanup failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: errorMessage }
            };
        }
    }
};
