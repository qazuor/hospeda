import {
    type DrizzleClient,
    eq,
    inArray,
    or,
    sql,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';

/**
 * The only predicate for "a version with customers" in administrative action 19
 * (AC:B2:12, AC:B3:40). A subscription counts once when it is anchored to the
 * version, regardless of status or class, or when its queued S38 entry in
 * subscription_scheduled_change targets the version (DEC-MP-002 📌4: a queued
 * downgrade is a customer of its destination). The queue has no status column:
 * an applied S38 re-anchors the row and deletes the entry, and a cancelled one
 * deletes it, so every entry still present is pending, overdue and exhausted
 * entries included.
 *
 * @param args.tx - The client or transaction the caller reads with.
 * @param args.planVersionId - The plan version whose price would change.
 * @returns How many distinct subscriptions are customers of the version.
 */
export async function countPlanVersionCustomers(args: {
    readonly tx: DrizzleClient;
    readonly planVersionId: string;
}): Promise<number> {
    const queuedTowardVersion = args.tx
        .select({ subscriptionId: subscriptionScheduledChanges.subscriptionId })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.targetPlanVersionId, args.planVersionId));
    const [row] = await args.tx
        .select({ total: sql<number>`count(*)::int` })
        .from(subscriptions)
        .where(
            or(
                eq(subscriptions.planVersionId, args.planVersionId),
                inArray(subscriptions.id, queuedTowardVersion)
            )
        );
    return row?.total ?? 0;
}
