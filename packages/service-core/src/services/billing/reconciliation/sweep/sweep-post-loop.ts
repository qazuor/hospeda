import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { CreditedPaymentsCheckSummary } from './credited-payments-check.js';
import { runCreditedPaymentsCheck } from './credited-payments-check.js';
import type { MarkEscalationSummary } from './mark-escalation.js';
import { runMarkEscalation } from './mark-escalation.js';
import {
    type createOurCancellationRetryTally,
    type OurCancellationRetryCounts,
    type RetryOurCancellationPorts,
    runOurCancellationRetry
} from './our-cancellation-retry.js';
import type { PaidOrdersCheckSummary } from './paid-orders-check.js';
import { runPaidOrdersCheck } from './paid-orders-check.js';
import type { PauseGiftSummary } from './pause-gift-check.js';
import { runPauseGiftDetection } from './pause-gift-check.js';
import type {
    ReconciliationComparison,
    ReconciliationComparisonInput
} from './reconciliation-divergence.js';
import type {
    ReconciliationSweepFailure,
    ReconciliationSweepPass,
    ReconciliationSweepPorts
} from './reconciliation-sweep.types.js';
import { SweepTimedOutError } from './sweep-control.js';
import type { TerminalReturnSummary } from './terminal-return.js';
import { runTerminalReturn } from './terminal-return.js';
import type { ZeroCallChecksSummary } from './zero-call-checks.service.js';
import { runZeroCallChecks } from './zero-call-checks.service.js';

/** Results produced by the ordered post-row passes. */
export interface SweepPostLoopResult {
    readonly stoppedOnBudget: boolean;
    readonly skippedPasses: readonly ReconciliationSweepPass[];
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly failures: readonly ReconciliationSweepFailure[];
    readonly failedSubscriptionIds: readonly string[];
    readonly cancellationRetry?: OurCancellationRetryCounts & {
        readonly rowsRead: number;
        readonly rowsFailed: number;
    };
    readonly terminalReturn?: TerminalReturnSummary;
    readonly creditedPayments?: CreditedPaymentsCheckSummary;
    readonly paidOrders?: PaidOrdersCheckSummary;
    readonly markEscalation?: MarkEscalationSummary;
    readonly pauseGifts?: PauseGiftSummary;
    readonly zeroCallChecks?: ZeroCallChecksSummary;
}

/** Runs the existing post-loop passes in order and persists completed pass names. */
export async function runSweepPostLoop(input: {
    readonly correlationId: string;
    readonly pageSize: number;
    readonly signal?: AbortSignal;
    readonly deadlineAt?: Date;
    readonly budgetClock: Clock;
    readonly clock: Clock;
    readonly provider: PaymentProvider;
    readonly ports: ReconciliationSweepPorts;
    readonly retryPorts?: RetryOurCancellationPorts;
    readonly comparisons: readonly ReconciliationComparison[];
    readonly compareRow: (input: ReconciliationComparisonInput) => Promise<void>;
    readonly completed: string[];
    readonly heartbeat: () => Promise<void>;
    readonly completePass: (pass: ReconciliationSweepPass) => Promise<void>;
    readonly retryTally: ReturnType<typeof createOurCancellationRetryTally>;
}): Promise<SweepPostLoopResult> {
    const skippedPasses: ReconciliationSweepPass[] = [];
    const failures: ReconciliationSweepFailure[] = [];
    const failedSubscriptionIds: string[] = [];
    let stoppedOnBudget = false;
    let rowsRead = 0;
    let rowsFailed = 0;
    let cancellationRetry: SweepPostLoopResult['cancellationRetry'];
    let terminalReturn: TerminalReturnSummary | undefined;
    let creditedPayments: CreditedPaymentsCheckSummary | undefined;
    let paidOrders: PaidOrdersCheckSummary | undefined;
    let markEscalation: MarkEscalationSummary | undefined;
    let pauseGifts: PauseGiftSummary | undefined;
    let zeroCallChecks: ZeroCallChecksSummary | undefined;
    const passBlocked = (pass: ReconciliationSweepPass, configured: boolean): boolean => {
        if (
            input.signal?.aborted ||
            (input.deadlineAt !== undefined && input.budgetClock.now() >= input.deadlineAt)
        )
            stoppedOnBudget = true;
        if (stoppedOnBudget && configured) skippedPasses.push(pass);
        return stoppedOnBudget;
    };

    try {
        if (
            !input.completed.includes('cancellationRetry') &&
            !passBlocked('cancellationRetry', Boolean(input.retryPorts)) &&
            input.retryPorts
        ) {
            const pass = await runOurCancellationRetry(
                {
                    correlationId: input.correlationId,
                    pageSize: input.pageSize,
                    ...(input.ports.terminalReturn ? { unconfirmedOnly: true } : {})
                },
                {
                    ...input.retryPorts,
                    heartbeat: input.heartbeat,
                    ...(input.comparisons.length > 0 ? { afterRead: input.compareRow } : {})
                }
            );
            await input.completePass('cancellationRetry');
            rowsRead += pass.rowsRead;
            rowsFailed += pass.rowsFailed;
            failures.push(...pass.failures);
            failedSubscriptionIds.push(
                ...pass.failures.map(({ subscriptionId }) => subscriptionId)
            );
            const live = input.retryTally.totals();
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
        if (
            !input.completed.includes('terminalReturn') &&
            !passBlocked('terminalReturn', Boolean(input.ports.terminalReturn)) &&
            input.ports.terminalReturn
        ) {
            terminalReturn = await runTerminalReturn(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                {
                    ...input.ports.terminalReturn,
                    provider: input.provider,
                    clock: input.clock,
                    markPayments: input.ports.markPayments,
                    cancellationSeen: input.ports.cancellationSeen,
                    heartbeat: input.heartbeat,
                    ...(input.comparisons.length > 0 ? { compareRow: input.compareRow } : {})
                }
            );
            await input.completePass('terminalReturn');
            rowsRead += terminalReturn.rowsRead;
            rowsFailed += terminalReturn.rowsFailed;
            failures.push(...terminalReturn.failures);
            failedSubscriptionIds.push(
                ...terminalReturn.failures.map(({ subscriptionId }) => subscriptionId)
            );
        }
        if (
            !input.completed.includes('creditedPayments') &&
            !passBlocked('creditedPayments', Boolean(input.ports.creditedPayments)) &&
            input.ports.creditedPayments
        ) {
            creditedPayments = await runCreditedPaymentsCheck(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                {
                    ...input.ports.creditedPayments,
                    provider: input.provider,
                    clock: input.clock,
                    markPayments: input.ports.markPayments,
                    heartbeat: input.heartbeat
                }
            );
            await input.completePass('creditedPayments');
            rowsRead += creditedPayments.examined;
            rowsFailed += creditedPayments.failures.length;
            for (const failure of creditedPayments.failures)
                if (failure.subscriptionId !== null) {
                    failedSubscriptionIds.push(failure.subscriptionId);
                    failures.push({
                        subscriptionId: failure.subscriptionId,
                        message: failure.message
                    });
                }
        }
        if (
            !input.completed.includes('paidOrders') &&
            !passBlocked('paidOrders', Boolean(input.ports.paidOrders)) &&
            input.ports.paidOrders
        ) {
            paidOrders = await runPaidOrdersCheck(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                {
                    ...input.ports.paidOrders,
                    provider: input.provider,
                    clock: input.clock,
                    heartbeat: input.heartbeat
                }
            );
            await input.completePass('paidOrders');
            rowsRead += paidOrders.examined;
            rowsFailed += paidOrders.failures.length;
        }
        if (
            !input.completed.includes('markEscalation') &&
            !passBlocked('markEscalation', Boolean(input.ports.markEscalation)) &&
            input.ports.markEscalation
        ) {
            markEscalation = await runMarkEscalation(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                { ...input.ports.markEscalation, clock: input.clock, heartbeat: input.heartbeat }
            );
            await input.completePass('markEscalation');
            rowsRead += markEscalation.examined;
            rowsFailed += markEscalation.failures.length;
            failures.push(
                ...markEscalation.failures.map(({ markId, message }) => ({
                    subscriptionId: markId,
                    message
                }))
            );
        }
        if (
            !input.completed.includes('pauseGifts') &&
            !passBlocked('pauseGifts', Boolean(input.ports.pauseGifts)) &&
            input.ports.pauseGifts
        ) {
            pauseGifts = await runPauseGiftDetection(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                { ...input.ports.pauseGifts, clock: input.clock, heartbeat: input.heartbeat }
            );
            await input.completePass('pauseGifts');
            rowsRead += pauseGifts.examined;
            rowsFailed += pauseGifts.failures.length;
            failures.push(
                ...pauseGifts.failures.map(({ pauseId, message }) => ({
                    subscriptionId: pauseId,
                    message
                }))
            );
        }
        if (
            !input.completed.includes('zeroCallChecks') &&
            !passBlocked('zeroCallChecks', Boolean(input.ports.zeroCallChecks)) &&
            input.ports.zeroCallChecks
        ) {
            zeroCallChecks = await runZeroCallChecks(
                { correlationId: input.correlationId, pageSize: input.pageSize },
                {
                    ...input.ports.zeroCallChecks,
                    markPayments: input.ports.markPayments,
                    heartbeat: input.heartbeat
                }
            );
            await input.completePass('zeroCallChecks');
        } else if (!input.ports.zeroCallChecks && !input.completed.includes('zeroCallChecks')) {
            await input.completePass('zeroCallChecks');
        }
    } catch (error) {
        if (!(error instanceof SweepTimedOutError)) throw error;
        stoppedOnBudget = true;
    }
    return {
        stoppedOnBudget,
        skippedPasses,
        rowsRead,
        rowsFailed,
        failures,
        failedSubscriptionIds,
        ...(cancellationRetry ? { cancellationRetry } : {}),
        ...(terminalReturn ? { terminalReturn } : {}),
        ...(creditedPayments ? { creditedPayments } : {}),
        ...(paidOrders ? { paidOrders } : {}),
        ...(markEscalation ? { markEscalation } : {}),
        ...(pauseGifts ? { pauseGifts } : {}),
        ...(zeroCallChecks ? { zeroCallChecks } : {})
    };
}
