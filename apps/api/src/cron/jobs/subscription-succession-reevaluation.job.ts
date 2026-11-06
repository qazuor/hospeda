import {
    createPaymentReconciliationMarkPayments,
    reevaluateSuccessionPredecessors,
    reissueDeferredCourtesy
} from '@repo/service-core';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { getSuccessionCloser } from '../../utils/billing-succession-ports.js';
import { getClock } from '../../utils/clock.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
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
            const provider = getPaymentProvider();
            const clock = getClock().clock;
            const coverageNotices = getCoverageNotices();
            const summary = await reevaluateSuccessionPredecessors(
                { limit: 100 },
                {
                    provider,
                    clock,
                    beforeCancelNotice,
                    successionCloser: getSuccessionCloser(),
                    coverageNotices,
                    afterCancelled: async ({ successorSubscriptionId }) => {
                        const courtesy = await reissueDeferredCourtesy(
                            { successorSubscriptionId },
                            {
                                provider,
                                clock,
                                markPayments: createPaymentReconciliationMarkPayments(clock),
                                coverageNotices
                            }
                        );
                        logger.info('S9 courtesy retry completed', {
                            successorSubscriptionId,
                            outcome: courtesy.outcome
                        });
                    }
                }
            );
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
