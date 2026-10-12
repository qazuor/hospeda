import { REMOTE_DELETION_RETRY_JOB, runRemoteDeletionRetry } from '@repo/verticals';
import { getRemoteDeletionRetryPorts } from '../../utils/listing-publication/remote-deletion-retry-ports.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Retries, once per day, the remote deletions PB12 left pending (photos in external storage and
 * calendar tokens). Every row that survives the run is logged as an error on every run (AC:V6:30).
 */
export const listingRemoteDeletionRetryJob: CronJobDefinition = {
    name: REMOTE_DELETION_RETRY_JOB,
    description:
        'Retry the pending remote deletions of purged listings (photos and calendar tokens) once per day.',
    schedule: '45 5 * * *',
    enabled: true,
    timeoutMs: 600_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping listing remote deletion retry');
            return {
                success: true,
                message: 'Dry run - no listing remote deletion retried',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runRemoteDeletionRetry({ ports: getRemoteDeletionRetryPorts() });
            const failures = summary.failures.map(({ kind, id, vertical, error }) => ({
                kind,
                id,
                vertical: vertical ?? null,
                error: error instanceof Error ? error.message : String(error)
            }));
            for (const failure of failures) {
                logger.error('Listing remote deletion still pending', failure);
            }
            logger.info('Listing remote deletion retry completed', {
                mediaRead: summary.mediaRead,
                mediaDeleted: summary.mediaDeleted,
                calendarRead: summary.calendarRead,
                calendarDeleted: summary.calendarDeleted,
                failures: failures.length,
                complete: summary.complete,
                pinged: summary.pinged
            });
            return {
                success: summary.complete && summary.failures.length === 0,
                message: `Retried ${summary.mediaRead} photos and ${summary.calendarRead} calendar connections`,
                processed: summary.mediaRead + summary.calendarRead,
                errors: summary.failures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: { ...summary, failures }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Listing remote deletion retry failed', { error: message });
            return {
                success: false,
                message: `Listing remote deletion retry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
