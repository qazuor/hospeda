import { randomUUID } from 'node:crypto';
import { type ReconciliationMarkReason, reconciliationZeroCallModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { recordDivergence } from './reconciliation-divergence.js';
import {
    type RetainedPaymentBranchResolver,
    type RetainedPaymentsSource,
    unimplementedRetainedPaymentBranchResolver,
    unimplementedRetainedPaymentsSource
} from './zero-call-ports.js';

const logger = createLogger('billing-reconciliation-sweep');
const REASONS = {
    succession: 'SUCESION_ABIERTA_SOBRE_FILA_MUERTA',
    retainedPayment: 'PAGO_PENDIENTE_SIN_RAMA',
    courtesy: 'CORTESIA_SIN_RE_EMITIR'
} as const satisfies Record<string, ReconciliationMarkReason>;
const CHECKS = {
    succession: 'SUCCESSION_OPEN_ON_DEAD_ROW',
    payment: 'PAYMENT_PENDING_WITHOUT_BRANCH',
    courtesy: 'DEFERRED_COURTESY_NOT_REISSUED'
} as const;

/** Ports for all read-only zero-call checks; no provider is accepted by design. */
export interface ZeroCallChecksPorts {
    /** Persistence boundary for hanging unresolved payments. */
    readonly markPayments?: ReconciliationMarkPayments;
    /** Source for S19-retained payments. */
    readonly retainedPayments?: RetainedPaymentsSource;
    /** Resolver for the corresponding B/12 §5.3 branch. */
    readonly retainedPaymentBranches?: RetainedPaymentBranchResolver;
}

/** Counts and isolated failures for one run of the three checks. */
export interface ZeroCallChecksSummary {
    /** Per-check examined and action counts. */
    readonly results: ReadonlyArray<{
        readonly check: (typeof CHECKS)[keyof typeof CHECKS];
        readonly examined: number;
        readonly marksOpened: number;
        readonly marksAccumulated: number;
        readonly resolved: number;
    }>;
    /** A check-level or row-level failure; checks never reject the sweep. */
    readonly failures: ReadonlyArray<{
        readonly check: (typeof CHECKS)[keyof typeof CHECKS];
        readonly subjectId: string | null;
        readonly message: string;
    }>;
}

/** Optional run metadata for the zero-call checks. */
export interface ZeroCallChecksInput {
    /** Shared reconciliation correlation id. */
    readonly correlationId?: string;
    /** Page size for the two DB scans; defaults to 100. */
    readonly pageSize?: number;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Runs succession, retained-payment and deferred-courtesy checks without provider access. */
export async function runZeroCallChecks(
    input: ZeroCallChecksInput = {},
    ports: ZeroCallChecksPorts = {}
): Promise<ZeroCallChecksSummary> {
    const correlationId = input.correlationId ?? randomUUID();
    const pageSize = input.pageSize ?? 100;
    const results: Array<ZeroCallChecksSummary['results'][number]> = [];
    const failures: Array<ZeroCallChecksSummary['failures'][number]> = [];

    const succession = {
        check: CHECKS.succession,
        examined: 0,
        marksOpened: 0,
        marksAccumulated: 0,
        resolved: 0
    };
    try {
        let cursor: string | undefined;
        for (;;) {
            const page =
                await reconciliationZeroCallModel.listOpenSuccessionsOnDeadPredecessorsPage({
                    afterSubscriptionId: cursor,
                    limit: pageSize
                });
            for (const { successor } of page) {
                succession.examined++;
                try {
                    const recorded = await recordDivergence(
                        {
                            subscriptionId: successor.id,
                            divergence: { reason: REASONS.succession },
                            correlationId
                        },
                        ports.markPayments ? { markPayments: ports.markPayments } : {}
                    );
                    if (recorded.markOutcome === 'OPENED') succession.marksOpened++;
                    else succession.marksAccumulated++;
                } catch (error) {
                    failures.push({
                        check: CHECKS.succession,
                        subjectId: successor.id,
                        message: messageOf(error)
                    });
                }
            }
            if (page.length < pageSize) break;
            cursor = page.at(-1)?.successor.id;
        }
    } catch (error) {
        failures.push({ check: CHECKS.succession, subjectId: null, message: messageOf(error) });
    }
    results.push(succession);

    const payment = {
        check: CHECKS.payment,
        examined: 0,
        marksOpened: 0,
        marksAccumulated: 0,
        resolved: 0
    };
    try {
        const source = ports.retainedPayments ?? unimplementedRetainedPaymentsSource;
        const resolver =
            ports.retainedPaymentBranches ?? unimplementedRetainedPaymentBranchResolver;
        const retained = await source.listRetainedPayments();
        const candidateIds = [...new Set(retained.map(({ subscriptionId }) => subscriptionId))];
        const withoutLiveSuccessor = new Set<string>();
        for (let offset = 0; offset < candidateIds.length; offset += 500) {
            const batch = candidateIds.slice(offset, offset + 500);
            for (const id of await reconciliationZeroCallModel.findSubscriptionIdsWithoutLiveSuccessor(
                { subscriptionIds: batch }
            )) {
                withoutLiveSuccessor.add(id);
            }
        }
        for (const retainedPayment of retained) {
            if (!withoutLiveSuccessor.has(retainedPayment.subscriptionId)) continue;
            payment.examined++;
            try {
                const outcome = await resolver.resolveByBranch({
                    ...retainedPayment,
                    correlationId
                });
                if (outcome.kind === 'RESOLVED') {
                    payment.resolved++;
                    continue;
                }
                const recorded = await recordDivergence(
                    {
                        subscriptionId: retainedPayment.subscriptionId,
                        divergence: {
                            reason: REASONS.retainedPayment,
                            payment: retainedPayment.payment
                        },
                        correlationId
                    },
                    ports.markPayments ? { markPayments: ports.markPayments } : {}
                );
                if (recorded.markOutcome === 'OPENED') payment.marksOpened++;
                else payment.marksAccumulated++;
            } catch (error) {
                failures.push({
                    check: CHECKS.payment,
                    subjectId: retainedPayment.subscriptionId,
                    message: messageOf(error)
                });
            }
        }
    } catch (error) {
        failures.push({ check: CHECKS.payment, subjectId: null, message: messageOf(error) });
    }
    results.push(payment);

    const courtesy = {
        check: CHECKS.courtesy,
        examined: 0,
        marksOpened: 0,
        marksAccumulated: 0,
        resolved: 0
    };
    try {
        let cursor: string | undefined;
        for (;;) {
            const page =
                await reconciliationZeroCallModel.listDeferredCourtesiesWithActiveSuccessorPage({
                    afterCourtesyGrantId: cursor,
                    limit: pageSize
                });
            for (const { courtesyGrant: _grant, successor } of page) {
                courtesy.examined++;
                try {
                    const recorded = await recordDivergence(
                        {
                            subscriptionId: successor.id,
                            divergence: { reason: REASONS.courtesy },
                            correlationId
                        },
                        ports.markPayments ? { markPayments: ports.markPayments } : {}
                    );
                    if (recorded.markOutcome === 'OPENED') courtesy.marksOpened++;
                    else courtesy.marksAccumulated++;
                } catch (error) {
                    failures.push({
                        check: CHECKS.courtesy,
                        subjectId: successor.id,
                        message: messageOf(error)
                    });
                }
            }
            if (page.length < pageSize) break;
            cursor = page.at(-1)?.courtesyGrant.id;
        }
    } catch (error) {
        failures.push({ check: CHECKS.courtesy, subjectId: null, message: messageOf(error) });
    }
    results.push(courtesy);

    if (failures.length) logger.error({ correlationId, failures }, 'Zero-call checks failed');
    return { results, failures };
}
