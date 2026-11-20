import type { DrizzleClient } from '@repo/db';
import {
    and,
    eq,
    getDb,
    idempotencyKeys,
    isNotNull,
    isNull,
    or,
    refundCalls,
    refunds
} from '@repo/db';
import { type AnyColumn, exists, notExists, type SQL } from 'drizzle-orm';

/**
 * The calls of one refund that may have moved money: one the provider accepted
 * (`provider_refund_id` set) or one still unanswered (no stored idempotency result, which includes
 * a call persisted right before its POST). This is the single home of that rule; every reader
 * below builds on it.
 */
function liveProviderCalls(refundId: AnyColumn | string) {
    return getDb()
        .select({ one: refundCalls.id })
        .from(refundCalls)
        .leftJoin(idempotencyKeys, eq(idempotencyKeys.key, refundCalls.idempotencyKey))
        .where(
            and(
                eq(refundCalls.refundId, refundId),
                or(isNotNull(refundCalls.providerRefundId), isNull(idempotencyKeys.result))
            )
        );
}

/**
 * SQL condition: the refund has a call the provider accepted or has not answered yet.
 *
 * @param refundId - The `refund.id` column of the row being read, or one refund id
 * @returns A condition true when such a call exists
 */
export function hasLiveProviderCallSql(refundId: AnyColumn | string): SQL {
    return exists(liveProviderCalls(refundId));
}

/**
 * SQL condition: the refund has no accepted or unanswered call. A `CONFIRMED` refund for which this
 * holds sent nothing that could succeed, so it can be failed (RF5) like a `REQUESTED` one.
 *
 * @param refundId - The `refund.id` column of the row being read, or one refund id
 * @returns A condition true when no such call exists
 */
export function noLiveProviderCallSql(refundId: AnyColumn | string): SQL {
    return notExists(liveProviderCalls(refundId));
}

/**
 * Whether a refund may already have moved money at the provider, by {@link hasLiveProviderCallSql}.
 * A `CONFIRMED` refund for which this is false can be failed (RF5).
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
    const [row] = await input.tx
        .select({ live: hasLiveProviderCallSql(refunds.id) })
        .from(refunds)
        .where(eq(refunds.id, input.refundId))
        .limit(1);
    return row?.live === true;
}
