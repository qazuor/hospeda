import type { DrizzleClient } from '@repo/db';
import { and, eq, idempotencyKeys, inArray, ne, refundCalls, refunds, sql } from '@repo/db';

/**
 * How long after a call was sent "Retry with MP" may still POST it again (owner decision on
 * #4643, HOS-2516). The resend reads the charge first, but a provider read that lags behind a
 * refund it already made, combined with a provider that has forgotten the idempotency key, could
 * still post a second refund (matrix row EX-73, `UNKNOWN`). Inside 24 hours the key is the cover.
 * Past it, only the POST is refused (`REFUND_CALL_TOO_OLD_TO_RETRY`): reading the charge, binding
 * a refund found there, the accepted-then-rejected check and RF3 still run.
 *
 * The same limit opens the other exit (HOS-2538): only a call older than this may be settled by
 * action 14 from the provider panel (the remainder settlement), so a call is always in exactly
 * one of the two exits, the retry's POST (`created_at >= now - limit`) or the panel
 * (`created_at < now - limit`). This limit can be relaxed once EX-73 is measured.
 */
export const REFUND_CALL_RETRY_LIMIT_MS = 24 * 60 * 60 * 1000;

/**
 * The instant before which a call is past the retry limit: a call persisted strictly before it
 * may no longer be posted again, and may be settled from the provider panel instead (HOS-2538).
 *
 * @param input.now - The current instant, from the injected clock.
 * @returns `now - REFUND_CALL_RETRY_LIMIT_MS`.
 */
export function refundCallRetryCutoff(input: { readonly now: Date }): Date {
    return new Date(input.now.getTime() - REFUND_CALL_RETRY_LIMIT_MS);
}

/**
 * The stored result code of a call that action 14 answered by hand (HOS-2538): the call was past
 * the retry limit with no answer, and a person settled its refund from the provider panel. The
 * call moved no money we can name (the panel refund the person cited carries it, on the refund
 * row), it is answered, never resent and never bound to a provider refund afterwards.
 */
export const SETTLED_EXTERNALLY = 'SETTLED_EXTERNALLY' as const;

/** One persisted provider call of a refund, with its idempotency outcome. */
export type RefundCallRow = {
    readonly idempotencyKey: string;
    readonly providerRefundId: string | null;
    readonly addonInstanceId: string | null;
    readonly amount: number;
    /** When the call was persisted, right before it was sent to the provider. */
    readonly createdAt: Date;
    readonly completedAt: Date | null;
    readonly result: unknown;
};

/** How the provider answered the calls of one refund. */
export type RefundCallTally = {
    readonly calls: readonly RefundCallRow[];
    /** Provider refund ids of the calls the provider accepted. */
    readonly acceptedIds: readonly string[];
    /** Sum, in cents, of the calls the provider accepted. */
    readonly acceptedAmount: number;
    /** True while any call is unanswered (or answered without an id and not as a rejection). */
    readonly awaitingProviderAnswer: boolean;
    /** The calls still unanswered, by {@link isUnanswered}. */
    readonly unanswered: readonly RefundCallRow[];
};

function hasOutcome(value: unknown, outcome: string): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        'outcome' in value &&
        value.outcome === outcome
    );
}

function isRejectedResult(value: unknown): boolean {
    return hasOutcome(value, 'REJECTED');
}

/** Whether a stored call result is action 14's answer for a stale call (HOS-2538). */
export function isSettledExternallyResult(value: unknown): boolean {
    return hasOutcome(value, SETTLED_EXTERNALLY);
}

/**
 * Reads and classifies the provider calls of one refund: accepted (it carries a
 * `provider_refund_id`), rejected (completed with a `REJECTED` result and no id) or
 * still awaiting an answer. The single home of the rule RF3 and the remainder
 * settlement (HOS-2406) both decide on.
 *
 * @param input.db - The connection or transaction to read with.
 * @param input.refundId - The refund whose calls are read.
 * @returns The calls and their tally.
 */
export async function readRefundCallTally(input: {
    readonly db: DrizzleClient;
    readonly refundId: string;
}): Promise<RefundCallTally> {
    const calls: readonly RefundCallRow[] = await input.db
        .select({
            idempotencyKey: refundCalls.idempotencyKey,
            providerRefundId: refundCalls.providerRefundId,
            addonInstanceId: refundCalls.addonInstanceId,
            amount: refundCalls.amount,
            createdAt: refundCalls.createdAt,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.refundId, input.refundId));
    const accepted = calls.filter((call) => call.providerRefundId !== null);
    const unanswered = calls.filter(isUnanswered);
    return {
        calls,
        acceptedIds: accepted.flatMap((call) =>
            call.providerRefundId === null ? [] : [call.providerRefundId]
        ),
        acceptedAmount: accepted.reduce((sum, call) => sum + call.amount, 0),
        awaitingProviderAnswer: unanswered.length > 0,
        unanswered
    };
}

/**
 * True while the provider has not answered a call: it is not completed, or it completed without a
 * provider refund id and not as a rejection (UNAVAILABLE, an empty body). Such a call may already
 * have a refund at the provider whose id has not been written yet. A call action 14 settled by
 * hand ({@link SETTLED_EXTERNALLY}, HOS-2538) is answered.
 */
function isUnanswered(call: Pick<RefundCallRow, 'providerRefundId' | 'completedAt' | 'result'>) {
    if (call.completedAt === null) return true;
    return (
        call.providerRefundId === null &&
        !isRejectedResult(call.result) &&
        !isSettledExternallyResult(call.result)
    );
}

/**
 * HOS-2517: the provider refund ids among `ids` that already settle something of ours, either
 * as the panel reference of a refund (action 14, `PROVIDER_PANEL`), as the provider id of a
 * refund call, or as the provider id a call kept after the provider rejected it post-acceptance
 * (HOS-2516). Such an id must never be bound to another call, nor cited by action 14 again.
 *
 * @param input.db - The connection or transaction to read with.
 * @param input.ids - The provider refund ids to check.
 * @returns The subset of `ids` that is already cited.
 */
export async function readCitedProviderRefundIds(input: {
    readonly db: DrizzleClient;
    readonly ids: readonly string[];
}): Promise<ReadonlySet<string>> {
    const { db, ids } = input;
    if (ids.length === 0) return new Set();
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
 * HOS-2517 — whether another refund of the same payment has a provider call still unanswered. Its
 * provider refund may already be credited on the charge with no id written on our side, so a
 * person could cite it as someone else's panel refund and the same money would count twice once
 * `completeCall` or a resend writes the id.
 *
 * What makes this check sufficient is CAUSAL ORDER, not a lock: `persistCall` locks only its own
 * refund (never the payment) and commits the call BEFORE any I/O to the provider, and the remainder
 * settlement reads the charge BEFORE the transaction that runs this check. So every provider refund
 * in that read comes from a call already committed, which this query sees; a call committed later
 * has no refund in the read, and citing it answers `REMAINDER_NOT_FOUND_AT_PROVIDER`. Reading the
 * charge inside or after this check breaks that guarantee.
 *
 * Every status counts, FAILED included: a chargeback fails a `CONFIRMED` refund with its call still
 * unanswered (`refund-chargeback.ts`), and the resend requires `CONFIRMED`, so that call is never
 * answered and the payment's remainder can no longer be settled through this route. Accepted:
 * that payment already went through a chargeback, which a person handles by hand.
 *
 * @param input.db - The connection or transaction to read with.
 * @param input.paymentId - The payment whose refunds are read.
 * @param input.exceptRefundId - The refund being decided, left out.
 * @returns True when any other refund of the payment, in any status, has an unanswered call.
 */
export async function hasOtherUnansweredRefundCall(input: {
    readonly db: DrizzleClient;
    readonly paymentId: string;
    readonly exceptRefundId: string;
}): Promise<boolean> {
    const calls = await input.db
        .select({
            providerRefundId: refundCalls.providerRefundId,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(refunds, eq(refundCalls.refundId, refunds.id))
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(and(eq(refunds.paymentId, input.paymentId), ne(refunds.id, input.exceptRefundId)));
    return calls.some(isUnanswered);
}
