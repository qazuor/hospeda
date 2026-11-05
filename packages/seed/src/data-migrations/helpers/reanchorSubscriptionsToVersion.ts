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
    subscriptions
} from '@repo/db';
import { logger } from '../../utils/logger.js';

export interface ReanchorVersionSnapshot {
    readonly planId: string;
    readonly vertical: string;
    readonly options: readonly {
        readonly id: string;
        readonly cycle: string;
        readonly amount: number;
        readonly currency: string;
    }[];
    readonly entitlements: readonly {
        readonly key: string;
        readonly planQuota: number | null;
        readonly trialQuota: number | null;
    }[];
    readonly limits: readonly { readonly key: string; readonly value: number }[];
}

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
        throw new Error('Cannot re-anchor when billing option prices differ by cycle');
    const byEntitlement = new Map(to.entitlements.map((item) => [item.key, item]));
    if (
        from.entitlements.some((old) => {
            const next = byEntitlement.get(old.key);
            if (!next) return true;
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
    if (from.limits.some((old) => (byLimit.get(old.key) ?? -1) < old.value))
        throw new Error('Target version removes or reduces a limit');
}

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

/**
 * Re-anchor all live principal subscriptions to an additive, price-neutral plan
 * version. It never calls MercadoPago or changes provider preapprovals: equal
 * per-cycle prices leave the existing authorization valid. `db` must be the
 * migration's transaction-scoped client, making all moves atomic with publication.
 */
export async function reanchorSubscriptionsToVersion(input: {
    readonly db: DrizzleClient;
    readonly fromVersionId: string;
    readonly toVersionId: string;
    readonly invalidateUser?: (userId: string) => Promise<void>;
}): Promise<number> {
    const { db, fromVersionId, toVersionId } = input;
    if (fromVersionId === toVersionId) return 0;
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
            options: fromOptions,
            entitlements: oldEntitlements,
            limits: oldLimits
        },
        to: {
            planId: to.planId,
            vertical: to.vertical,
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
        if (row.userId && input.invalidateUser) await input.invalidateUser(row.userId);
    }
    logger.info(
        `Re-anchored ${live.length} subscription(s) from ${fromVersionId} to ${toVersionId}.`
    );
    return live.length;
}
