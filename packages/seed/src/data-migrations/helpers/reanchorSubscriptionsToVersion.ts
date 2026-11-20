import type { DrizzleClient } from '@repo/db';
import {
    and,
    billingOptions,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import {
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS,
    OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS
} from '../../catalog/next-version-entitlements.js';
import { logger } from '../../utils/logger.js';

/**
 * Immutable view of one plan version, as compared by {@link assertReanchorCompatible}.
 */
export interface ReanchorVersionSnapshot {
    /** Stable plan identifier shared by both versions. */
    readonly planId: string;
    /** Vertical both versions belong to. */
    readonly vertical: string;
    /** Whether the version grants Tourist VIP by inheritance (`plan_version.inherits_tourist_vip`). */
    readonly inheritsTouristVip: boolean;
    /** Billing options (one per cycle) of the version. */
    readonly options: readonly {
        readonly id: string;
        readonly cycle: string;
        readonly amount: number;
        readonly currency: string;
    }[];
    /** Entitlement rows of the version, with their quotas. */
    readonly entitlements: readonly {
        readonly key: string;
        readonly planQuota: number | null;
        readonly trialQuota: number | null;
    }[];
    /** Limit rows of the version. */
    readonly limits: readonly { readonly key: string; readonly value: number }[];
}

/**
 * Refusal message when the two versions do not offer the same cycles at the same
 * prices. A subscription on such a version holds a price the current version no
 * longer sells (a grandfathered price); moving it would change what it pays, which
 * only a `plan_migration` with notice may do. Exported so a caller can tell this
 * refusal apart from the others.
 */
export const REANCHOR_PRICE_MISMATCH =
    'Cannot re-anchor when billing option prices differ by cycle';

/** Entitlement keys an owner version may drop under live subscriptions (HOS-2398 option B). */
const REMOVABLE_ENTITLEMENT_KEYS: ReadonlySet<string> = new Set(
    OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS
);
/** Limit keys an owner version may drop under live subscriptions (HOS-2398 option B). */
const REMOVABLE_LIMIT_KEYS: ReadonlySet<string> = new Set(OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS);

/**
 * Whether `to` may omit a tourist key `from` had without reducing what the
 * subscriber receives: only on an owner vertical (never on Tourist, where these
 * keys ARE the product) and only when both versions inherit Tourist VIP, so the
 * key keeps arriving through the inheritance (`resolveTouristVipInheritance`).
 */
function mayDropTouristKey(input: {
    readonly from: ReanchorVersionSnapshot;
    readonly to: ReanchorVersionSnapshot;
    readonly key: string;
    readonly removable: ReadonlySet<string>;
}): boolean {
    return (
        input.removable.has(input.key) &&
        input.to.vertical !== 'tourist' &&
        input.from.inheritsTouristVip &&
        input.to.inheritsTouristVip
    );
}

/**
 * Throws unless `to` can safely replace `from` under live subscriptions: same
 * plan, same vertical, identical price per cycle, and a superset of
 * entitlements (no quota shrunk) and limits (no value reduced).
 *
 * One explicit exception (HOS-2398, owner option B): on an owner vertical, when
 * both versions inherit Tourist VIP, the target may OMIT the tourist keys listed
 * in `OWNER_PLAN_REMOVED_TOURIST_ENTITLEMENT_KEYS` / `OWNER_PLAN_REMOVED_TOURIST_LIMIT_KEYS`,
 * because the subscriber keeps receiving them through the inheritance. Any other
 * removal or reduction still refuses, and a kept tourist limit may not shrink.
 *
 * @param input - The two version snapshots.
 * @throws Error naming the first violated rule.
 */
export function assertReanchorCompatible(input: {
    readonly from: ReanchorVersionSnapshot;
    readonly to: ReanchorVersionSnapshot;
}): void {
    const { from, to } = input;
    if (from.planId !== to.planId) throw new Error('Cannot re-anchor between different plans');
    if (from.vertical !== to.vertical)
        throw new Error('Cannot re-anchor between different verticals');
    const byCycle = new Map(to.options.map((item) => [item.cycle, item]));
    if (
        from.options.length !== to.options.length ||
        from.options.some((old) => {
            const next = byCycle.get(old.cycle);
            return !next || next.amount !== old.amount || next.currency !== old.currency;
        })
    )
        throw new Error(REANCHOR_PRICE_MISMATCH);
    const byEntitlement = new Map(to.entitlements.map((item) => [item.key, item]));
    if (
        from.entitlements.some((old) => {
            const next = byEntitlement.get(old.key);
            if (!next)
                return !mayDropTouristKey({
                    from,
                    to,
                    key: old.key,
                    removable: REMOVABLE_ENTITLEMENT_KEYS
                });
            const quotaShrunk = (before: number | null, after: number | null) =>
                before === null ? after !== null : after !== null && after < before;
            return (
                quotaShrunk(old.planQuota, next.planQuota) ||
                quotaShrunk(old.trialQuota, next.trialQuota)
            );
        })
    )
        throw new Error('Target version removes or reduces an entitlement');
    const byLimit = new Map(to.limits.map((item) => [item.key, item.value]));
    if (
        from.limits.some((old) => {
            const next = byLimit.get(old.key);
            if (next === undefined)
                return !mayDropTouristKey({
                    from,
                    to,
                    key: old.key,
                    removable: REMOVABLE_LIMIT_KEYS
                });
            return next < old.value;
        })
    )
        throw new Error('Target version removes or reduces a limit');
}

/**
 * Maps an old billing option id to the target version's option of the same cycle.
 *
 * @param input - The old option id and both versions' options.
 * @returns The target option id.
 * @throws Error when the target has no option for the old option's cycle.
 */
export function remapBillingOptionId(input: {
    readonly oldOptionId: string;
    readonly fromOptions: ReanchorVersionSnapshot['options'];
    readonly toOptions: ReanchorVersionSnapshot['options'];
}): string {
    const old = input.fromOptions.find((item) => item.id === input.oldOptionId);
    const next = old && input.toOptions.find((item) => item.cycle === old.cycle);
    if (!next) throw new Error(`No target billing option for old option ${input.oldOptionId}`);
    return next.id;
}

/** Outcome of {@link reanchorSubscriptionsToVersion}. */
export interface ReanchorResult {
    /** Live principal subscriptions moved to the target version. */
    readonly movedCount: number;
    /** Scheduled changes whose destination was remapped to the target version. */
    readonly remappedScheduledChanges: number;
    /**
     * Users whose effective set may be cached. The effective-set cache must be
     * invalidated for each one AFTER the surrounding transaction commits (the
     * cache port forbids doing it inside); this helper has no cache access.
     */
    readonly userIds: readonly string[];
}

/**
 * Re-anchor all live principal subscriptions (and scheduled changes whose
 * destination is the old version) to an additive, price-neutral plan version.
 *
 * Refuses (see {@link assertReanchorCompatible}) a different plan or vertical, a
 * per-cycle price difference, and a target that is not a superset of the
 * source's entitlements/limits. Idempotent: once nothing is anchored to
 * `fromVersionId` it moves zero rows. It never calls MercadoPago or changes
 * provider preapprovals: equal per-cycle prices leave the existing authorization
 * valid. The source may be retired or non-sellable; it only needs its options.
 * `db` must be the caller's transaction-scoped client, so every move is atomic
 * with publication.
 *
 * @param input - Receive-object.
 * @param input.db - Transaction-scoped client.
 * @param input.fromVersionId - Version the subscriptions are anchored to today.
 * @param input.toVersionId - Version to anchor them to.
 * @returns Counts and affected users.
 * @throws Error when a refusal rule applies or a live row lacks a billing option.
 */
export async function reanchorSubscriptionsToVersion(input: {
    readonly db: DrizzleClient;
    readonly fromVersionId: string;
    readonly toVersionId: string;
}): Promise<ReanchorResult> {
    const { db, fromVersionId, toVersionId } = input;
    if (fromVersionId === toVersionId)
        return { movedCount: 0, remappedScheduledChanges: 0, userIds: [] };
    const [from] = await db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, fromVersionId))
        .limit(1);
    const [to] = await db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, toVersionId))
        .limit(1);
    if (!from || !to) throw new Error('Both plan versions must exist');
    const [plan] = await db
        .select({ vertical: plans.vertical })
        .from(plans)
        .where(eq(plans.id, from.planId))
        .limit(1);
    if (!plan || plan.vertical !== from.vertical)
        throw new Error('Plan vertical does not match versions');

    const [oldOptions, newOptions, oldEntitlements, newEntitlements, oldLimits, newLimits] =
        await Promise.all([
            db.select().from(billingOptions).where(eq(billingOptions.planVersionId, fromVersionId)),
            db.select().from(billingOptions).where(eq(billingOptions.planVersionId, toVersionId)),
            db
                .select()
                .from(planVersionEntitlements)
                .where(eq(planVersionEntitlements.planVersionId, fromVersionId)),
            db
                .select()
                .from(planVersionEntitlements)
                .where(eq(planVersionEntitlements.planVersionId, toVersionId)),
            db
                .select()
                .from(planVersionLimits)
                .where(eq(planVersionLimits.planVersionId, fromVersionId)),
            db
                .select()
                .from(planVersionLimits)
                .where(eq(planVersionLimits.planVersionId, toVersionId))
        ]);
    const fromOptions = oldOptions.map(({ id, cycle, amount, currency }) => ({
        id,
        cycle,
        amount,
        currency
    }));
    const toOptions = newOptions.map(({ id, cycle, amount, currency }) => ({
        id,
        cycle,
        amount,
        currency
    }));
    assertReanchorCompatible({
        from: {
            planId: from.planId,
            vertical: from.vertical,
            inheritsTouristVip: from.inheritsTouristVip,
            options: fromOptions,
            entitlements: oldEntitlements,
            limits: oldLimits
        },
        to: {
            planId: to.planId,
            vertical: to.vertical,
            inheritsTouristVip: to.inheritsTouristVip,
            options: toOptions,
            entitlements: newEntitlements,
            limits: newLimits
        }
    });

    const live = await db
        .select()
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.planVersionId, fromVersionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
            )
        );
    for (const row of live) {
        if (!row.billingOptionId)
            throw new Error(`Live subscription ${row.id} has no billing option`);
        const nextOptionId = remapBillingOptionId({
            oldOptionId: row.billingOptionId,
            fromOptions,
            toOptions
        });
        await db
            .update(subscriptions)
            .set({ planVersionId: toVersionId, billingOptionId: nextOptionId })
            .where(eq(subscriptions.id, row.id));
    }

    // A queued change that still targets the old version would re-anchor its
    // subscription BACK onto it when it fires, silently dropping the new grant.
    const queued = await db
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.targetPlanVersionId, fromVersionId));
    for (const change of queued) {
        const nextOptionId = remapBillingOptionId({
            oldOptionId: change.targetBillingOptionId,
            fromOptions,
            toOptions
        });
        await db
            .update(subscriptionScheduledChanges)
            .set({ targetPlanVersionId: toVersionId, targetBillingOptionId: nextOptionId })
            .where(eq(subscriptionScheduledChanges.id, change.id));
    }

    const userIds = [
        ...new Set(live.map((row) => row.userId).filter((id): id is string => id !== null))
    ];
    logger.info(
        `Re-anchored ${live.length} subscription(s) and ${queued.length} scheduled change(s) from ${fromVersionId} to ${toVersionId}.`
    );
    return { movedCount: live.length, remappedScheduledChanges: queued.length, userIds };
}

/** A source version {@link reanchorOlderVersions} refused to move. */
export interface SkippedReanchor {
    /** The older version that failed a guard rail. */
    readonly versionId: string;
    /** The refusal message. */
    readonly reason: string;
    /** Live principal subscriptions still pinned to that version. */
    readonly liveCount: number;
    /** Queued plan changes still targeting that version. */
    readonly queuedCount: number;
}

/** Outcome of {@link reanchorOlderVersions}. */
export interface ReanchorOlderResult extends ReanchorResult {
    /** Source versions that were refused; their rows were left untouched. */
    readonly skipped: readonly SkippedReanchor[];
}

/**
 * Re-anchors live subscriptions (and queued changes) pinned to EVERY other version of
 * `planId` onto `toVersionId`. Each source runs in its own savepoint with the full guard
 * rails of {@link reanchorSubscriptionsToVersion}; a source that fails them (different
 * price, shrunk entitlement, missing option) is rolled back, logged and returned in
 * `skipped`, and the remaining sources are still attempted. This helper never decides
 * that a skip is acceptable: the caller must treat a skipped source with `liveCount > 0`
 * as fatal (0133 does, rolling back everything) so no live subscriber is silently left
 * behind. Versions with nothing anchored to them are not evaluated at all.
 *
 * @param input - Receive-object.
 * @param input.db - Transaction-scoped client.
 * @param input.planId - The plan whose older versions are swept.
 * @param input.toVersionId - The version to anchor to.
 * @returns Summed counts, affected users and the skipped sources.
 */
export async function reanchorOlderVersions(input: {
    readonly db: DrizzleClient;
    readonly planId: string;
    readonly toVersionId: string;
}): Promise<ReanchorOlderResult> {
    const { db, planId, toVersionId } = input;
    const versions = await db.select().from(planVersions).where(eq(planVersions.planId, planId));
    let movedCount = 0;
    let remappedScheduledChanges = 0;
    const userIds = new Set<string>();
    const skipped: SkippedReanchor[] = [];
    for (const version of versions) {
        if (version.id === toVersionId) continue;
        const live = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
                and(
                    eq(subscriptions.planVersionId, version.id),
                    eq(subscriptions.class, 'PRINCIPAL'),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            );
        const queued = await db
            .select({ id: subscriptionScheduledChanges.id })
            .from(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.targetPlanVersionId, version.id));
        if (live.length === 0 && queued.length === 0) continue;
        try {
            const result = await db.transaction(async (savepoint) =>
                reanchorSubscriptionsToVersion({
                    db: savepoint,
                    fromVersionId: version.id,
                    toVersionId
                })
            );
            movedCount += result.movedCount;
            remappedScheduledChanges += result.remappedScheduledChanges;
            for (const id of result.userIds) userIds.add(id);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            logger.warn(`Skipped re-anchor of version ${version.id}: ${reason}`);
            skipped.push({
                versionId: version.id,
                reason,
                liveCount: live.length,
                queuedCount: queued.length
            });
        }
    }
    return { movedCount, remappedScheduledChanges, userIds: [...userIds], skipped };
}
