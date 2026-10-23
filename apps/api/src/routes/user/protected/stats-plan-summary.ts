import { and, asc, eq, getDb, inArray, plans, planVersions, subscriptions } from '@repo/db';
import { AccountPlanSummarySchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { z } from 'zod';

/** Live principal statuses mirrored from read-own-subscriptions.ts. */
const LIVE_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCEL_SCHEDULED'] as const;

type AccountPlanSummary = z.infer<typeof AccountPlanSummarySchema>;

/** Read the live principal plan summary for one account using the current subscription catalog. */
export async function readAccountPlanSummary(input: { readonly userId: string }): Promise<{
    readonly plan: AccountPlanSummary | null;
    readonly activeSubscriptionsCount: number;
}> {
    const { userId } = input;
    const rows = await getDb()
        .select({
            slug: plans.slug,
            name: plans.name,
            status: subscriptions.status,
            vertical: subscriptions.vertical
        })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(
            and(
                eq(subscriptions.userId, userId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_STATUSES)
            )
        )
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));

    const plan = rows.length === 1 ? rows[0] : null;
    if (plan) {
        const parsed = AccountPlanSummarySchema.safeParse(plan);
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription plan summary contains an invalid status or catalog value'
            );
        }
        return { plan: parsed.data, activeSubscriptionsCount: rows.length };
    }
    return { plan: null, activeSubscriptionsCount: rows.length };
}
