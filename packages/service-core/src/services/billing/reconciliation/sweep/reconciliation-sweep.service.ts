import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import {
    isReconciliationSweepRunComplete,
    reconciliationInventoryModel,
    reconciliationSweepRunModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, type PaymentProvider } from '@repo/payments';
import type { BeforeCancelNotice } from '../../subscription/start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation
} from '../../subscription/subscription-billing-ports.js';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { observeAuthorizationRead } from './cancellation-observation.js';
import {
    type CreditedPaymentsCheckPorts,
    type CreditedPaymentsCheckSummary,
    runCreditedPaymentsCheck
} from './credited-payments-check.js';
import {
    type MarkEscalationPorts,
    type MarkEscalationSummary,
    runMarkEscalation
} from './mark-escalation.js';
import {
    createOurCancellationRetryTally,
    type OurCancellationRetryCounts,
    retryOurCancellation,
    runOurCancellationRetry
} from './our-cancellation-retry.js';
import {
    type PaidOrdersCheckPorts,
    type PaidOrdersCheckSummary,
    runPaidOrdersCheck
} from './paid-orders-check.js';
import { type PauseGiftSummary, runPauseGiftDetection } from './pause-gift-check.js';
import type { ReconciliationComparisonInput } from './reconciliation-divergence.js';
import { type ReconciliationComparison, recordDivergence } from './reconciliation-divergence.js';
import type { SweepLivenessPing } from './sweep-liveness-ping.port.js';
import {
    runTerminalReturn,
    type TerminalReturnPorts,
    type TerminalReturnSummary
} from './terminal-return.js';
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
    /**
     * The retry of our decided cancellations (AC:B11:6). Optional: without it the sweep does
     * exactly what it did before. Provider and clock are the sweep's own.
     */
    readonly cancellationRetry?: { readonly beforeCancelNotice: BeforeCancelNotice };
    /** Optional B4 annotation port; without it, the sweep behaves as before. */
    readonly cancellationSeen?: CancellationSeenAnnotator;
    /** Terminal rows returning to the sweep (AC:B11:15); absent preserves the previous pass. */
    readonly terminalReturn?: TerminalReturnPorts;
    /**
     * The credited-payments check (AC:B11:12, AC:B11:27). Optional: without it the sweep
     * does exactly what it did before. Provider, clock and S14 port are the sweep's own.
     */
    readonly creditedPayments?: CreditedPaymentsCheckPorts;
    /**
     * The paid-orders check (AC:B11:13). Optional: without it the sweep does exactly
     * what it did before. Provider and clock are the sweep's own.
     */
    readonly paidOrders?: PaidOrdersCheckPorts;
    /** Optional escalation pass; without it the sweep performs exactly as before. */
    readonly markEscalation?: Omit<MarkEscalationPorts, 'clock'>;
    readonly pauseGifts?: { readonly tx?: DrizzleClient };
}

export type ReconciliationRowCheckResult = 'STOP_REMAINING_CHECKS' | void;

export type ReconciliationRowCheck = (
    input: ReconciliationComparisonInput
) => Promise<ReconciliationRowCheckResult>;

/** Runs a row's checks in order; a handled S6 decision prevents stale checks from mutating it. */
export async function runReconciliationRowChecks(
    input: ReconciliationComparisonInput,
    checks: readonly ReconciliationRowCheck[]
): Promise<void> {
    for (const check of checks) {
        if ((await check(input)) === 'STOP_REMAINING_CHECKS') return;
    }
}

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
    /** Outcomes of the cancellation retry (live `CANCEL_SCHEDULED` rows plus the terminal pass). */
    readonly cancellationRetry?: OurCancellationRetryCounts & {
        readonly rowsRead: number;
        readonly rowsFailed: number;
    };
    /** Outcomes of the terminal return pass, when it ran. */
    readonly terminalReturn?: TerminalReturnSummary;
    /** Outcomes of the credited-payments check, when it ran. */
    readonly creditedPayments?: CreditedPaymentsCheckSummary;
    /** Outcomes of the paid-orders check, when it ran. */
    readonly paidOrders?: PaidOrdersCheckSummary;
    /** Outcomes of overdue mark escalation, when enabled. */
    readonly markEscalation?: MarkEscalationSummary;
    readonly pauseGifts?: PauseGiftSummary;
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
    const comparisons = ports.comparisons ?? [];
    const compareRow = async (comparisonInput: ReconciliationComparisonInput) => {
        for (const comparison of comparisons) {
            const found = await comparison(comparisonInput);
            for (const divergence of found) {
                divergences++;
                const recorded = await recordDivergence(
                    {
                        subscriptionId: comparisonInput.subscription.id,
                        divergence,
                        correlationId
                    },
                    ports.markPayments ? { markPayments: ports.markPayments } : {}
                );
                if (recorded.markOutcome === 'OPENED') marksOpened++;
                else marksAccumulated++;
            }
        }
    };
    let afterSubscriptionId: string | undefined;
    const retryPorts = ports.cancellationRetry
        ? {
              provider: ports.provider,
              clock: ports.clock,
              beforeCancelNotice: ports.cancellationRetry.beforeCancelNotice,
              markPayments: ports.markPayments,
              cancellationSeen: ports.cancellationSeen
          }
        : undefined;
    const retryTally = createOurCancellationRetryTally();

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
                await observeAuthorizationRead({
                    read,
                    act,
                    subscriptionId: subscription.id,
                    annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                    previouslySeenAt: providerLink.cancelledSeenAt
                });
                rowsRead++;
                await compareRow({ subscription, providerLink, read, act });
                await runReconciliationRowChecks(
                    { subscription, providerLink, read, act },
                    ports.rowChecks ?? []
                );
                // A live CANCEL_SCHEDULED left by S11 is retried here, with this loop's read (I8).
                if (retryPorts && subscription.status === 'CANCEL_SCHEDULED') {
                    const decision = await reconciliationInventoryModel.findCancellationDecision({
                        subscriptionId: subscription.id
                    });
                    if (decision) {
                        const retried = await retryOurCancellation(
                            {
                                subscription,
                                providerLink,
                                decision,
                                correlationId,
                                prior: { read, act }
                            },
                            retryPorts
                        );
                        retryTally.add(retried.outcome);
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

    let cancellationRetry: ReconciliationSweepSummary['cancellationRetry'];
    if (retryPorts) {
        const pass = await runOurCancellationRetry(
            { correlationId, pageSize, ...(ports.terminalReturn ? { unconfirmedOnly: true } : {}) },
            comparisons.length > 0 ? { ...retryPorts, afterRead: compareRow } : retryPorts
        );
        rowsRead += pass.rowsRead;
        rowsFailed += pass.rowsFailed;
        failures.push(...pass.failures);
        const live = retryTally.totals();
        cancellationRetry = {
            stopped: live.stopped + pass.stopped,
            confirmed: live.confirmed + pass.confirmed,
            marked: live.marked + pass.marked,
            noticePending: live.noticePending + pass.noticePending,
            callFailed: live.callFailed + pass.callFailed,
            sentUnconfirmed: live.sentUnconfirmed + pass.sentUnconfirmed,
            rowsRead: pass.rowsRead,
            rowsFailed: pass.rowsFailed
        };
    }

    let terminalReturn: TerminalReturnSummary | undefined;
    if (ports.terminalReturn) {
        terminalReturn = await runTerminalReturn(
            { correlationId, pageSize },
            {
                ...ports.terminalReturn,
                provider: ports.provider,
                clock: ports.clock,
                markPayments: ports.markPayments,
                cancellationSeen: ports.cancellationSeen,
                ...(comparisons.length > 0 ? { compareRow } : {})
            }
        );
        rowsRead += terminalReturn.rowsRead;
        rowsFailed += terminalReturn.rowsFailed;
        failures.push(...terminalReturn.failures);
    }

    let creditedPayments: CreditedPaymentsCheckSummary | undefined;
    if (ports.creditedPayments) {
        creditedPayments = await runCreditedPaymentsCheck(
            { correlationId, pageSize },
            {
                ...ports.creditedPayments,
                provider: ports.provider,
                clock: ports.clock,
                markPayments: ports.markPayments
            }
        );
        rowsRead += creditedPayments.examined;
        rowsFailed += creditedPayments.failures.length;
        for (const failure of creditedPayments.failures)
            if (failure.subscriptionId !== null)
                failures.push({ subscriptionId: failure.subscriptionId, message: failure.message });
    }

    let paidOrders: PaidOrdersCheckSummary | undefined;
    if (ports.paidOrders) {
        paidOrders = await runPaidOrdersCheck(
            { correlationId, pageSize },
            { ...ports.paidOrders, provider: ports.provider, clock: ports.clock }
        );
        rowsRead += paidOrders.examined;
        rowsFailed += paidOrders.failures.length;
    }

    let markEscalation: MarkEscalationSummary | undefined;
    if (ports.markEscalation) {
        markEscalation = await runMarkEscalation(
            { correlationId, pageSize },
            { ...ports.markEscalation, clock: ports.clock }
        );
        rowsRead += markEscalation.examined;
        rowsFailed += markEscalation.failures.length;
        failures.push(
            ...markEscalation.failures.map(({ markId, message }) => ({
                subscriptionId: markId,
                message
            }))
        );
    }

    let pauseGifts: PauseGiftSummary | undefined;
    if (ports.pauseGifts) {
        pauseGifts = await runPauseGiftDetection(
            { correlationId, pageSize },
            { ...ports.pauseGifts, clock: ports.clock }
        );
        rowsRead += pauseGifts.examined;
        rowsFailed += pauseGifts.failures.length;
        failures.push(
            ...pauseGifts.failures.map(({ pauseId, message }) => ({
                subscriptionId: pauseId,
                message
            }))
        );
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
        ...(zeroCallChecks ? { zeroCallChecks } : {}),
        ...(cancellationRetry ? { cancellationRetry } : {}),
        ...(terminalReturn ? { terminalReturn } : {}),
        ...(creditedPayments ? { creditedPayments } : {}),
        ...(paidOrders ? { paidOrders } : {}),
        ...(markEscalation ? { markEscalation } : {}),
        ...(pauseGifts ? { pauseGifts } : {})
    };
}
