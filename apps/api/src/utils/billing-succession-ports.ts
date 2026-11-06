import { createLogger } from '@repo/logger';
import type { ApplyScheduledChangeResult } from '@repo/service-core';
import {
    cancelSuccessionPredecessor,
    createPaymentReconciliationMarkPayments,
    createScheduledChangeApplier,
    createSuccessionCloser,
    finishAppliedScheduledChange,
    reissueDeferredCourtesy
} from '@repo/service-core';
import { z } from 'zod';
import { beforeCancelNotice } from '../routes/billing-subscription/before-cancel-notice.js';
import { getClock } from './clock';
import { getCoverageNotices } from './listing-access/coverage-notices';
import { createScheduledChangeSurplusStep } from './listing-publication/scheduled-change-surplus-step';
import { getPaymentProvider } from './payment-provider.js';

const logger = createLogger('billing-succession-settle');
const settleInputSchema = z.strictObject({ successorSubscriptionId: z.uuid() });

/** Build the real S18 port with the payment ledger used by reconciliation marks. */
export function getSuccessionCloser() {
    const clock = getClock().clock;
    return createSuccessionCloser({
        clock,
        markPayments: createPaymentReconciliationMarkPayments(clock)
    });
}

/** Collect S38 effects inside the transaction and publish them after its service commits. */
export function createScheduledChangeCollector() {
    const pending: Extract<ApplyScheduledChangeResult, { outcome: 'APPLIED' }>[] = [];
    return {
        applier: createScheduledChangeApplier({
            clock: { now: () => getClock().clock.now() },
            onApplied: (applied) => pending.push(applied)
        }),
        async finish(): Promise<{ readonly warnings: readonly string[] }> {
            const appliedChanges = pending.splice(0);
            const warnings: string[] = [];
            for (const applied of appliedChanges) {
                try {
                    const result = await finishAppliedScheduledChange({
                        applied,
                        ports: {
                            coverageNotices: getCoverageNotices(),
                            surplusStep: createScheduledChangeSurplusStep()
                        }
                    });
                    warnings.push(...result.warnings);
                } catch {
                    warnings.push('SCHEDULED_CHANGE_FINISH_FAILED');
                }
            }
            return { warnings };
        },
        discard(): void {
            pending.splice(0);
        }
    };
}

/** Settles S17 and independently retries S9 after a principal successor activates. */
export async function settleSuccessionAfterActivation(input: {
    readonly successorSubscriptionId: string;
}) {
    const { successorSubscriptionId } = settleInputSchema.parse(input);
    const provider = getPaymentProvider();
    const clock = getClock().clock;
    const coverageNotices = getCoverageNotices();
    let predecessor: Awaited<ReturnType<typeof cancelSuccessionPredecessor>> | 'FAILED' = 'FAILED';
    let courtesy: Awaited<ReturnType<typeof reissueDeferredCourtesy>> | 'FAILED' = 'FAILED';
    try {
        predecessor = await cancelSuccessionPredecessor(
            { successorSubscriptionId },
            {
                provider,
                clock,
                beforeCancelNotice,
                successionCloser: getSuccessionCloser(),
                coverageNotices
            }
        );
        logger.info(
            { successorSubscriptionId, outcome: predecessor.outcome },
            'S17 settlement completed'
        );
    } catch (error) {
        logger.error({ successorSubscriptionId, error }, 'S17 settlement failed');
    }
    try {
        courtesy = await reissueDeferredCourtesy(
            { successorSubscriptionId },
            {
                provider,
                clock,
                markPayments: createPaymentReconciliationMarkPayments(clock),
                coverageNotices
            }
        );
        logger.info(
            { successorSubscriptionId, outcome: courtesy.outcome },
            'S9 settlement completed'
        );
    } catch (error) {
        logger.error({ successorSubscriptionId, error }, 'S9 settlement failed');
    }
    return { predecessor, courtesy };
}
