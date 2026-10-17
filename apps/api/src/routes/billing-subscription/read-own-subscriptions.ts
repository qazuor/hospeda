import { and, asc, eq, getDb, inArray, SUBSCRIPTION_STATUSES, subscriptions } from '@repo/db';

/** Read the owner's principal subscriptions that have a self-service cancellation surface. */
export async function readOwnSubscriptions(userId: string) {
    const statuses = SUBSCRIPTION_STATUSES.filter((status) =>
        ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED'].includes(status)
    );
    return getDb()
        .select({
            id: subscriptions.id,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            serviceEndsAt: subscriptions.serviceEndsAt,
            graceEndsAt: subscriptions.graceEndsAt,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, statuses)
            )
        )
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));
}
