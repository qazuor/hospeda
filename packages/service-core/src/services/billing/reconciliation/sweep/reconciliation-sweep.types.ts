import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, ReconciliationSweepOutcome } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import type { BeforeCancelNotice } from '../../subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../../subscription/subscription-billing-ports.js';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import type {
    CreditedPaymentsCheckPorts,
    CreditedPaymentsCheckSummary
} from './credited-payments-check.js';
import type { MarkEscalationPorts, MarkEscalationSummary } from './mark-escalation.js';
import type { OurCancellationRetryCounts } from './our-cancellation-retry.js';
import type { PaidOrdersCheckPorts, PaidOrdersCheckSummary } from './paid-orders-check.js';
import type { PauseGiftSummary } from './pause-gift-check.js';
import type {
    ReconciliationComparison,
    ReconciliationComparisonInput
} from './reconciliation-divergence.js';
import type { SweepLivenessPing } from './sweep-liveness-ping.port.js';
import type { TerminalReturnPorts, TerminalReturnSummary } from './terminal-return.js';
import type { ZeroCallChecksPorts, ZeroCallChecksSummary } from './zero-call-checks.service.js';

/** Inputs accepted by one reconciliation sweep slice. */
export interface ReconciliationSweepInput {
    readonly pageSize?: number;
    readonly correlationId?: string;
    readonly signal?: AbortSignal;
    /** Opens a fresh cycle even when today's cycle is already complete. */
    readonly newCycle?: boolean;
    /** True when no scheduled firing remains later in the market day. */
    readonly lastSlot?: boolean;
    /** Cooperative budget deadline evaluated using the injected clock. */
    readonly deadlineAt?: Date;
}

/** Ports used by a reconciliation sweep and its ordered post-row passes. */
export interface ReconciliationSweepPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly comparisons?: readonly ReconciliationComparison[];
    readonly rowChecks?: readonly ReconciliationRowCheck[];
    readonly markPayments?: ReconciliationMarkPayments;
    readonly zeroCallChecks?: ZeroCallChecksPorts;
    readonly livenessPing?: SweepLivenessPing;
    /** Retry of our decided cancellations; provider and clock come from the sweep. */
    readonly cancellationRetry?: { readonly beforeCancelNotice: BeforeCancelNotice };
    /** Optional B4 annotation port. */
    readonly cancellationSeen?: CancellationSeenAnnotator;
    /** Terminal rows returning to the sweep. */
    readonly terminalReturn?: TerminalReturnPorts;
    /** Optional credited-payments pass. */
    readonly creditedPayments?: CreditedPaymentsCheckPorts;
    /** Optional paid-orders pass. */
    readonly paidOrders?: PaidOrdersCheckPorts;
    /** Optional escalation pass. */
    readonly markEscalation?: Omit<MarkEscalationPorts, 'clock'>;
    readonly pauseGifts?: { readonly tx?: DrizzleClient };
}

// biome-ignore lint/suspicious/noConfusingVoidType: `void` preserves existing async check callback signatures.
export type ReconciliationRowCheckResult = 'STOP_REMAINING_CHECKS' | void;

export type ReconciliationRowCheck = (
    input: ReconciliationComparisonInput
) => Promise<ReconciliationRowCheckResult>;

export interface ReconciliationSweepFailure {
    readonly subscriptionId: string;
    readonly message: string;
}

/** The passes that run after the subscription rows, in order. */
export type ReconciliationSweepPass =
    | 'cancellationRetry'
    | 'terminalReturn'
    | 'creditedPayments'
    | 'paidOrders'
    | 'markEscalation'
    | 'pauseGifts'
    | 'zeroCallChecks';

/** Public result of one slice and, when finished, its cycle summary. */
export interface ReconciliationSweepSummary {
    readonly rowsRead: number;
    readonly runId: string;
    readonly complete: boolean;
    readonly pinged: boolean;
    readonly stoppedOnBudget: boolean;
    readonly skippedPasses: readonly ReconciliationSweepPass[];
    readonly rowsFailed: number;
    readonly divergences: number;
    readonly marksOpened: number;
    readonly marksAccumulated: number;
    readonly failures: readonly ReconciliationSweepFailure[];
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly zeroCallChecks?: ZeroCallChecksSummary;
    readonly cancellationRetry?: OurCancellationRetryCounts & {
        readonly rowsRead: number;
        readonly rowsFailed: number;
    };
    readonly terminalReturn?: TerminalReturnSummary;
    readonly creditedPayments?: CreditedPaymentsCheckSummary;
    readonly paidOrders?: PaidOrdersCheckSummary;
    readonly markEscalation?: MarkEscalationSummary;
    readonly pauseGifts?: PauseGiftSummary;
    readonly outcome: ReconciliationSweepOutcome;
    readonly skipped?: 'lease_held' | 'cycle_done';
    readonly phase: 'ROWS' | 'PASSES' | 'DONE';
    readonly rowsComplete: boolean;
    readonly sliceIndex: number;
    readonly cycleId: string;
    readonly cycle?: {
        readonly cycleId: string;
        readonly cycleDate: string;
        readonly slices: number;
        readonly rowsRead: number;
        readonly rowsFailed: number;
        readonly failedSubscriptionIds: readonly string[];
    };
    readonly incomplete: boolean;
}
