import {
    and,
    asc,
    eq,
    getDb,
    inArray,
    isNull,
    ne,
    or,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import { AccountPlanSummarySchema, OWN_PLAN_STATUSES, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { z } from 'zod';
import { z as zod } from 'zod';

/** Live principal statuses mirrored from service-core `read-own-plan-state.ts`. */
const LIVE_STATUSES = OWN_PLAN_STATUSES;
const LiveStatusSchema = zod.enum(LIVE_STATUSES);

type AccountPlanSummary = z.infer<typeof AccountPlanSummarySchema>;

/**
 * Read the live principal plan summary for one account using the current subscription catalog.
 *
 * `subscriptions` lists every live principal, including the two unsettled states
 * (`PENDING_AUTHORIZATION`, `CHARGE_DECLINED`, HOS-2553). A `PENDING_AUTHORIZATION` row
 * with a predecessor is a succession checkout of an existing subscription and is not
 * counted as a second one.
 */
export async function readAccountPlanSummary(input: { readonly userId: string }): Promise<{
    readonly plan: AccountPlanSummary | null;
    readonly activeSubscriptionsCount: number;
    readonly subscriptions: readonly AccountPlanSummary[];
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
                inArray(subscriptions.status, LIVE_STATUSES),
                or(
                    isNull(subscriptions.succeedsId),
                    ne(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
        )
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));

    for (const row of rows) {
        if (!LiveStatusSchema.safeParse(row.status).success) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription summary contains an invalid status'
            );
        }
    }

    const parsedRows = rows.map((row) => AccountPlanSummarySchema.safeParse(row));
    const list: AccountPlanSummary[] = [];
    for (const parsed of parsedRows) {
        if (!parsed.success) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Subscription plan summary contains an invalid status or catalog value'
            );
        }
        list.push(parsed.data);
    }
    return {
        plan: list.length === 1 ? (list[0] ?? null) : null,
        activeSubscriptionsCount: list.length,
        subscriptions: list
    };
}
