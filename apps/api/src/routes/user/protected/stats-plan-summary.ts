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
import {
    AccountPlanSummarySchema,
    OWN_PLAN_STATUSES,
    SETTLED_OWN_SUBSCRIPTION_STATUSES,
    ServiceErrorCode
} from '@repo/schemas';
import { readOwnDeclinedSignupNotices, ServiceError } from '@repo/service-core';
import type { z } from 'zod';
import { z as zod } from 'zod';

/** Principal statuses the card can show, settled and unsettled (HOS-2553). */
const LIVE_STATUSES = OWN_PLAN_STATUSES;
/** The statuses that count as an active subscription; the unsettled ones never do. */
const SETTLED_STATUSES: readonly string[] = SETTLED_OWN_SUBSCRIPTION_STATUSES;
const LiveStatusSchema = zod.enum(LIVE_STATUSES);

type AccountPlanSummary = z.infer<typeof AccountPlanSummarySchema>;

/**
 * Read the live principal plan summary for one account using the current subscription catalog.
 *
 * `subscriptions` lists every live principal plus the two unsettled states the owner must
 * be told about (HOS-2553):
 * - `PENDING_AUTHORIZATION` without a predecessor (a succession checkout belongs to an
 *   existing subscription and is not listed twice);
 * - `CHARGE_DECLINED` only under the declined-signup rule shared with Mi suscripción
 *   (`readOwnDeclinedSignupNotices`: last attempt, under seven days, no live subscription in
 *   that vertical). The status is terminal and kept forever, so without the rule an old
 *   decline would sit next to the live subscription that replaced it.
 *
 * `activeSubscriptionsCount` counts only the settled statuses: an unsettled row is shown,
 * never counted as active. `plan` is the single listed row, so an owner whose only row is a
 * recent decline sees that decline instead of "no plan".
 *
 * @param input.userId - The account owner.
 * @param input.now - The caller's clock instant (the declined-signup window).
 */
export async function readAccountPlanSummary(input: {
    readonly userId: string;
    readonly now: Date;
}): Promise<{
    readonly plan: AccountPlanSummary | null;
    readonly activeSubscriptionsCount: number;
    readonly subscriptions: readonly AccountPlanSummary[];
}> {
    const { userId, now } = input;
    const candidateRows = await getDb()
        .select({
            id: subscriptions.id,
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
    const shownDeclinedIds = candidateRows.some((row) => row.status === 'CHARGE_DECLINED')
        ? new Set(
              (await readOwnDeclinedSignupNotices({ userId, now })).map(
                  (notice) => notice.subscriptionId
              )
          )
        : new Set<string>();
    const rows = candidateRows.filter(
        (row) => row.status !== 'CHARGE_DECLINED' || shownDeclinedIds.has(row.id)
    );

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
        activeSubscriptionsCount: list.filter((item) =>
            SETTLED_STATUSES.some((status) => status === item.status)
        ).length,
        subscriptions: list
    };
}
