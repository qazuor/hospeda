import type { Clock } from '@repo/billing-verticals-contract';
import {
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
import { AmbiguousRefundAnswerError } from './ambiguous-refund-answer.error';
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
        | 'PROVIDER_REJECTED_FAILED';
};

/** AC:B6:10 / TRANS:B:RF2: outcomes retain the original idempotency keys. */
export type ResendRefundCallsResult = {
    readonly refundId: string;
    readonly outcomes: readonly ResendRefundCallOutcome[];
};

/**
 * HOS-2517: the provider refund ids among `ids` that already settle something of ours, either
 * as the panel reference of a refund (action 14, `PROVIDER_PANEL`) or as the provider id of a
 * refund call. Such an id must never be bound to another call.
 */
async function readCitedProviderRefundIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    if (ids.length === 0) return new Set();
    const db = getDb();
    const [called, settled] = await Promise.all([
        db
            .select({ id: refundCalls.providerRefundId })
            .from(refundCalls)
            .where(inArray(refundCalls.providerRefundId, [...ids])),
        db
            .select({ id: refunds.externalRef })
            .from(refunds)
            .where(
                and(
                    inArray(refunds.externalRef, [...ids]),
                    eq(refunds.externalChannel, 'PROVIDER_PANEL')
                )
            )
    ]);
    return new Set([...called, ...settled].flatMap(({ id }) => (id === null ? [] : [id])));
}

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
            // A call tied to an instance was an order refund call. The order channel was
            // retired (HOS-2179 T-7) with none left unanswered, so it is never replayed: a
            // person settles it outside our flow (action 14).
            logger.error(
                { refundId: input.refundId, key, addonInstanceId: call.addonInstanceId },
                'Order refund call left unanswered after the order channel was retired'
            );
            outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
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
                const cited = await readCitedProviderRefundIds(
                    matching.map((entry) => entry.refundId)
                );
                const candidates = matching.filter((entry) => !cited.has(entry.refundId));
                if (candidates.length !== 1) {
                    const ambiguous = new AmbiguousRefundAnswerError({
                        kind: 'PAYMENT',
                        refundId: input.refundId,
                        refundCallKey: key,
                        paymentId: payment.id,
                        providerFactId: payment.providerFactId,
                        expectedAmountMinor: call.amount,
                        reason:
                            candidates.length === 0
                                ? 'NO_UNNAMED_PAYMENT_REFUND'
                                : 'SEVERAL_UNNAMED_PAYMENT_REFUNDS',
                        candidates: candidates.map((entry) => ({
                            providerRefundId: entry.refundId,
                            amountMinor: entry.amount.amountMinor
                        }))
                    });
                    // HOS-2007: captured so the API's logger hook raises a Sentry alert; the call stays unanswered.
                    logger.error(ambiguous, ambiguous.message, { capture: true });
                    outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                    continue;
                }
                providerRefundId = candidates[0]!.refundId;
            }
            if ((await readCitedProviderRefundIds([providerRefundId])).has(providerRefundId)) {
                const cited = new AmbiguousRefundAnswerError({
                    kind: 'PAYMENT',
                    refundId: input.refundId,
                    refundCallKey: key,
                    paymentId: payment.id,
                    providerFactId: payment.providerFactId,
                    expectedAmountMinor: call.amount,
                    reason: 'PROVIDER_REFUND_ALREADY_CITED',
                    candidates: [{ providerRefundId, amountMinor: call.amount }]
                });
                // HOS-2517: binding an id already cited would count one provider refund twice.
                logger.error(cited, cited.message, { capture: true });
                outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                continue;
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
