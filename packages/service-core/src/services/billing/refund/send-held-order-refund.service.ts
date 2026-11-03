import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, eq, getDb, payments, refundCalls, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { sendOrderRefundCall } from './refund-order-call';
import { rereadOrderForRefund } from './refund-order-reread';
import { failProviderRejectedRefund } from './refund-provider-rejection';

/** AC:B6:9 / TRANS:B:RF2: the held confirmed refund to release. */
export type SendHeldOrderRefundInput = {
    readonly refundId: string;
    readonly correlationId?: string;
};

/** AC:B6:9 / TRANS:B:RF2: provider and clock for the fresh order decision. */
export type SendHeldOrderRefundPorts = {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
};

/** AC:B6:9 / TRANS:B:RF2: the index and provider outcome of a held refund. */
export type SendHeldOrderRefundResult = {
    readonly refundId: string;
    readonly outcome:
        | 'NOT_APPLICABLE'
        | 'ORDER_REFUND_HELD'
        | 'SENT'
        | 'AWAITING_PROVIDER_ANSWER'
        | 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
        | 'PROVIDER_KEY_CONFLICT'
        | 'PROVIDER_REJECTED_FAILED';
};

/** AC:B6:9 / TRANS:B:RF2: release a held order refund once the index permits it; HOS-1636 supplies the production caller. */
export async function sendHeldOrderRefund(
    input: SendHeldOrderRefundInput,
    ports: SendHeldOrderRefundPorts
): Promise<SendHeldOrderRefundResult> {
    const db = getDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, input.refundId)).limit(1);
    if (refund?.status !== 'CONFIRMED' || !refund.paymentId)
        return { refundId: input.refundId, outcome: 'NOT_APPLICABLE' };
    const calls = await db
        .select({ id: refundCalls.id })
        .from(refundCalls)
        .where(eq(refundCalls.refundId, refund.id))
        .limit(1);
    if (calls.length !== 0) return { refundId: input.refundId, outcome: 'NOT_APPLICABLE' };
    const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, refund.paymentId))
        .limit(1);
    if (!payment?.addonInstanceId) return { refundId: input.refundId, outcome: 'NOT_APPLICABLE' };
    const [instance] = await db
        .select({ orderId: addonInstances.providerOrderId })
        .from(addonInstances)
        .where(eq(addonInstances.id, payment.addonInstanceId))
        .limit(1);
    if (!instance?.orderId) return { refundId: input.refundId, outcome: 'NOT_APPLICABLE' };
    const reread = await rereadOrderForRefund({ orderId: instance.orderId, ...ports });
    if (reread.kind !== 'READY')
        return {
            refundId: input.refundId,
            outcome:
                reread.kind === 'UNAVAILABLE'
                    ? 'AWAITING_PROVIDER_ANSWER'
                    : 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
        };
    const sent = await sendOrderRefundCall({
        refund,
        payment,
        orderId: instance.orderId,
        order: reread.order,
        ...ports
    });
    if (sent.outcome === 'PROVIDER_REJECTED_FAILED')
        await failProviderRejectedRefund({
            refund,
            payment,
            clock: ports.clock,
            correlationId: input.correlationId ?? crypto.randomUUID()
        });
    return { refundId: input.refundId, outcome: sent.outcome };
}
