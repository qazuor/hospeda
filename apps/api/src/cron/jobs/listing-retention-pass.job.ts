import { randomUUID } from 'node:crypto';
import { cronRunModel } from '@repo/db';
import { RETENTION_PASS_JOB, runRetentionPass } from '@repo/verticals';
import { getRetentionPassPorts } from '../../utils/listing-publication/retention-pass-ports.js';
import type { CronJobDefinition } from '../types.js';

/** Sends retention pre-notices and runs PB9 once per day. */
export const listingRetentionPassJob: CronJobDefinition = {
    name: RETENTION_PASS_JOB,
    description:
        'Send the two retention pre-notices and run PB9 over expired archived listings once per day.',
    schedule: '0 6 * * *',
    enabled: true,
    timeoutMs: 600_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping listing retention pass');
            return {
                success: true,
                message: 'Dry run - no retention notices or listings processed',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        const runCorrelationId = randomUUID();
        try {
            const previousPassStartedAt = await cronRunModel.findPreviousRunStartedAt({
                jobName: RETENTION_PASS_JOB,
                before: startedAt
            });
            const summary = await runRetentionPass({
                ports: getRetentionPassPorts({ previousPassStartedAt })
            });
            const passCorrelationId = summary.runCorrelationId;
            const failures = summary.failures.map(({ listingId }) => listingId);
            const previousPass = previousPassStartedAt?.toISOString() ?? null;
            logger.info('Listing retention pass completed', {
                runCorrelationId: passCorrelationId,
                previousPassStartedAt: previousPass,
                read: summary.read,
                notices: summary.notices,
                purged: summary.purged,
                purgeSkipped: summary.purgeSkipped,
                purgeWarnings: summary.purgeWarnings,
                failures,
                complete: summary.complete
            });
            for (const failure of summary.failures) {
                logger.error('Listing retention candidate failed', {
                    runCorrelationId: passCorrelationId,
                    step: failure.step,
                    vertical: failure.vertical,
                    listingId: failure.listingId
                });
            }
            return {
                success: summary.complete,
                message: `Processed ${summary.read.notices + summary.read.purges} retention candidates`,
                processed: summary.read.notices + summary.read.purges,
                errors: summary.failures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    runCorrelationId: passCorrelationId,
                    previousPassStartedAt: previousPass,
                    read: summary.read,
                    notices: summary.notices,
                    purged: summary.purged,
                    purgeSkipped: summary.purgeSkipped,
                    purgeWarnings: summary.purgeWarnings,
                    failures
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Listing retention pass failed', { runCorrelationId, error: message });
            return {
                success: false,
                message: `Listing retention pass failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { runCorrelationId, failures: [] }
            };
        }
    }
};
