import { DAILY_COVERAGE_RECONCILER_JOB, runDailyCoverageReconciler } from '@repo/verticals';
import { getListingReconcilerPorts } from '../../utils/listing-publication/reconciler-ports.js';
import type { CronJobDefinition } from '../types.js';

/** Runs the daily listing coverage and Partner presence reconciliation. */
export const listingCoverageReconcilerJob: CronJobDefinition = {
    name: DAILY_COVERAGE_RECONCILER_JOB,
    description: 'Reconcile listing publication coverage and Partner presence cache once per day.',
    schedule: '0 5 * * *',
    enabled: true,
    timeoutMs: 600_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping listing coverage reconciler');
            return {
                success: true,
                message: 'Dry run - no listing coverage reconciled',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await runDailyCoverageReconciler({
                ports: getListingReconcilerPorts()
            });
            const failedUserIds = [...new Set(summary.failures.map(({ userId }) => userId))];
            logger.info('Listing coverage reconciliation completed', {
                pairsRead: summary.pairsRead,
                ran: summary.ran,
                lowered: summary.lowered,
                restored: summary.restored,
                partnerChecked: summary.partnerChecked,
                partnerInvalidated: summary.partnerInvalidated,
                failures: failedUserIds,
                complete: summary.complete,
                pinged: summary.pinged
            });
            return {
                success: summary.complete,
                message: `Reconciled ${summary.pairsRead} owner vertical pairs`,
                processed: summary.pairsRead,
                errors: summary.failures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: { ...summary, failures: failedUserIds }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Listing coverage reconciliation failed', { error: message });
            return {
                success: false,
                message: `Listing coverage reconciliation failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
