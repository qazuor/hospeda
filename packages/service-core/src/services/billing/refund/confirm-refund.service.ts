import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectPayment, SelectRefund } from '@repo/db';
import { and, eq, getDb, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct, PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type { ChargebackDetection } from '../reconciliation/chargeback/chargeback-detection';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import { authorizeRefundAction, readRefundSubject } from './refund-action-authorization';
import { detectRefundChargeback } from './refund-chargeback';
import { canRefundTransition } from './refund-machine';
import { sendRefundCalls } from './refund-provider-call';
import { failProviderRejectedRefund } from './refund-provider-rejection';
import {
    assertRefundable,
    assertRetainedPaymentRefundable,
    assertWithinBalance,
    lockRefundSource
} from './refund-source';
import { providerRefundWindow } from './refund-window';

const PROVIDER_ID_CONSTRAINT = 'uq_refund_call_provider_refund_id';

/** Closed set of typed RF2 rejection reasons. */
export const CONFIRM_REFUND_REJECTIONS = [
    'REFUND_NOT_FOUND',
    'REFUND_SOURCE_NOT_FOUND',
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'REFUND_NOT_OPEN',
    'REFUND_STATE_CHANGED',
    'PAYMENT_NOT_REFUNDABLE',
    'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE',
    'RETAINED_PAYMENT_SUCCESSION_OPEN',
    'REFUND_EXCEEDS_BALANCE',
    'REFUND_PAST_PROVIDER_WINDOW',
    'REFUND_PROVIDER_ID_ALREADY_RECORDED'
] as const;
/** A rejection reason returned by `confirmRefund`. */
export type ConfirmRefundRejection = (typeof CONFIRM_REFUND_REJECTIONS)[number];

/** RF2 input. */
export type ConfirmRefundInput = {
    readonly actor: Actor;
    readonly refundId: string;
    readonly correlationId?: string;
};
/** RF2 provider-call outcome. */
export type ConfirmRefundOutcome =
    | 'SENT'
    | 'NOT_ACCEPTED_KEPT_CONFIRMED'
    | 'PROVIDER_REJECTED_KEPT_CONFIRMED'
    | 'PROVIDER_REJECTED_FAILED'
    | 'AWAITING_PROVIDER_ANSWER'
    | 'CHARGED_BACK';
/** RF2 result consumed by the administrative route. */
export type ConfirmRefundResult = {
    readonly refundId: string;
    readonly status: 'CONFIRMED' | 'FAILED';
    readonly outcome: ConfirmRefundOutcome;
    readonly calls: readonly {
        readonly amount: number;
        readonly providerRefundId: string | null;
        readonly answered: boolean;
    }[];
    readonly subjectId: string | null;
};

function reject(
    code: ServiceErrorCode,
    message: string,
    reason: ConfirmRefundRejection
): ServiceError {
    return new ServiceError(code, message, undefined, reason);
}

async function confirmInTransaction(
    input: ConfirmRefundInput,
    clock: Clock
): Promise<{ refund: SelectRefund; payment: SelectPayment; subjectId: string | null }> {
    return getDb().transaction(async (tx) => {
        const [candidate] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1);
        if (!candidate)
            throw reject(ServiceErrorCode.NOT_FOUND, 'Refund not found', 'REFUND_NOT_FOUND');
        if (!candidate.paymentId || candidate.manualPaymentId)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund source is not provider refundable',
                'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE'
            );
        const locked = await lockRefundSource({
            tx,
            source: { kind: 'PAYMENT', id: candidate.paymentId }
        });
        if (locked.kind !== 'PAYMENT')
            throw reject(
                ServiceErrorCode.NOT_FOUND,
                'Refund source not found',
                'REFUND_SOURCE_NOT_FOUND'
            );
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, input.refundId))
            .limit(1)
            .for('update');
        if (!refund)
            throw reject(ServiceErrorCode.NOT_FOUND, 'Refund not found', 'REFUND_NOT_FOUND');
        if (refund.paymentId !== candidate.paymentId)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund source changed',
                'REFUND_STATE_CHANGED'
            );
        if (
            refund.status !== 'REQUESTED' ||
            !canRefundTransition({
                transition: 'RF2',
                from: refund.status as 'REQUESTED' | 'CONFIRMED' | 'EXECUTED' | 'FAILED'
            }).allowed
        )
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund is no longer open',
                'REFUND_NOT_OPEN'
            );
        if (locked.payment.addonInstanceId !== null)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund source is not provider refundable',
                'REFUND_SOURCE_NOT_PROVIDER_REFUNDABLE'
            );
        const subjectId = await readRefundSubject({
            tx,
            subscriptionId: locked.payment.subscriptionId,
            addonInstanceId: locked.payment.addonInstanceId
        });
        authorizeRefundAction({ actor: input.actor, subjectId });
        if (!providerRefundWindow({ factAt: locked.payment.factAt, now: clock.now() }).open)
            throw reject(
                ServiceErrorCode.VALIDATION_ERROR,
                'The provider only accepts refunds within 180 days of the charge; settle it outside our flow (action 14, RF4)',
                'REFUND_PAST_PROVIDER_WINDOW'
            );
        assertRefundable({ locked });
        await assertRetainedPaymentRefundable({ tx, locked });
        await assertWithinBalance({
            tx,
            locked,
            amount: refund.amount,
            excludeRefundId: refund.id
        });
        const [updated] = await tx
            .update(refunds)
            .set({ status: 'CONFIRMED', confirmedBy: input.actor.id, version: refund.version + 1 })
            .where(
                and(
                    eq(refunds.id, refund.id),
                    eq(refunds.status, 'REQUESTED'),
                    eq(refunds.version, refund.version)
                )
            )
            .returning();
        if (!updated)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Refund changed while confirming',
                'REFUND_STATE_CHANGED'
            );
        return { refund: updated, payment: locked.payment, subjectId };
    });
}

/** Confirms a requested provider refund, re-reads the charge, and sends bounded calls. */
export async function confirmRefund(
    input: ConfirmRefundInput,
    ports: {
        readonly clock: Clock;
        readonly provider: PaymentProvider;
        readonly markPayments?: ReconciliationMarkPayments;
        readonly chargebacks?: ChargebackDetection;
    }
): Promise<ConfirmRefundResult> {
    let confirmed: Awaited<ReturnType<typeof confirmInTransaction>>;
    try {
        confirmed = await confirmInTransaction(input, ports.clock);
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === PROVIDER_ID_CONSTRAINT)
            throw reject(
                ServiceErrorCode.ALREADY_EXISTS,
                'Provider refund id is already recorded',
                'REFUND_PROVIDER_ID_ALREADY_RECORDED'
            );
        throw error;
    }
    const { refund, payment, subjectId } = confirmed;
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    let chargedBack: boolean;
    try {
        const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
        chargedBack = assertFreshForAct({ read, act }).snapshot.chargedBack;
    } catch (error) {
        if (error instanceof PaymentProviderError && error.code === 'UNAVAILABLE')
            return {
                refundId: refund.id,
                status: 'CONFIRMED',
                outcome: 'AWAITING_PROVIDER_ANSWER',
                calls: [],
                subjectId
            };
        throw error;
    }
    if (chargedBack) {
        await detectRefundChargeback({ refund, payment, input, ports });
        return {
            refundId: refund.id,
            status: 'FAILED',
            outcome: 'CHARGED_BACK',
            calls: [],
            subjectId
        };
    }
    const sent = await sendRefundCalls({
        refund,
        payment,
        provider: ports.provider,
        clock: ports.clock
    });
    if (sent.outcome === 'PROVIDER_REJECTED_FAILED') {
        await failProviderRejectedRefund({
            refund,
            payment,
            clock: ports.clock,
            correlationId: input.correlationId ?? crypto.randomUUID()
        });
        return { refundId: refund.id, status: 'FAILED', ...sent, subjectId };
    }
    return { refundId: refund.id, status: 'CONFIRMED', ...sent, subjectId };
}
