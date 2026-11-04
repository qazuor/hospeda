import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    and,
    eq,
    getDb,
    idempotencyKeys,
    inArray,
    isNull,
    payments,
    refundCalls,
    refunds
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct, PaymentProviderError } from '@repo/payments';
import { sendOrderRefundCall } from './refund-order-call';
import { rereadOrderForRefund } from './refund-order-reread';
import { completeCall } from './refund-provider-call';
import { failProviderRejectedRefund } from './refund-provider-rejection';

const logger = createLogger('resend-refund-call');

/** AC:B6:10 / TRANS:B:RF2: identifies the confirmed refund whose calls need replay. */
export type ResendRefundCallsInput = { readonly refundId: string; readonly correlationId?: string };

/** AC:B6:10 / TRANS:B:RF2: provider and clock used for replay decisions. */
export type ResendRefundCallsPorts = { readonly provider: PaymentProvider; readonly clock: Clock };

/** AC:B6:10 / TRANS:B:RF2: one persisted call's resend outcome. */
export type ResendRefundCallOutcome = {
    readonly idempotencyKey: string;
    readonly outcome:
        | 'SENT'
        | 'AWAITING_PROVIDER_ANSWER'
        | 'PROVIDER_KEY_CONFLICT'
        | 'PROVIDER_REJECTED_FAILED'
        | 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED';
};

/** AC:B6:10 / TRANS:B:RF2: outcomes retain the original idempotency keys. */
export type ResendRefundCallsResult = {
    readonly refundId: string;
    readonly outcomes: readonly ResendRefundCallOutcome[];
};

/** AC:B6:10 / TRANS:B:RF2: persisted calls retried with their original body and key; HOS-1636 supplies the production caller. */
export async function resendUnansweredRefundCalls(
    input: ResendRefundCallsInput,
    ports: ResendRefundCallsPorts
): Promise<ResendRefundCallsResult> {
    const db = getDb();
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, input.refundId)).limit(1);
    if (refund?.status !== 'CONFIRMED' || !refund.paymentId)
        return { refundId: input.refundId, outcomes: [] };
    const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, refund.paymentId))
        .limit(1);
    if (!payment) throw new Error('Confirmed refund payment is missing');
    const pending = await db
        .select({
            idempotencyKey: refundCalls.idempotencyKey,
            amount: refundCalls.amount,
            addonInstanceId: refundCalls.addonInstanceId
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(and(eq(refundCalls.refundId, input.refundId), isNull(idempotencyKeys.completedAt)));
    const outcomes: ResendRefundCallOutcome[] = [];
    for (const call of pending) {
        const key = call.idempotencyKey;
        if (call.addonInstanceId) {
            const [instance] = await db
                .select({ orderId: addonInstances.providerOrderId })
                .from(addonInstances)
                .where(eq(addonInstances.id, call.addonInstanceId))
                .limit(1);
            if (!instance?.orderId) throw new Error('Persisted order refund has no order id');
            const reread =
                call.amount === payment.amount
                    ? null
                    : await rereadOrderForRefund({ orderId: instance.orderId, ...ports });
            if (reread && reread.kind !== 'READY') {
                outcomes.push({
                    idempotencyKey: key,
                    outcome:
                        reread.kind === 'UNAVAILABLE'
                            ? 'AWAITING_PROVIDER_ANSWER'
                            : 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
                });
                continue;
            }
            const order = reread?.kind === 'READY' ? reread.order : { paymentTransactionId: null };
            const sent = await sendOrderRefundCall({
                refund,
                payment,
                orderId: instance.orderId,
                order,
                ...ports,
                existingCall: { idempotencyKey: key, amount: call.amount }
            });
            if (sent.outcome === 'PROVIDER_REJECTED_FAILED')
                await failProviderRejectedRefund({
                    refund,
                    payment,
                    clock: ports.clock,
                    correlationId: input.correlationId ?? crypto.randomUUID()
                });
            outcomes.push({
                idempotencyKey: key,
                outcome:
                    sent.outcome === 'SENT'
                        ? 'SENT'
                        : sent.outcome === 'PROVIDER_KEY_CONFLICT'
                          ? 'PROVIDER_KEY_CONFLICT'
                          : sent.outcome === 'PROVIDER_REJECTED_FAILED'
                            ? 'PROVIDER_REJECTED_FAILED'
                            : sent.outcome === 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
                              ? 'ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED'
                              : 'AWAITING_PROVIDER_ANSWER'
            });
            continue;
        }
        let providerCallPending = true;
        try {
            const response = await ports.provider.refund({
                chargeId: payment.providerFactId,
                amount: { amountMinor: call.amount, currency: payment.currency },
                reference: key
            });
            providerCallPending = false;
            let providerRefundId = response.refundId;
            if (!providerRefundId) {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
                const { snapshot } = assertFreshForAct({ read, act });
                const matching = snapshot.refunds.filter(
                    (entry) =>
                        entry.amount.amountMinor === call.amount &&
                        entry.amount.currency === payment.currency
                );
                const named =
                    matching.length === 0
                        ? []
                        : await db
                              .select({ id: refundCalls.providerRefundId })
                              .from(refundCalls)
                              .where(
                                  inArray(
                                      refundCalls.providerRefundId,
                                      matching.map((entry) => entry.refundId)
                                  )
                              );
                const namedIds = new Set(named.map(({ id }) => id));
                const candidates = matching.filter((entry) => !namedIds.has(entry.refundId));
                if (candidates.length !== 1) {
                    logger.error(
                        { refundId: input.refundId, key, candidates: candidates.length },
                        'Payment refund replay has ambiguous id'
                    );
                    outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                    continue;
                }
                providerRefundId = candidates[0]!.refundId;
            }
            await completeCall(
                key,
                { outcome: 'ACCEPTED', providerRefundId },
                ports.clock,
                providerRefundId
            );
            outcomes.push({ idempotencyKey: key, outcome: 'SENT' });
        } catch (error) {
            if (!(error instanceof PaymentProviderError) && providerCallPending) {
                logger.error(
                    { refundId: input.refundId, key, error },
                    'Payment refund resend unavailable'
                );
                outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                continue;
            }
            if (!(error instanceof PaymentProviderError)) throw error;
            if (error.code === 'UNAVAILABLE') {
                outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                continue;
            }
            if (error.code === 'REJECTED' && error.refundRefusal === 'KEY_REUSED') {
                outcomes.push({ idempotencyKey: key, outcome: 'PROVIDER_KEY_CONFLICT' });
                continue;
            }
            if (error.code === 'REJECTED' || error.code === 'NOT_FOUND') {
                await completeCall(key, { outcome: 'REJECTED', code: error.code }, ports.clock);
                await failProviderRejectedRefund({
                    refund,
                    payment,
                    clock: ports.clock,
                    correlationId: input.correlationId ?? crypto.randomUUID()
                });
                outcomes.push({ idempotencyKey: key, outcome: 'PROVIDER_REJECTED_FAILED' });
                continue;
            }
            throw error;
        }
    }
    return { refundId: input.refundId, outcomes };
}
