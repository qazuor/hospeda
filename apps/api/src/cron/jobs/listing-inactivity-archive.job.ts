import { INACTIVITY_ARCHIVE_JOB, runInactivityArchive } from '@repo/verticals';
import { getListingArchivePorts } from '../../utils/listing-publication/archive-ports.js';
import type { CronJobDefinition } from '../types.js';

/** Archives expired listings through PB4 and PB5 once per day. */
export const listingInactivityArchiveJob: CronJobDefinition = {
    name: INACTIVITY_ARCHIVE_JOB,
    description: 'Archive inactive listings through PB4 and PB5 once per day.',
    schedule: '30 5 * * *',
    enabled: true,
    timeoutMs: 600_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping listing inactivity archive');
            return {
                success: true,
                message: 'Dry run - no listings archived',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runInactivityArchive({ ports: getListingArchivePorts() });
            const failures = summary.failures.map(({ listingId }) => listingId);
            logger.info('Listing inactivity archive completed', {
                read: summary.read,
                archived: summary.archived,
                archivedByTransition: summary.archivedByTransition,
                skipped: summary.skipped,
                failures,
                complete: summary.complete
            });
            return {
                success: summary.complete,
                message: `Archived ${summary.archived} listings from ${summary.read} candidates`,
                processed: summary.read,
                errors: summary.failures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    archived: summary.archived,
                    archivedByTransition: summary.archivedByTransition,
                    skipped: summary.skipped,
                    failures
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Listing inactivity archive failed', { error: message });
            return {
                success: false,
                message: `Listing inactivity archive failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    archived: 0,
                    archivedByTransition: { PB4: 0, PB5: 0 },
                    skipped: {},
                    failures: []
                }
            };
        }
    }
};
