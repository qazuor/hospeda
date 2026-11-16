import { reevaluateActiveSuccessionPredecessors as reevaluateSuccessionPredecessors } from '../../utils/reevaluate-succession.js';
import type { CronJobDefinition } from '../types.js';

/** Retries S17 and reissues deferred courtesy when its predecessor closes. */
export const subscriptionSuccessionReevaluationJob: CronJobDefinition = {
    name: 'subscription-succession-reevaluation',
    description: 'Retry succession predecessor cancellation and deferred courtesy (HOS-1579).',
    schedule: '33 * * * *',
    exclusive: true,
    enabled: true,
    timeoutMs: 120_000,
    handler: async ({ logger, startedAt, dryRun }) => {
        if (dryRun) {
            logger.info('Dry run mode - skipping succession reevaluation');
            return {
                success: true,
                message: 'Dry run - no succession reevaluated',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            const summary = await reevaluateSuccessionPredecessors();
            logger.info('Succession reevaluation completed', { summary });
            return {
                success: true,
                message: `Reevaluated ${summary.selected} succession predecessors`,
                processed: summary.selected,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { ...summary }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Succession reevaluation failed', { error: message });
            return {
                success: false,
                message: `Succession reevaluation failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
