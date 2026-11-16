import {
    createPaymentReconciliationMarkPayments,
    reevaluateSuccessionPredecessors,
    reissueDeferredCourtesy
} from '@repo/service-core';
import { beforeCancelNotice } from '../routes/billing-subscription/before-cancel-notice.js';
import { getSuccessionCloser } from './billing-succession-ports.js';
import { getClock } from './clock.js';
import { getCoverageNotices } from './listing-access/coverage-notices.js';
import { apiLogger } from './logger.js';
import { getPaymentProvider } from './payment-provider.js';

/** Retry active succession predecessors through the normal S17 operation. */
export async function reevaluateActiveSuccessionPredecessors() {
    const provider = getPaymentProvider();
    const clock = getClock().clock;
    const coverageNotices = getCoverageNotices();
    return reevaluateSuccessionPredecessors(
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
                apiLogger.info(
                    { successorSubscriptionId, outcome: courtesy.outcome },
                    'S9 courtesy retry completed'
                );
            }
        }
    );
}
