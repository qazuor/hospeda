import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectPayment, SelectRefund } from '@repo/db';
import { eq, getDb, idempotencyKeys, refundCalls } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { OrderRefundScope, PaymentProvider } from '@repo/payments';
import { PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { rereadOrderForRefund } from './refund-order-reread';
import { completeCall, persistCall } from './refund-provider-call';
import { failProviderRejectedRefund } from './refund-provider-rejection';

const logger = createLogger('refund-order-call');
const HELD_CONSTRAINT = 'uq_refund_call_order_awaiting_id';
const PROVIDER_ID_CONSTRAINT = 'uq_refund_call_provider_refund_id';
type SentCall = {
    readonly amount: number;
    readonly providerRefundId: string | null;
    readonly answered: boolean;
};
type OrderCallResult = {
    readonly outcome:
        | 'SENT'
        | 'ORDER_REFUND_HELD'
        | 'PROVIDER_KEY_CONFLICT'
        | 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
        | 'PROVIDER_REJECTED_FAILED'
        | 'AWAITING_PROVIDER_ANSWER';
    readonly calls: readonly SentCall[];
};

/** Sends one persisted order refund (AC:B6:8, AC:B6:9, TRANS:B:RF2, MP:EX-58). */
export async function sendOrderRefundCall(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly orderId: string;
    readonly order: { readonly paymentTransactionId: string | null };
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly existingCall?: { readonly idempotencyKey: string; readonly amount: number };
}): Promise<OrderCallResult> {
    const { refund, payment, orderId, order, provider, clock } = input;
    const amount = input.existingCall?.amount ?? refund.amount;
    const addonInstanceId = payment.addonInstanceId;
    if (!addonInstanceId) throw new Error('Order refund has no add-on instance');
    let scope: OrderRefundScope;
    if (amount === payment.amount) scope = { kind: 'total' };
    else {
        const transactionId = order.paymentTransactionId;
        if (transactionId === null)
            return { outcome: 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED', calls: [] };
        scope = {
            kind: 'partial',
            transactionId,
            amount: { amountMinor: amount, currency: payment.currency }
        };
    }
    let key: string;
    if (input.existingCall) key = input.existingCall.idempotencyKey;
    else {
        try {
            ({ key } = await persistCall(refund.id, payment, amount, addonInstanceId));
        } catch (error) {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505' && cause.constraint === HELD_CONSTRAINT)
                return { outcome: 'ORDER_REFUND_HELD', calls: [] };
            throw error;
        }
    }
    const unanswered: SentCall = { amount, providerRefundId: null, answered: false };
    let response: Awaited<ReturnType<PaymentProvider['refundOrder']>>;
    try {
        response = await provider.refundOrder({ orderId, reference: key, scope });
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) {
            logger.error({ error, orderId, refundId: refund.id }, 'Order refund transport failed');
            return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: [unanswered] };
        }
        if (error.code === 'UNAVAILABLE')
            return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: [unanswered] };
        if (error.code === 'REJECTED' && error.refundRefusal === 'KEY_REUSED') {
            logger.error({ error, orderId, refundId: refund.id }, 'Order refund key conflict');
            return { outcome: 'PROVIDER_KEY_CONFLICT', calls: [unanswered] };
        }
        if (error.code === 'REJECTED' || error.code === 'NOT_FOUND') {
            await getDb().transaction(async (tx) => {
                await tx
                    .update(idempotencyKeys)
                    .set({
                        result: { outcome: 'REJECTED', code: error.code },
                        completedAt: clock.now()
                    })
                    .where(eq(idempotencyKeys.key, key));
                await tx.delete(refundCalls).where(eq(refundCalls.idempotencyKey, key));
            });
            return {
                outcome: 'PROVIDER_REJECTED_FAILED',
                calls: [{ ...unanswered, answered: true }]
            };
        }
        throw error;
    }
    const recorded = await getDb()
        .select({ providerRefundId: refundCalls.providerRefundId })
        .from(refundCalls)
        .where(eq(refundCalls.addonInstanceId, addonInstanceId));
    const ids = new Set(
        recorded.flatMap(({ providerRefundId }) => (providerRefundId ? [providerRefundId] : []))
    );
    const newRefunds = response.refunds.filter(({ refundId }) => !ids.has(refundId));
    const only = newRefunds.length === 1 ? newRefunds[0] : undefined;
    if (!only || only.amountMinor !== amount) {
        logger.error(
            {
                orderId,
                refundId: refund.id,
                seenIds: response.refunds.map(({ refundId }) => refundId)
            },
            'Order refund response has ambiguous id'
        );
        return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: [unanswered] };
    }
    try {
        await completeCall(
            key,
            { outcome: 'ACCEPTED', providerRefundId: only.refundId },
            clock,
            only.refundId
        );
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === PROVIDER_ID_CONSTRAINT)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Provider refund id is already recorded',
                undefined,
                'REFUND_PROVIDER_ID_ALREADY_RECORDED'
            );
        throw error;
    }
    return {
        outcome: 'SENT',
        calls: [{ amount, providerRefundId: only.refundId, answered: true }]
    };
}

/** Confirms the order branch of RF2 after its source transaction (AC:B6:8, TRANS:B:RF2). */
export async function confirmOrderRefund(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly subjectId: string | null;
    readonly orderId: string;
    readonly correlationId?: string;
    readonly ports: { readonly clock: Clock; readonly provider: PaymentProvider };
}) {
    const { refund, payment, subjectId, orderId, ports } = input;
    const reread = await rereadOrderForRefund({ orderId, ...ports });
    if (reread.kind !== 'READY')
        return {
            refundId: refund.id,
            status: 'CONFIRMED' as const,
            outcome:
                reread.kind === 'UNAVAILABLE'
                    ? ('AWAITING_PROVIDER_ANSWER' as const)
                    : ('ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED' as const),
            calls: [],
            subjectId
        };
    const sent = await sendOrderRefundCall({
        refund,
        payment,
        orderId,
        order: reread.order,
        ...ports
    });
    if (sent.outcome === 'PROVIDER_REJECTED_FAILED') {
        await failProviderRejectedRefund({
            refund,
            payment,
            clock: ports.clock,
            correlationId: input.correlationId ?? crypto.randomUUID()
        });
        return { refundId: refund.id, status: 'FAILED' as const, ...sent, subjectId };
    }
    return { refundId: refund.id, status: 'CONFIRMED' as const, ...sent, subjectId };
}
