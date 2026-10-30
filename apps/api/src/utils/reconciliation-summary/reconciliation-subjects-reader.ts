/**
 * Resolves the subjects of the billing reconciliation summary mail (HOS-1971).
 *
 * The stored payload carries ids only. This reader turns them into holder,
 * plan, status and listing names with a fixed number of queries per mail
 * (never one per line): subscriptions, addon instances, open marks, and one
 * listing query per vertical. A subject that no longer exists is simply absent
 * from the result, and the renderer prints the bare line for it.
 *
 * @module utils/reconciliation-summary/reconciliation-subjects-reader
 */

import {
    accommodations,
    addonInstances,
    addonProducts,
    addons,
    billingOptions,
    experiences,
    getDb,
    plans,
    planVersions,
    reconciliationMarks,
    subscriptions,
    users,
    venues
} from '@repo/db';
import type {
    ReconciliationAddonDetail,
    ReconciliationOpenMark,
    ReconciliationSubjectsReader,
    ReconciliationSubscriptionDetail
} from '@repo/notifications';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

type OwnerColumns = {
    readonly displayName: string | null;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly email: string | null;
};

/** Best human name of an account: display name, then first and last name. */
function holderName(owner: OwnerColumns | null): string | null {
    if (!owner) return null;
    if (owner.displayName?.trim()) return owner.displayName.trim();
    const full = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
    return full || null;
}

async function readListingNames(input: {
    readonly pairs: readonly { readonly userId: string; readonly vertical: string }[];
}): Promise<ReadonlyMap<string, readonly string[]>> {
    const db = getDb();
    const result = new Map<string, string[]>();
    const tables = [
        ['accommodation', accommodations],
        ['venue', venues],
        ['experience', experiences]
    ] as const;
    await Promise.all(
        tables.map(async ([vertical, table]) => {
            const userIds = [
                ...new Set(
                    input.pairs.filter((pair) => pair.vertical === vertical).map((p) => p.userId)
                )
            ];
            if (userIds.length === 0) return;
            const rows = await db
                .select({ ownerId: table.ownerId, name: table.name })
                .from(table)
                .where(and(inArray(table.ownerId, userIds), isNull(table.deletedAt)));
            for (const row of rows) {
                const key = `${row.ownerId}|${vertical}`;
                result.set(key, [...(result.get(key) ?? []), row.name]);
            }
        })
    );
    return result;
}

/**
 * Production {@link ReconciliationSubjectsReader}.
 *
 * @param input - Subscription and addon instance ids named by one summary.
 * @returns Details by id, and the open marks keyed by `subjectId|reason`.
 */
export const readReconciliationSubjects: ReconciliationSubjectsReader = async ({
    subscriptionIds,
    addonInstanceIds
}) => {
    const db = getDb();
    const subscriptionMap = new Map<string, ReconciliationSubscriptionDetail>();
    const addonMap = new Map<string, ReconciliationAddonDetail>();
    const openMarks = new Map<string, ReconciliationOpenMark>();

    if (subscriptionIds.length > 0) {
        const rows = await db
            .select({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical,
                status: subscriptions.status,
                planName: plans.name,
                cycle: billingOptions.cycle,
                amountMinor: billingOptions.amount,
                currency: billingOptions.currency,
                displayName: users.displayName,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email
            })
            .from(subscriptions)
            .leftJoin(users, eq(users.id, subscriptions.userId))
            .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
            .leftJoin(plans, eq(plans.id, planVersions.planId))
            .leftJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
            .where(inArray(subscriptions.id, [...subscriptionIds]));
        const listings = await readListingNames({
            pairs: rows.flatMap((row) =>
                row.userId && row.vertical ? [{ userId: row.userId, vertical: row.vertical }] : []
            )
        });
        for (const row of rows) {
            subscriptionMap.set(row.id, {
                holderName: holderName(row),
                holderEmail: row.email,
                vertical: row.vertical,
                planName: row.planName,
                cycle: row.cycle,
                amountMinor: row.amountMinor,
                currency: row.currency,
                status: row.status,
                listingNames: listings.get(`${row.userId}|${row.vertical}`) ?? []
            });
        }
    }

    if (addonInstanceIds.length > 0) {
        const rows = await db
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                addonName: addons.name,
                displayName: users.displayName,
                firstName: users.firstName,
                lastName: users.lastName,
                email: users.email
            })
            .from(addonInstances)
            .leftJoin(users, eq(users.id, addonInstances.ownerId))
            .leftJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .leftJoin(addons, eq(addons.id, addonProducts.addonId))
            .where(inArray(addonInstances.id, [...addonInstanceIds]));
        for (const row of rows) {
            addonMap.set(row.id, {
                holderName: holderName(row),
                holderEmail: row.email,
                addonName: row.addonName,
                status: row.status
            });
        }
    }

    const subjectFilters = [
        subscriptionIds.length > 0
            ? inArray(reconciliationMarks.subscriptionId, [...subscriptionIds])
            : undefined,
        addonInstanceIds.length > 0
            ? inArray(reconciliationMarks.addonInstanceId, [...addonInstanceIds])
            : undefined
    ].filter((filter) => filter !== undefined);
    const markRows =
        subjectFilters.length === 0
            ? []
            : await db
                  .select({
                      id: reconciliationMarks.id,
                      subscriptionId: reconciliationMarks.subscriptionId,
                      addonInstanceId: reconciliationMarks.addonInstanceId,
                      reason: reconciliationMarks.reason,
                      placedAt: reconciliationMarks.placedAt
                  })
                  .from(reconciliationMarks)
                  .where(and(isNull(reconciliationMarks.liftedAt), or(...subjectFilters)));
    for (const mark of markRows) {
        const subjectId = mark.subscriptionId ?? mark.addonInstanceId;
        if (subjectId) {
            openMarks.set(`${subjectId}|${mark.reason}`, {
                markId: mark.id,
                placedAt: mark.placedAt.toISOString()
            });
        }
    }

    return { subscriptions: subscriptionMap, addonInstances: addonMap, openMarks };
};
