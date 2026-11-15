import type { Clock } from '@repo/billing-verticals-contract';
import type { SelectPayment, SelectRefund } from '@repo/db';
import { eq, getDb, idempotencyKeys, refundCalls, refunds } from '@repo/db';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { claimedRefundAmount } from './refund-source';

type Attempt = {
    readonly amount: number;
    readonly providerRefundId: string | null;
    readonly answered: boolean;
    readonly refusal: 'AMOUNT_NOT_ACCEPTED' | null;
    readonly rejected: boolean;
};

function publicCalls(calls: readonly Attempt[]): readonly {
    readonly amount: number;
    readonly providerRefundId: string | null;
    readonly answered: boolean;
}[] {
    return calls.map(({ amount, providerRefundId, answered }) => ({
        amount,
        providerRefundId,
        answered
    }));
}
function stateChanged(): ServiceError {
    return new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'Refund state changed before provider call',
        undefined,
        'REFUND_STATE_CHANGED'
    );
}

/** Persists an RF2 call and key before provider I/O (AC:B6:8, TRANS:B:RF2). */
export async function persistCall(
    refundId: string,
    payment: SelectPayment,
    amount: number,
    addonInstanceId: string | null = null
): Promise<{ readonly key: string; readonly balance: number }> {
    return getDb().transaction(async (tx) => {
        const [refund] = await tx
            .select()
            .from(refunds)
            .where(eq(refunds.id, refundId))
            .limit(1)
            .for('update');
        if (refund?.status !== 'CONFIRMED') throw stateChanged();
        const rows = await tx
            .select({ id: refundCalls.id })
            .from(refundCalls)
            .where(eq(refundCalls.refundId, refundId));
        const key = `refund:${refundId}:${rows.length + 1}`;
        const claimed = await claimedRefundAmount({
            tx,
            source: { kind: 'PAYMENT', id: payment.id },
            excludeRefundId: refundId
        });
        await tx
            .insert(idempotencyKeys)
            .values({ key, operation: 'REFUND_CREATE', subjectId: refundId });
        await tx.insert(refundCalls).values({
            refundId,
            idempotencyKey: key,
            amount,
            providerRefundId: null,
            addonInstanceId
        });
        return { key, balance: payment.amount - claimed };
    });
}

/** Completes one persisted RF2 call (AC:B6:8, TRANS:B:RF2). */
export async function completeCall(
    key: string,
    result:
        | { readonly outcome: 'ACCEPTED'; readonly providerRefundId: string }
        | {
              readonly outcome: 'REJECTED';
              readonly refusal?: 'AMOUNT_NOT_ACCEPTED';
              readonly code?: string;
          },
    clock: Clock,
    providerRefundId?: string
): Promise<void> {
    await getDb().transaction(async (tx) => {
        if (providerRefundId) {
            await tx
                .update(refundCalls)
                .set({ providerRefundId })
                .where(eq(refundCalls.idempotencyKey, key));
        }
        await tx
            .update(idempotencyKeys)
            .set({ result, completedAt: clock.now() })
            .where(eq(idempotencyKeys.key, key));
    });
}

async function callOnce(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly amount: number;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<Attempt & { readonly balance: number }> {
    const persisted = await persistCall(input.refund.id, input.payment, input.amount);
    const { key, balance } = persisted;
    if (input.amount > input.refund.amount) throw new Error('Refund call exceeds confirmed amount');
    try {
        const response = await input.provider.refund({
            chargeId: input.payment.providerFactId,
            amount: { amountMinor: input.amount, currency: input.payment.currency },
            reference: key
        });
        if (response.refundId.length === 0)
            return {
                amount: input.amount,
                providerRefundId: null,
                answered: false,
                refusal: null,
                rejected: false,
                balance
            };
        await completeCall(
            key,
            { outcome: 'ACCEPTED', providerRefundId: response.refundId },
            input.clock,
            response.refundId
        );
        return {
            amount: input.amount,
            providerRefundId: response.refundId,
            answered: true,
            refusal: null,
            rejected: false,
            balance
        };
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) {
            const cause = extractPostgresErrorCause(error);
            if (cause?.code === '23505' && cause.constraint === 'uq_refund_call_provider_refund_id')
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Provider refund id is already recorded',
                    undefined,
                    'REFUND_PROVIDER_ID_ALREADY_RECORDED'
                );
            throw error;
        }
        if (error.code === 'UNAVAILABLE')
            return {
                amount: input.amount,
                providerRefundId: null,
                answered: false,
                refusal: null,
                rejected: false,
                balance
            };
        const refusal =
            error.refundRefusal === 'AMOUNT_NOT_ACCEPTED' ? 'AMOUNT_NOT_ACCEPTED' : undefined;
        if (error.code === 'REJECTED' || error.code === 'NOT_FOUND') {
            await completeCall(
                key,
                refusal
                    ? { outcome: 'REJECTED', refusal }
                    : { outcome: 'REJECTED', code: error.code },
                input.clock
            );
            return {
                amount: input.amount,
                providerRefundId: null,
                answered: true,
                refusal: refusal ?? null,
                rejected: true,
                balance
            };
        }
        throw error;
    }
}

/** Persists each idempotency key before one provider refund call and records answered results. */
export async function sendRefundCalls(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<{
    readonly outcome:
        | 'SENT'
        | 'NOT_ACCEPTED_KEPT_CONFIRMED'
        | 'PROVIDER_REJECTED_KEPT_CONFIRMED'
        | 'PROVIDER_REJECTED_FAILED'
        | 'AWAITING_PROVIDER_ANSWER';
    readonly calls: readonly {
        readonly amount: number;
        readonly providerRefundId: string | null;
        readonly answered: boolean;
    }[];
}> {
    const { refund, payment } = input;
    const calls: Attempt[] = [];
    const first = await callOnce({
        refund,
        payment,
        amount: refund.amount,
        provider: input.provider,
        clock: input.clock
    });
    calls.push(first);
    if (!first.answered) return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: publicCalls(calls) };
    if (!first.refusal)
        return {
            outcome: first.providerRefundId ? 'SENT' : 'PROVIDER_REJECTED_FAILED',
            calls: publicCalls(calls)
        };
    const isTotal = refund.amount === first.balance;
    if (refund.amount === 1) {
        if (isTotal) {
            const retry = await callOnce({
                refund,
                payment,
                amount: refund.amount,
                provider: input.provider,
                clock: input.clock
            });
            calls.push(retry);
            return {
                outcome: retry.providerRefundId
                    ? 'SENT'
                    : retry.answered
                      ? 'NOT_ACCEPTED_KEPT_CONFIRMED'
                      : 'AWAITING_PROVIDER_ANSWER',
                calls: publicCalls(calls)
            };
        }
        return { outcome: 'NOT_ACCEPTED_KEPT_CONFIRMED', calls: publicCalls(calls) };
    }
    const parts = [Math.ceil(refund.amount / 2), Math.floor(refund.amount / 2)];
    let accepted = 0;
    for (const amount of parts) {
        if (accepted + amount > refund.amount)
            throw new Error('Refund retry amount exceeds confirmed amount');
        const attempt = await callOnce({
            refund,
            payment,
            amount,
            provider: input.provider,
            clock: input.clock
        });
        calls.push(attempt);
        if (!attempt.answered)
            return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: publicCalls(calls) };
        if (attempt.providerRefundId) accepted += amount;
        if (attempt.refusal || attempt.rejected) break;
    }
    if (accepted === 0 && isTotal) {
        if (accepted + refund.amount > refund.amount)
            throw new Error('Refund retry amount exceeds confirmed amount');
        const retry = await callOnce({
            refund,
            payment,
            amount: refund.amount,
            provider: input.provider,
            clock: input.clock
        });
        calls.push(retry);
        if (!retry.answered)
            return { outcome: 'AWAITING_PROVIDER_ANSWER', calls: publicCalls(calls) };
        if (retry.providerRefundId) accepted += refund.amount;
    }
    if (accepted === refund.amount) return { outcome: 'SENT', calls: publicCalls(calls) };
    if (accepted === 0 && calls.some((call) => call.rejected && call.refusal === null))
        return { outcome: 'PROVIDER_REJECTED_FAILED', calls: publicCalls(calls) };
    return {
        outcome: accepted > 0 ? 'PROVIDER_REJECTED_KEPT_CONFIRMED' : 'NOT_ACCEPTED_KEPT_CONFIRMED',
        calls: publicCalls(calls)
    };
}
