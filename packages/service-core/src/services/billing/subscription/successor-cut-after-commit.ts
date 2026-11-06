import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { CoverageNotices } from '../payment/payment-ports';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization';
import type { ComplementPolicyPorts } from './complement-ports';
import { reevaluateRetainedPayments } from './expire-authorization-windows.service';
import type { BeforeCancelNotice } from './start-subscription.service';
import type {
    CancellationSeenAnnotator,
    ScheduledChangeApplier
} from './subscription-billing-ports';
import { writeSuccessorCutStatus } from './successor-cut-writes';
import type { SuccessorCutResult } from './successor-cutter';
import { createSuccessorCutter } from './successor-cutter';

const logger = createLogger('successor-cut-after-commit');
const runInputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });
/** Runs the predecessor write and S31 in one transaction, then emits after commit (AC:B8b:13). */
export async function runWithSuccessorCut<T>(input: {
    readonly db: DrizzleClient;
    readonly work: (tx: DrizzleClient) => Promise<T>;
    readonly predecessorSubscriptionId: string;
    readonly ports: {
        readonly clock: Clock;
        readonly orphanhood: AddonOrphanhoodPorts;
        readonly provider: PaymentProvider;
        readonly beforeCancelNotice: BeforeCancelNotice;
        readonly coverageNotices?: CoverageNotices;
        readonly billingFacts?: BillingFactSink;
        readonly scheduledChangeApplier?: ScheduledChangeApplier;
        readonly complements?: ComplementPolicyPorts;
        readonly cancellationSeen?: CancellationSeenAnnotator;
    };
}): Promise<{ readonly value: T; readonly cut: SuccessorCutResult }> {
    const parsed = runInputSchema.parse({
        predecessorSubscriptionId: input.predecessorSubscriptionId
    });
    const cutter = createSuccessorCutter({
        clock: input.ports.clock,
        orphanhood: input.ports.orphanhood,
        writeStatus: (write) => writeSuccessorCutStatus(write)
    });
    const committed = await input.db.transaction(async (tx) => {
        const value = await input.work(tx);
        const cut = await cutter.cutSuccessor({
            predecessorSubscriptionId: parsed.predecessorSubscriptionId,
            tx
        });
        return { value, cut };
    });
    await completeSuccessorCut(committed.cut, input.ports);
    return committed;
}

/** Emits coverage notices after the caller commits; failures never undo S31 (AC:B8b:13). */
export async function completeSuccessorCut(
    cut: SuccessorCutResult,
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly beforeCancelNotice: BeforeCancelNotice;
        readonly coverageNotices?: CoverageNotices;
        readonly billingFacts?: BillingFactSink;
        readonly scheduledChangeApplier?: ScheduledChangeApplier;
        readonly complements?: ComplementPolicyPorts;
        readonly cancellationSeen?: CancellationSeenAnnotator;
    }
): Promise<{
    readonly providerCall: 'CONFIRMED' | 'ALREADY_CANCELLED' | 'NONE' | 'DEFERRED_TO_SWEEP';
    readonly reason?: 'NOTICE_PENDING' | 'CALL_FAILED' | 'SENT_UNCONFIRMED';
    readonly noticeUndeliverable: boolean;
    readonly retainedReevaluated: number;
}> {
    if (cut.outcome !== 'CUT')
        return { providerCall: 'NONE', noticeUndeliverable: false, retainedReevaluated: 0 };
    let providerCall: 'CONFIRMED' | 'ALREADY_CANCELLED' | 'NONE' | 'DEFERRED_TO_SWEEP' = 'NONE';
    let reason: 'NOTICE_PENDING' | 'CALL_FAILED' | 'SENT_UNCONFIRMED' | undefined;
    let noticeUndeliverable = false;
    const beforeCancelPort = ports.beforeCancelNotice;
    if (cut.paymentMethod === 'CARD' && cut.authorizationId) {
        const beforeCancelNotice: BeforeCancelNotice = {
            beforeCancel: async (args) => {
                const result = await beforeCancelPort.beforeCancel(args);
                if (result === 'NO_RECIPIENT' || result === 'DELIVERY_EXHAUSTED') {
                    noticeUndeliverable = true;
                    logger.error(
                        {
                            subscriptionId: cut.successorId,
                            status: result,
                            noticeUndeliverable: true
                        },
                        'S31 before-cancel notice is undeliverable',
                        { capture: true }
                    );
                }
                return result;
            }
        };
        try {
            const { outcome } = await cancelOurAuthorization(
                {
                    subscriptionId: cut.successorId,
                    userId: cut.userId,
                    authorizationId: cut.authorizationId,
                    kind: 'SUCCESSOR_CUT'
                },
                { provider: ports.provider, clock: ports.clock, beforeCancelNotice }
            );
            if (
                outcome === 'NOTICE_PENDING' ||
                outcome === 'CALL_FAILED' ||
                outcome === 'SENT_UNCONFIRMED'
            ) {
                providerCall = 'DEFERRED_TO_SWEEP';
                reason = outcome;
            } else providerCall = outcome;
        } catch (error) {
            logger.error(
                { subscriptionId: cut.successorId, error },
                'S31 provider cancellation failed; the sweep retries'
            );
            providerCall = 'DEFERRED_TO_SWEEP';
            reason = 'CALL_FAILED';
        }
    }
    const notices = ports.coverageNotices;
    if (notices && cut.from === 'ACTIVE') {
        const vertical = VerticalEnumSchema.safeParse(cut.vertical);
        if (vertical.success) {
            try {
                await notices.emitCoverageChanged({
                    userId: cut.userId,
                    vertical: vertical.data,
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED'
                });
            } catch (error) {
                logger.error(
                    { successorId: cut.successorId, error },
                    'Successor coverage notice failed after S31 commit'
                );
            }
        }
    }
    try {
        if (notices && cut.cancelledAddons.length > 0)
            await emitAddonCoverageRemoved({
                cancelled: cut.cancelledAddons,
                coverageNotices: notices
            });
    } catch (error) {
        logger.error(
            { successorId: cut.successorId, error },
            'Addon coverage notice failed after S31 commit'
        );
    }
    try {
        if (cut.cancelledAddons.length > 0)
            await cancelAddonComplementsAtProvider(
                { cancelled: cut.cancelledAddons },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    beforeCancelNotice: ports.beforeCancelNotice,
                    cancellationSeen: ports.cancellationSeen
                }
            );
    } catch (error) {
        logger.error(
            { successorId: cut.successorId, error },
            'S31 addon provider cancellation failed'
        );
    }
    let retainedReevaluated = 0;
    try {
        retainedReevaluated = await reevaluateRetainedPayments(
            { predecessorId: cut.predecessorId },
            {
                provider: ports.provider,
                clock: ports.clock,
                billingFacts: ports.billingFacts,
                coverageNotices: ports.coverageNotices,
                scheduledChangeApplier: ports.scheduledChangeApplier,
                complements: ports.complements
            }
        );
    } catch (error) {
        logger.error(
            { predecessorId: cut.predecessorId, error },
            'S31 retained payment re-evaluation failed'
        );
    }
    return {
        providerCall,
        ...(reason ? { reason } : {}),
        noticeUndeliverable,
        retainedReevaluated
    };
}
