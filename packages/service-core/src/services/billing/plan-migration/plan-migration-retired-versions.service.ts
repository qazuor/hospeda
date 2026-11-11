import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import {
    count,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { type RetiredPlanVersionList, RetiredPlanVersionListSchema } from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { assertPlanMigrationActionPermitted } from './plan-migration-authorization.js';

/**
 * List the plan versions nobody can buy anymore (AC:B12:10).
 *
 * A version is retired when the catalog policy says it is NOT both current and
 * sellable (D-8): this covers the retired plan of action 18 and the old version
 * of a plan whose price increased. The condition is derived from the catalog
 * and the subscriptions anchored to the version, so a version stops appearing
 * once its last live subscription leaves, without anybody writing a state on
 * the version.
 *
 * The read is ordered by live customer count (most anchored first) and then by
 * version id. It only reads: it never writes a row.
 *
 * @param args.actor - The administrator performing action 17
 * @param args.verticals - The catalog policy port that decides current/sellable
 * @returns The retired versions with their live subscription counts
 * @throws ServiceError `ADMINISTRATIVE_ACTION_FORBIDDEN` before any read
 */
export async function listRetiredPlanVersions(args: {
    readonly actor?: Actor;
    readonly verticals: Pick<VerticalsForBilling, 'planPolicy'>;
}): Promise<RetiredPlanVersionList> {
    assertPlanMigrationActionPermitted({ actor: args.actor });
    const db = getDb();
    const grouped = await db
        .select({
            id: planVersions.id,
            planId: plans.id,
            name: plans.name,
            vertical: planVersions.vertical,
            liveSubscriptionCount: count(subscriptions.id)
        })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]))
        .groupBy(planVersions.id, plans.id);
    const items = [];
    for (const version of grouped) {
        const policy = await args.verticals.planPolicy({ planVersionId: version.id });
        if (policy.current && policy.sellable) continue;
        items.push(version);
    }
    items.sort(
        (left, right) =>
            right.liveSubscriptionCount - left.liveSubscriptionCount ||
            left.id.localeCompare(right.id)
    );
    return RetiredPlanVersionListSchema.parse({ items });
}
