import type { ApplyScheduledChangeResult } from '@repo/service-core';
import {
    createPaymentReconciliationMarkPayments,
    createScheduledChangeApplier,
    createSuccessionCloser,
    finishAppliedScheduledChange
} from '@repo/service-core';
import { getClock } from './clock';
import { getCoverageNotices } from './listing-access/coverage-notices';
import { createScheduledChangeSurplusStep } from './listing-publication/scheduled-change-surplus-step';

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
