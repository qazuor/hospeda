import { expireDueTrials } from '@repo/verticals';
import { getClock } from '../../utils/clock.js';
import { getTrialMachinePorts } from '../../utils/trial/trial-machine-ports.js';
import type { CronJobDefinition } from '../types.js';

/** T3 sweep: each candidate is re-read inside its own trial lock. */
export const trialMachineExpiryJob: CronJobDefinition = {
    name: 'trial-machine-expiry',
    description:
        'Expire running trials whose end date passed, re-reading it under the trial lock (HOS-1445, AC:V4:7)',
    schedule: '*/15 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping trial expiry');
            return {
                success: true,
                message: 'Dry run - no trials expired',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const { expired, skipped, failed } = await expireDueTrials({
                ...getTrialMachinePorts(),
                clock: getClock().clock,
                batchSize: 100
            });
            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Trial expiry completed', { expired, skipped, failed, durationMs });
            return {
                success: failed === 0,
                message: `Expired ${expired} trials`,
                processed: expired,
                errors: failed,
                durationMs,
                details: { expired, skipped, failed }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Trial expiry failed', { error: message });
            return {
                success: false,
                message: `Trial expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
