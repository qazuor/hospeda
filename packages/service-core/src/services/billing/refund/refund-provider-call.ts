import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, SelectPayment, SelectRefund } from '@repo/db';
import { and, eq, getDb, idempotencyKeys, refundCalls, refunds, sql } from '@repo/db';
import { createLogger } from '@repo/logger';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { SETTLED_EXTERNALLY } from './refund-call-tally';
import { describeProviderRejection } from './refund-provider-rejection-reason';
import { claimedRefundAmount } from './refund-source';
import { UncountedRefundAnswerError } from './uncounted-refund-answer.error';

const logger = createLogger('refund-provider-call');

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
    /** When the call is sent, from the injected clock (HOS-2516: the retry's 24-hour limit reads it). */
    sentAt?: Date
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
            ...(sentAt ? { createdAt: sentAt } : {})
        });
        return { key, balance: payment.amount - claimed };
    });
}

/**
 * A late answer for a call action 14 already settled from the panel (HOS-2538). An answer that
 * names a provider refund is money returned that nothing counts: it is captured as
 * {@link UncountedRefundAnswerError} (a Sentry alert). One without an id moved nothing we can name,
 * and is only logged.
 */
async function reportAnswerForSettledCall(input: {
    readonly tx: DrizzleClient;
    readonly key: string;
    readonly providerRefundId: string | undefined;
}): Promise<void> {
    const { tx, key, providerRefundId } = input;
    if (!providerRefundId) {
        logger.warn({ key }, 'Late answer without a refund id for a call settled by action 14');
        return;
    }
    const [call] = await tx
        .select({
            refundId: refundCalls.refundId,
            panelReference: sql<string | null>`${idempotencyKeys.result}->>'panelReference'`
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.idempotencyKey, key))
        .limit(1);
    const uncounted = new UncountedRefundAnswerError({
        reason: 'ANSWER_FOR_SETTLED_EXTERNALLY_CALL',
        refundCallKey: key,
        refundId: call?.refundId ?? null,
        providerRefundId,
        panelReference: call?.panelReference ?? null
    });
    // Captured so the API's logger hook raises a Sentry alert (refunds runbook §8.4).
    logger.error(uncounted, uncounted.message, { capture: true });
}

/**
 * Completes one persisted RF2 call (AC:B6:8, TRANS:B:RF2).
 *
 * A call action 14 already answered by hand (`SETTLED_EXTERNALLY`, HOS-2538) is left as it is:
 * its refund was settled from the provider panel, so a late answer (a resend in flight, a lagging
 * response) must neither overwrite that answer nor bind a provider refund to the call. An answer
 * naming a provider refund raises the {@link UncountedRefundAnswerError} alert instead.
 */
export async function completeCall(
    key: string,
    result:
        | { readonly outcome: 'ACCEPTED'; readonly providerRefundId: string }
        | {
              readonly outcome: 'REJECTED';
              readonly refusal?: 'AMOUNT_NOT_ACCEPTED';
              readonly code?: string;
              readonly message?: string;
              readonly cause?: unknown;
          },
    clock: Clock,
    providerRefundId?: string
): Promise<void> {
    await getDb().transaction(async (tx: DrizzleClient) => {
        const [completed] = await tx
            .update(idempotencyKeys)
            .set({ result, completedAt: clock.now() })
            .where(
                and(
                    eq(idempotencyKeys.key, key),
                    sql`(${idempotencyKeys.result} IS NULL OR ${idempotencyKeys.result}->>'outcome' IS DISTINCT FROM ${SETTLED_EXTERNALLY})`
                )
            )
            .returning({ key: idempotencyKeys.key });
        if (!completed) {
            await reportAnswerForSettledCall({
                tx,
                key,
                providerRefundId:
                    providerRefundId ??
                    (result.outcome === 'ACCEPTED' ? result.providerRefundId : undefined)
            });
            return;
        }
        if (providerRefundId) {
            await tx
                .update(refundCalls)
                .set({ providerRefundId })
                .where(eq(refundCalls.idempotencyKey, key));
        }
    });
}

async function callOnce(input: {
    readonly refund: SelectRefund;
    readonly payment: SelectPayment;
    readonly amount: number;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<Attempt & { readonly balance: number }> {
    const persisted = await persistCall(
        input.refund.id,
        input.payment,
        input.amount,
        input.clock.now()
    );
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
            const rejection = describeProviderRejection({ error });
            logger.warn(
                { refundId: input.refund.id, key, code: error.code, ...rejection },
                'Provider rejected refund'
            );
            await completeCall(
                key,
                {
                    outcome: 'REJECTED',
                    code: error.code,
                    ...rejection,
                    ...(refusal ? { refusal } : {})
                },
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
