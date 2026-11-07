import { type DrizzleClient, eq, sql, subscriptions } from '@repo/db';

/**
 * The only predicate for "a version with customers" in administrative action 19.
 * Every anchored subscription counts, regardless of status or class.
 * HOS-1628 (AC:B2:12 / AC:B3:40) will add a row anchored to another version
 * with an S38 queued toward this version in subscription_scheduled_change.
 */
export async function countPlanVersionCustomers(args: {
    readonly tx: DrizzleClient;
    readonly planVersionId: string;
}): Promise<number> {
    const [row] = await args.tx
        .select({ total: sql<number>`count(*)::int` })
        .from(subscriptions)
        .where(eq(subscriptions.planVersionId, args.planVersionId));
    return row?.total ?? 0;
}
