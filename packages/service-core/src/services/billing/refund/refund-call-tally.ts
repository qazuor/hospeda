import type { DrizzleClient } from '@repo/db';
import { eq, idempotencyKeys, refundCalls } from '@repo/db';

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
