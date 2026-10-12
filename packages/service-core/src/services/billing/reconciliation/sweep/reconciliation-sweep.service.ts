import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    isReconciliationSweepRunComplete,
    reconciliationInventoryModel,
    reconciliationSweepRunModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import type { ReconciliationComparisonInput } from './reconciliation-divergence.js';
import { type ReconciliationComparison, recordDivergence } from './reconciliation-divergence.js';
import type { SweepLivenessPing } from './sweep-liveness-ping.port.js';
import {
    runZeroCallChecks,
    type ZeroCallChecksPorts,
    type ZeroCallChecksSummary
} from './zero-call-checks.service.js';

const logger = createLogger('billing-reconciliation-sweep');

export interface ReconciliationSweepInput {
    readonly pageSize?: number;
    readonly correlationId?: string;
}

export interface ReconciliationSweepPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly comparisons?: readonly ReconciliationComparison[];
    readonly rowChecks?: readonly ReconciliationRowCheck[];
    readonly markPayments?: ReconciliationMarkPayments;
    readonly zeroCallChecks?: ZeroCallChecksPorts;
    readonly livenessPing?: SweepLivenessPing;
}

export type ReconciliationRowCheck = (input: ReconciliationComparisonInput) => Promise<void>;

export interface ReconciliationSweepFailure {
    readonly subscriptionId: string;
    readonly message: string;
}

export interface ReconciliationSweepSummary {
    readonly rowsRead: number;
    readonly runId: string;
    readonly complete: boolean;
    readonly pinged: boolean;
    readonly rowsFailed: number;
    readonly divergences: number;
    readonly marksOpened: number;
    readonly marksAccumulated: number;
    readonly failures: readonly ReconciliationSweepFailure[];
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly zeroCallChecks?: ZeroCallChecksSummary;
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
    const run = await reconciliationSweepRunModel.open({ correlationId, startedAt });
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
                for (const check of ports.rowChecks ?? []) {
                    await check({ subscription, providerLink, read, act });
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

    const zeroCallChecks = ports.zeroCallChecks
        ? await runZeroCallChecks(
              { correlationId, pageSize },
              { ...ports.zeroCallChecks, markPayments: ports.markPayments }
          )
        : undefined;

    const finishedAt = ports.clock.now();
    await reconciliationSweepRunModel.close({ id: run.id, finishedAt, rowsRead, rowsFailed });
    const complete = isReconciliationSweepRunComplete({ finishedAt, rowsFailed });
    let pinged = false;
    if (complete && ports.livenessPing) {
        try {
            await ports.livenessPing.ping({ sweep: 'RECONCILIATION', runId: run.id, finishedAt });
            pinged = true;
        } catch (error) {
            logger.error(
                { runId: run.id, error: errorMessage(error) },
                'Reconciliation sweep ping failed'
            );
        }
    }

    return {
        runId: run.id,
        complete,
        pinged,
        rowsRead,
        rowsFailed,
        divergences,
        marksOpened,
        marksAccumulated,
        failures,
        startedAt,
        finishedAt,
        ...(zeroCallChecks ? { zeroCallChecks } : {})
    };
}
