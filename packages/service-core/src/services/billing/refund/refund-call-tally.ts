import type { DrizzleClient } from '@repo/db';
import { and, eq, idempotencyKeys, ne, refundCalls, refunds } from '@repo/db';

/** One persisted provider call of a refund, with its idempotency outcome. */
export type RefundCallRow = {
    readonly providerRefundId: string | null;
    readonly addonInstanceId: string | null;
    readonly amount: number;
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
};

function isRejectedResult(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        'outcome' in value &&
        value.outcome === 'REJECTED'
    );
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
            providerRefundId: refundCalls.providerRefundId,
            addonInstanceId: refundCalls.addonInstanceId,
            amount: refundCalls.amount,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.refundId, input.refundId));
    const accepted = calls.filter((call) => call.providerRefundId !== null);
    const rejectedCount = calls.filter(
        (call) =>
            call.providerRefundId === null &&
            call.completedAt !== null &&
            isRejectedResult(call.result)
    ).length;
    return {
        calls,
        acceptedIds: accepted.flatMap((call) =>
            call.providerRefundId === null ? [] : [call.providerRefundId]
        ),
        acceptedAmount: accepted.reduce((sum, call) => sum + call.amount, 0),
        awaitingProviderAnswer:
            calls.some((call) => call.completedAt === null) ||
            accepted.length + rejectedCount !== calls.length
    };
}

/**
 * True while the provider has not answered a call: it is not completed, or it completed without a
 * provider refund id and not as a rejection (UNAVAILABLE, an empty body). Such a call may already
 * have a refund at the provider whose id has not been written yet.
 */
function isUnanswered(call: Pick<RefundCallRow, 'providerRefundId' | 'completedAt' | 'result'>) {
    if (call.completedAt === null) return true;
    return call.providerRefundId === null && !isRejectedResult(call.result);
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
