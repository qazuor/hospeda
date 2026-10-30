import type { Clock } from '@repo/billing-verticals-contract';
import { reconciliationTerminalReturnModel, type TerminalReturnRow } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../types';
import type { CanChargeDeadlines } from '../../coverage/can-charge.js';
import { getCurrentBillingDeadlines } from '../../deadlines/billing-deadlines.service.js';
import { handleLivePreapprovalOnClosedRow } from '../../notice/live-preapproval-on-closed-row.js';
import type { BeforeCancelNotice } from '../../subscription/start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation
} from '../../subscription/subscription-billing-ports.js';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { observeAuthorizationRead } from './cancellation-observation.js';
import { readLastCycleRecordIsOpen } from './last-cycle-record.js';
import type { ReconciliationComparisonInput } from './reconciliation-divergence.js';
import {
    decideTerminalStay,
    type TerminalStayReason,
    terminalHoldCutoffs
} from './terminal-hold.js';

const logger = createLogger('terminal-return');

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export interface TerminalReturnPorts {
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly deadlines?: CanChargeDeadlines;
}

export interface RunTerminalReturnPorts extends TerminalReturnPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly cancellationSeen?: CancellationSeenAnnotator;
    readonly compareRow?: (input: ReconciliationComparisonInput) => Promise<void>;
}

export interface TerminalReturnSummary {
    /** Successful reads and rows that threw are independent counts, not a partition of the inventory. */
    readonly rowsRead: number;
    readonly rowsFailed: number;
    readonly failures: ReadonlyArray<{ readonly subscriptionId: string; readonly message: string }>;
    readonly exempt: number;
    readonly stayed: Record<TerminalStayReason, number>;
    readonly handled: {
        readonly retried: number;
        readonly cancellationSent: number;
        readonly divergenceMarked: number;
        readonly notApplicable: number;
    };
}

function rejectionTerminal(row: TerminalReturnRow): boolean {
    return row.rejectionTerminal;
}

function tallyOutcome(
    handled: {
        retried: number;
        cancellationSent: number;
        divergenceMarked: number;
        notApplicable: number;
    },
    outcome: 'RETRIED' | 'CANCELLATION_SENT' | 'DIVERGENCE_MARKED' | 'NOT_APPLICABLE'
): void {
    const key = {
        RETRIED: 'retried',
        CANCELLATION_SENT: 'cancellationSent',
        DIVERGENCE_MARKED: 'divergenceMarked',
        NOT_APPLICABLE: 'notApplicable'
    } as const;
    handled[key[outcome]]++;
}

/** Re-reads terminal rows whose marks, retentions or cancellation window keep them in the sweep. */
export async function runTerminalReturn(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: RunTerminalReturnPorts
): Promise<TerminalReturnSummary> {
    const deadlineSource = ports.deadlines ?? { current: getCurrentBillingDeadlines };
    const deadlineVersion = await deadlineSource.current();
    const window16Days = deadlineVersion.values['16']?.days;
    if (typeof window16Days !== 'number')
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'The billing deadlines in force have no 16th deadline',
            undefined,
            'BILLING_DEADLINE_16_MISSING'
        );
    const now = ports.clock.now();
    const deadlines = { current: async () => deadlineVersion };
    const holdCutoffs = terminalHoldCutoffs({ now, window16Days });
    const failures: Array<{ subscriptionId: string; message: string }> = [];
    const stayed: Record<TerminalStayReason, number> = {
        OPEN_MARK: 0,
        OPEN_RETENTION: 0,
        REJECTION_WINDOW: 0,
        PREAPPROVAL_ALIVE: 0,
        RECORD_OPEN: 0
    };
    const handled = { retried: 0, cancellationSent: 0, divergenceMarked: 0, notApplicable: 0 };
    let rowsRead = 0;
    let exempt = 0;
    let afterSubscriptionId: string | undefined;
    for (;;) {
        const page = await reconciliationTerminalReturnModel.listTerminalReturnPage({
            afterSubscriptionId,
            limit: input.pageSize,
            holdCutoffs
        });
        for (const row of page) {
            try {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readAuthorization({
                    authorizationId: row.providerLink.providerId
                });
                rowsRead++;
                const observation = await observeAuthorizationRead({
                    read,
                    act,
                    subscriptionId: row.subscription.id,
                    annotator: ports.cancellationSeen ?? noCancellationSeenAnnotation,
                    previouslySeenAt: row.providerLink.cancelledSeenAt
                });
                await ports.compareRow?.({
                    subscription: row.subscription,
                    providerLink: row.providerLink,
                    read,
                    act
                });
                let reason = decideTerminalStay({
                    hasOpenMark: row.hasOpenMark,
                    hasOpenRetention: row.hasOpenRetention,
                    rejectionTerminal: rejectionTerminal(row),
                    cancelledSeenAt: row.providerLink.cancelledSeenAt,
                    now,
                    window16Days
                });
                const { snapshot } = assertFreshForAct({ read, act });
                if (snapshot.status !== 'cancelled') {
                    reason ??= 'PREAPPROVAL_ALIVE';
                    const result = await handleLivePreapprovalOnClosedRow(
                        {
                            subscriptionId: row.subscription.id,
                            readAt: observation.readAt,
                            cancelledSeenAt: row.providerLink.cancelledSeenAt
                        },
                        {
                            provider: ports.provider,
                            clock: ports.clock,
                            beforeCancelNotice: ports.beforeCancelNotice,
                            ...(ports.markPayments ? { markPayments: ports.markPayments } : {}),
                            deadlines
                        }
                    );
                    tallyOutcome(handled, result.outcome);
                } else if (reason === null) {
                    if (
                        await readLastCycleRecordIsOpen(
                            { authorizationRead: read, act },
                            { provider: ports.provider }
                        )
                    )
                        reason = 'RECORD_OPEN';
                }
                if (reason === null) exempt++;
                else stayed[reason]++;
            } catch (error) {
                failures.push({
                    subscriptionId: row.subscription.id,
                    message: errorMessage(error)
                });
                logger.error(
                    { subscriptionId: row.subscription.id, error: errorMessage(error) },
                    'Terminal return row failed'
                );
            }
        }
        if (page.length < input.pageSize) break;
        afterSubscriptionId = page.at(-1)?.subscription.id;
    }
    return { rowsRead, rowsFailed: failures.length, failures, exempt, stayed, handled };
}
