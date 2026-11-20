import type { DrizzleClient } from '@repo/db';
import { eq, idempotencyKeys, refundCalls } from '@repo/db';

/**
 * Whether a refund may already have moved money at the provider: it has a call the provider
 * accepted (`provider_refund_id` set) or a call still unanswered (no stored idempotency result,
 * which includes a call persisted right before its POST). A `CONFIRMED` refund for which this is
 * false sent nothing that could succeed, so it can be failed (RF5) like a `REQUESTED` one.
 *
 * Failing it is safe against an action 13 still in flight: every provider call is persisted under
 * the refund's own row lock and only while the refund is `CONFIRMED` (`persistCall`), so a refund
 * failed under that lock never gets a call.
 *
 * @param input.tx - The caller's transaction, holding the refund `FOR UPDATE`
 * @param input.refundId - The refund to inspect
 * @returns `true` when an accepted or unanswered provider call exists
 */
export async function refundHasLiveProviderCalls(input: {
    readonly tx: DrizzleClient;
    readonly refundId: string;
}): Promise<boolean> {
    const calls = await input.tx
        .select({
            providerRefundId: refundCalls.providerRefundId,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .leftJoin(idempotencyKeys, eq(idempotencyKeys.key, refundCalls.idempotencyKey))
        .where(eq(refundCalls.refundId, input.refundId));
    return calls.some((call) => call.providerRefundId !== null || call.result === null);
}
