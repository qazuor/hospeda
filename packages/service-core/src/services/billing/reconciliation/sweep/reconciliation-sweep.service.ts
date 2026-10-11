import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { reconciliationInventoryModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { type ReconciliationComparison, recordDivergence } from './reconciliation-divergence.js';

const logger = createLogger('billing-reconciliation-sweep');

export interface ReconciliationSweepInput {
    readonly pageSize?: number;
    readonly correlationId?: string;
}

export interface ReconciliationSweepPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly comparisons?: readonly ReconciliationComparison[];
    readonly markPayments?: ReconciliationMarkPayments;
}

export interface ReconciliationSweepFailure {
    readonly subscriptionId: string;
    readonly message: string;
}

export interface ReconciliationSweepSummary {
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly divergences: number;
    readonly marksOpened: number;
    readonly marksAccumulated: number;
    readonly failures: readonly ReconciliationSweepFailure[];
    readonly startedAt: Date;
    readonly finishedAt: Date;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runReconciliationSweep(
    input: ReconciliationSweepInput = {},
    ports: ReconciliationSweepPorts
): Promise<ReconciliationSweepSummary> {
    const pageSize = input.pageSize ?? 100;
    const correlationId = input.correlationId ?? randomUUID();
    const startedAt = ports.clock.now();
    const failures: ReconciliationSweepFailure[] = [];
    let rowsRead = 0;
    let rowsFailed = 0;
    let divergences = 0;
    let marksOpened = 0;
    let marksAccumulated = 0;
    let afterSubscriptionId: string | undefined;

    for (;;) {
        const page = await reconciliationInventoryModel.listSweepInventoryPage({
            afterSubscriptionId,
            limit: pageSize
        });
        for (const { subscription, providerLink } of page) {
            try {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readAuthorization({
                    authorizationId: providerLink.providerId
                });
                assertFreshForAct({ read, act });
                rowsRead++;
                for (const comparison of ports.comparisons ?? []) {
                    const found = await comparison({ subscription, providerLink, read, act });
                    for (const divergence of found) {
                        divergences++;
                        const recorded = await recordDivergence(
                            { subscriptionId: subscription.id, divergence, correlationId },
                            ports.markPayments ? { markPayments: ports.markPayments } : {}
                        );
                        if (recorded.markOutcome === 'OPENED') marksOpened++;
                        else marksAccumulated++;
                    }
                }
            } catch (error) {
                rowsFailed++;
                const message = errorMessage(error);
                failures.push({ subscriptionId: subscription.id, message });
                logger.error(
                    { subscriptionId: subscription.id, error: message },
                    'Reconciliation row failed'
                );
            }
        }
        if (page.length < pageSize) break;
        afterSubscriptionId = page.at(-1)?.subscription.id;
    }

    return {
        rowsRead,
        rowsFailed,
        divergences,
        marksOpened,
        marksAccumulated,
        failures,
        startedAt,
        finishedAt: ports.clock.now()
    };
}
