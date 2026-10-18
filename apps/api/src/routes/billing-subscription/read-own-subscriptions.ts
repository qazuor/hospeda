import {
    and,
    asc,
    courtesyGrants,
    eq,
    getDb,
    inArray,
    isNotNull,
    isNull,
    SUBSCRIPTION_STATUSES,
    subscriptions
} from '@repo/db';

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

/** Read deferred courtesy terms belonging to the owner, for display only. */
export async function readOwnDeferredCourtesies(userId: string) {
    return getDb()
        .select({
            courtesyGrantId: courtesyGrants.id,
            vertical: subscriptions.vertical,
            balanceMonths: courtesyGrants.balanceMonths
        })
        .from(courtesyGrants)
        .innerJoin(subscriptions, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(courtesyGrants.beneficiaryUserId, userId),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt)
            )
        )
        .orderBy(asc(courtesyGrants.createdAt), asc(courtesyGrants.id));
}
