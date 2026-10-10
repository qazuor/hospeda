import { and, eq, getDb, inArray, LIVE_SUBSCRIPTION_STATUSES, subscriptions } from '@repo/db';
import { countDistinct } from 'drizzle-orm';
import type { CountAnchoredCustomersPort } from './plan-publication.types.js';

/**
 * Counts distinct customers with a live principal subscription anchored to the
 * previous current plan version (HOS-1653, AC:V2:6). This is a subscription
 * "fila viva" consumer: it uses all six subscription statuses from @repo/db.
 */
export const countAnchoredCustomersFromSubscriptions: CountAnchoredCustomersPort = async ({
    planVersionId
}) => {
    if (planVersionId === null) return 0;

    const [row] = await getDb()
        .select({ customers: countDistinct(subscriptions.userId) })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.planVersionId, planVersionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        );
    return row?.customers ?? 0;
};
