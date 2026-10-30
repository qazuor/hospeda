import { eq, getDb, subscriptions } from '@repo/db';

/** Read a subscription and its account subject from the persisted row. */
export async function readSubscription(subscriptionId: string) {
    const [row] = await getDb()
        .select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            class: subscriptions.class,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt,
            serviceEndsAt: subscriptions.serviceEndsAt,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);
    return row ? { row, subjectId: row.userId } : null;
}
