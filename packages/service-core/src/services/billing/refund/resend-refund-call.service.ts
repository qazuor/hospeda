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
    refunds,
    sql
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct, PaymentProviderError } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import {
    AmbiguousRefundAnswerError,
    type AmbiguousRefundAnswerReason,
    type AmbiguousRefundCandidate
} from './ambiguous-refund-answer.error';
import { hasOtherUnansweredRefundCall } from './refund-call-tally';
import { completeCall } from './refund-provider-call';
import { failProviderRejectedRefund } from './refund-provider-rejection';

const logger = createLogger('resend-refund-call');

/** AC:B6:10 / TRANS:B:RF2: identifies the confirmed refund whose calls need replay. */
export type ResendRefundCallsInput = {
    readonly refundId: string;
    readonly correlationId?: string;
    /**
     * HOS-2516: calls persisted before this instant are never posted again. When the charge shows
     * no refund to bind such a call to, the whole resend is refused with
     * `REFUND_CALL_TOO_OLD_TO_RETRY` before any write. Absent, no limit applies.
     */
    readonly postCutoff?: Date;
};

/** AC:B6:10 / TRANS:B:RF2: provider and clock used for replay decisions. */
export type ResendRefundCallsPorts = { readonly provider: PaymentProvider; readonly clock: Clock };

/**
 * AC:B6:10 / TRANS:B:RF2: one persisted call's resend outcome. `FOUND_AT_PROVIDER` (HOS-2516):
 * the charge read before the resend showed exactly one uncited provider refund for the call's
 * amount, so the call was bound to it and NOT posted again. Like `SENT`, it means accepted, never
 * accredited: RF3 decides that from its own read.
 */
export type ResendRefundCallOutcome = {
    readonly idempotencyKey: string;
    readonly outcome:
        | 'SENT'
        | 'FOUND_AT_PROVIDER'
        | 'AWAITING_PROVIDER_ANSWER'
        | 'PROVIDER_KEY_CONFLICT'
        | 'PROVIDER_REJECTED_FAILED';
};

/** AC:B6:10 / TRANS:B:RF2: outcomes retain the original idempotency keys. */
export type ResendRefundCallsResult = {
    readonly refundId: string;
    readonly outcomes: readonly ResendRefundCallOutcome[];
};

type ConfirmedPayment = typeof payments.$inferSelect;

/**
 * HOS-2517: the provider refund ids among `ids` that already settle something of ours, either
 * as the panel reference of a refund (action 14, `PROVIDER_PANEL`), as the provider id of a
 * refund call, or as the provider id a call kept after the provider rejected it post-acceptance
 * (HOS-2516). Such an id must never be bound to another call.
 */
async function readCitedProviderRefundIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    if (ids.length === 0) return new Set();
    const db = getDb();
    const [called, settled, rejected] = await Promise.all([
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
            ),
        // A call whose refund the provider accepted and then rejected keeps that id only in its
        // stored result (`settleRefundRejectedAfterAcceptance` clears `provider_refund_id`). The
        // refund is still the other call's: it must never be bound to a different call.
        db
            .select({ id: sql<string | null>`${idempotencyKeys.result}->>'providerRefundId'` })
            .from(idempotencyKeys)
            .where(
                and(
                    sql`${idempotencyKeys.result}->>'code' = 'REJECTED_AFTER_ACCEPTANCE'`,
                    inArray(sql`${idempotencyKeys.result}->>'providerRefundId'`, [...ids])
                )
            )
    ]);
    return new Set(
        [...called, ...settled, ...rejected].flatMap(({ id }) => (id === null ? [] : [id]))
    );
}

/**
 * Reads the charge and returns the provider refunds for `amount` (in the payment's currency) that
 * nothing of ours cites: no refund's panel reference, no call's provider id. Used before posting a
 * resend and again after an answer without an id.
 *
 * `ambiguous` is true when there is such a candidate AND another refund of the same payment has a
 * call the provider has not answered ({@link hasOtherUnansweredRefundCall}): that call's provider
 * refund may be the uncited one, with the same amount, and binding it here would count the same
 * money twice (the HOS-2517 risk seen from the resend side). The read cannot tell them apart:
 * `ChargeRefund` does not expose the refund's reference (our idempotency key), so there is no
 * matching by key.
 *
 * The check runs AFTER the charge read, and that order is what makes it sound without a payment
 * lock: `persistCall` commits a call (unanswered) before its provider I/O, so any provider refund
 * the read shows belongs to a call already committed, which the check then sees (the causal order
 * documented with {@link hasOtherUnansweredRefundCall}, HOS-2517 / #4645).
 */
async function readUncitedProviderRefunds(input: {
    readonly ports: ResendRefundCallsPorts;
    readonly refundId: string;
    readonly payment: ConfirmedPayment;
    readonly amount: number;
}): Promise<{
    readonly candidates: readonly AmbiguousRefundCandidate[];
    readonly ambiguous: boolean;
}> {
    const act = { kind: 'decision' as const, startedAt: input.ports.clock.now() };
    actStartInstant({ act });
    const read = await input.ports.provider.readCharge({ chargeId: input.payment.providerFactId });
    const { snapshot } = assertFreshForAct({ read, act });
    const matching = snapshot.refunds.filter(
        (entry) =>
            entry.amount.amountMinor === input.amount &&
            entry.amount.currency === input.payment.currency
    );
    const cited = await readCitedProviderRefundIds(matching.map((entry) => entry.refundId));
    const candidates = matching
        .filter((entry) => !cited.has(entry.refundId))
        .map((entry) => ({
            providerRefundId: entry.refundId,
            amountMinor: entry.amount.amountMinor
        }));
    const ambiguous =
        candidates.length > 0 &&
        (await hasOtherUnansweredRefundCall({
            db: getDb(),
            paymentId: input.payment.id,
            exceptRefundId: input.refundId
        }));
    return { candidates, ambiguous };
}

/** Logs the answer that names no single refund of ours (HOS-2007): a Sentry capture, call kept unanswered. */
function alertAmbiguous(input: {
    readonly refundId: string;
    readonly key: string;
    readonly payment: ConfirmedPayment;
    readonly amount: number;
    readonly reason: AmbiguousRefundAnswerReason;
    readonly candidates: readonly AmbiguousRefundCandidate[];
}): void {
    const ambiguous = new AmbiguousRefundAnswerError({
        kind: 'PAYMENT',
        refundId: input.refundId,
        refundCallKey: input.key,
        paymentId: input.payment.id,
        providerFactId: input.payment.providerFactId,
        expectedAmountMinor: input.amount,
        reason: input.reason,
        candidates: input.candidates
    });
    // HOS-2007: captured so the API's logger hook raises a Sentry alert.
    logger.error(ambiguous, ambiguous.message, { capture: true });
}

/**
 * AC:B6:10 / TRANS:B:RF2: persisted calls retried with their original body and key; HOS-1636 supplies the production caller.
 *
 * HOS-2516: before posting a call again, the charge is read. How long the provider remembers a
 * refund's idempotency key is not measured (matrix row `EX-73`), so the key alone cannot be
 * trusted to stop a second refund. If the read shows exactly one uncited provider refund for the
 * call's amount, the lost call landed: it is bound to that refund and nothing is posted. Several
 * such refunds raise the ambiguity alert and post nothing. Only when none matches is the call
 * posted again, under its original key.
 */
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
            addonInstanceId: refundCalls.addonInstanceId,
            createdAt: refundCalls.createdAt
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(and(eq(refundCalls.refundId, input.refundId), isNull(idempotencyKeys.completedAt)));
    // Phase 1: read and decide, writing nothing. Each call's charge read happens here.
    const plans: CallPlan[] = [];
    const chosen = new Set<string>();
    for (const call of pending) {
        const plan = await planCall({ call, refundId: input.refundId, payment, ports, chosen });
        if (plan.action === 'BIND') chosen.add(plan.providerRefundId);
        plans.push(plan);
    }
    // HOS-2516 review (owner intent): the 24-hour limit guards REPOSTING under a key the provider
    // may have forgotten (EX-73), nothing else. Reading, binding a refund found on the charge and
    // RF3 still run past it. A post on a call older than the cutoff refuses the whole resend here,
    // before any write or alert, so the refusal leaves nothing half done.
    if (
        input.postCutoff &&
        plans.some(
            (plan) => plan.action === 'POST' && plan.call.createdAt < (input.postCutoff as Date)
        )
    )
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'An unanswered call that would be posted again was sent more than 24 hours ago, and the charge shows no refund to bind it to; follow the refunds runbook §8.1/§8.2',
            undefined,
            'REFUND_CALL_TOO_OLD_TO_RETRY'
        );
    // Phase 2: act on each plan.
    const outcomes: ResendRefundCallOutcome[] = [];
    for (const plan of plans) {
        const key = plan.call.idempotencyKey;
        const context = { refundId: input.refundId, key, payment, amount: plan.call.amount };
        if (plan.action === 'AWAIT') {
            outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
            continue;
        }
        if (plan.action === 'ALERT') {
            alertAmbiguous({ ...context, reason: plan.reason, candidates: plan.candidates });
            outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
            continue;
        }
        if (plan.action === 'BIND') {
            // A chargeback may have moved the refund out of CONFIRMED since it was read: never
            // bind a call of a refund that is no longer waiting for one.
            const [current] = await db
                .select({ status: refunds.status })
                .from(refunds)
                .where(eq(refunds.id, input.refundId))
                .limit(1);
            if (current?.status !== 'CONFIRMED') {
                outcomes.push({ idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' });
                continue;
            }
            await completeCall(
                key,
                { outcome: 'ACCEPTED', providerRefundId: plan.providerRefundId },
                ports.clock,
                plan.providerRefundId
            );
            outcomes.push({ idempotencyKey: key, outcome: 'FOUND_AT_PROVIDER' });
            continue;
        }
        outcomes.push(await postCall({ refund, payment, call: plan.call, context, input, ports }));
    }
    return { refundId: input.refundId, outcomes };
}

type PendingCall = {
    readonly idempotencyKey: string;
    readonly amount: number;
    readonly addonInstanceId: string | null;
    readonly createdAt: Date;
};

/** What phase 1 decided for one unanswered call. */
type CallPlan =
    | { readonly call: PendingCall; readonly action: 'AWAIT' }
    | {
          readonly call: PendingCall;
          readonly action: 'ALERT';
          readonly reason: AmbiguousRefundAnswerReason;
          readonly candidates: readonly AmbiguousRefundCandidate[];
      }
    | { readonly call: PendingCall; readonly action: 'BIND'; readonly providerRefundId: string }
    | { readonly call: PendingCall; readonly action: 'POST' };

/** Reads the charge for one call and decides what to do with it, writing nothing. */
async function planCall(input: {
    readonly call: PendingCall;
    readonly refundId: string;
    readonly payment: ConfirmedPayment;
    readonly ports: ResendRefundCallsPorts;
    /** Provider refunds already planned to be bound by an earlier call of this resend. */
    readonly chosen: ReadonlySet<string>;
}): Promise<CallPlan> {
    const { call } = input;
    const key = call.idempotencyKey;
    if (call.addonInstanceId) {
        // A call tied to an instance was an order refund call. The order channel was retired
        // (HOS-2179 T-7) with none left unanswered, so it is never replayed. Only a REQUESTED
        // refund can be declined, via action 14; a CONFIRMED refund with a live call like this
        // one has no exit in our flow.
        logger.error(
            { refundId: input.refundId, key, addonInstanceId: call.addonInstanceId },
            'Order refund call left unanswered after the order channel was retired'
        );
        return { call, action: 'AWAIT' };
    }
    let landed: Awaited<ReturnType<typeof readUncitedProviderRefunds>>;
    try {
        landed = await readUncitedProviderRefunds({
            ports: input.ports,
            refundId: input.refundId,
            payment: input.payment,
            amount: call.amount
        });
    } catch (error) {
        // Without the read we cannot tell whether the lost call landed, so nothing is posted.
        logger.error(
            { refundId: input.refundId, key, error },
            'Charge read before a refund call resend failed'
        );
        return { call, action: 'AWAIT' };
    }
    if (landed.ambiguous)
        return {
            call,
            action: 'ALERT',
            reason: 'OTHER_REFUND_CALL_UNANSWERED',
            candidates: landed.candidates
        };
    const candidates = landed.candidates.filter(
        (candidate) => !input.chosen.has(candidate.providerRefundId)
    );
    if (candidates.length > 1)
        return { call, action: 'ALERT', reason: 'SEVERAL_UNNAMED_PAYMENT_REFUNDS', candidates };
    const found = candidates[0];
    if (found) return { call, action: 'BIND', providerRefundId: found.providerRefundId };
    return { call, action: 'POST' };
}

/** Posts one call again under its original key and records the answer (phase 2). */
async function postCall(args: {
    readonly refund: typeof refunds.$inferSelect;
    readonly payment: ConfirmedPayment;
    readonly call: PendingCall;
    readonly context: {
        readonly refundId: string;
        readonly key: string;
        readonly payment: ConfirmedPayment;
        readonly amount: number;
    };
    readonly input: ResendRefundCallsInput;
    readonly ports: ResendRefundCallsPorts;
}): Promise<ResendRefundCallOutcome> {
    const { refund, payment, call, context, input, ports } = args;
    const key = call.idempotencyKey;
    const awaiting = { idempotencyKey: key, outcome: 'AWAITING_PROVIDER_ANSWER' } as const;
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
            const { candidates, ambiguous } = await readUncitedProviderRefunds({
                ports,
                refundId: input.refundId,
                payment,
                amount: call.amount
            });
            if (ambiguous) {
                alertAmbiguous({ ...context, reason: 'OTHER_REFUND_CALL_UNANSWERED', candidates });
                return awaiting;
            }
            const [only] = candidates;
            if (candidates.length !== 1 || !only) {
                alertAmbiguous({
                    ...context,
                    reason:
                        candidates.length === 0
                            ? 'NO_UNNAMED_PAYMENT_REFUND'
                            : 'SEVERAL_UNNAMED_PAYMENT_REFUNDS',
                    candidates
                });
                return awaiting;
            }
            providerRefundId = only.providerRefundId;
        }
        if ((await readCitedProviderRefundIds([providerRefundId])).has(providerRefundId)) {
            // HOS-2517: binding an id already cited would count one provider refund twice.
            alertAmbiguous({
                ...context,
                reason: 'PROVIDER_REFUND_ALREADY_CITED',
                candidates: [{ providerRefundId, amountMinor: call.amount }]
            });
            return awaiting;
        }
        await completeCall(
            key,
            { outcome: 'ACCEPTED', providerRefundId },
            ports.clock,
            providerRefundId
        );
        return { idempotencyKey: key, outcome: 'SENT' };
    } catch (error) {
        if (!(error instanceof PaymentProviderError) && providerCallPending) {
            logger.error(
                { refundId: input.refundId, key, error },
                'Payment refund resend unavailable'
            );
            return awaiting;
        }
        if (!(error instanceof PaymentProviderError)) throw error;
        if (error.code === 'UNAVAILABLE') return awaiting;
        if (error.code === 'REJECTED' && error.refundRefusal === 'KEY_REUSED')
            return { idempotencyKey: key, outcome: 'PROVIDER_KEY_CONFLICT' };
        if (error.code === 'REJECTED' || error.code === 'NOT_FOUND') {
            await completeCall(key, { outcome: 'REJECTED', code: error.code }, ports.clock);
            await failProviderRejectedRefund({
                refund,
                payment,
                clock: ports.clock,
                correlationId: input.correlationId ?? crypto.randomUUID()
            });
            return { idempotencyKey: key, outcome: 'PROVIDER_REJECTED_FAILED' };
        }
        throw error;
    }
}
