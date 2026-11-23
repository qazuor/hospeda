/**
 * @file declined-signup-notices.ts
 * @description The ONE rule that decides when an owner still hears about a declined
 * signup (HOS-2064, HOS-2553). `CHARGE_DECLINED` is terminal and kept forever, so an
 * owner can hold an old declined row next to a live subscription in the same
 * vertical. Every surface that shows a `CHARGE_DECLINED` row reads it through
 * {@link readOwnDeclinedSignupNotices}:
 *
 * - the declined-signup notice on Mi suscripción (`GET /protected/billing-subscription/`);
 * - `readOwnSubscriptions({ includeUnsettled: true })` (host dashboard);
 * - `readAccountPlanSummary` (`/users/me/stats`, the `/mi-cuenta/` card).
 *
 * Moved here from `apps/api/src/routes/billing-subscription/read-own-declined-signups.ts`
 * so service-core readers can share it. The clock is the caller's (`now`).
 */

import {
    and,
    asc,
    eq,
    getDb,
    LIVE_SUBSCRIPTION_STATUSES,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';

const DAY_MS = 86_400_000;

/** How long a declined signup keeps being shown (owner default, HOS-2064). */
export const DECLINED_SIGNUP_NOTICE_DAYS = 7;

/** One principal row as the declined-signup rule reads it. */
export interface DeclinedSignupCandidateRow {
    readonly id: string;
    readonly vertical: string;
    readonly status: string;
    readonly succeedsId: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly billingOptionId: string | null;
    readonly declaredPayerEmail: string | null;
    readonly planSlug: string;
    readonly planName: string;
}

/** A declined signup the owner should hear about. */
export interface DeclinedSignupNotice {
    readonly subscriptionId: string;
    readonly vertical: string;
    readonly billingOptionId: string;
    readonly declaredPayerEmail: string | null;
    readonly declinedAt: Date;
    readonly plan: { readonly slug: string; readonly name: string };
}

/**
 * Pure rule (one notice per vertical at most), ordered by vertical. A declined row is
 * shown only when it is the vertical's LAST signup attempt, it was declined less than
 * {@link DECLINED_SIGNUP_NOTICE_DAYS} days ago, and the vertical has no live subscription.
 *
 * Known risk: the seven-day window uses `updatedAt`, and the `set_updated_at`
 * trigger rewrites it on every UPDATE. A future writer that updates a
 * `CHARGE_DECLINED` row without changing its status would restart the window.
 *
 * @param input.rows - Every PRINCIPAL row of one owner, any status.
 * @param input.now - The caller's clock instant.
 * @returns The notices, one per vertical at most.
 */
export function selectDeclinedSignupNotices(input: {
    readonly rows: readonly DeclinedSignupCandidateRow[];
    readonly now: Date;
}): DeclinedSignupNotice[] {
    const byVertical = new Map<string, DeclinedSignupCandidateRow[]>();
    for (const row of input.rows) {
        const bucket = byVertical.get(row.vertical) ?? [];
        bucket.push(row);
        byVertical.set(row.vertical, bucket);
    }

    const notices: DeclinedSignupNotice[] = [];
    for (const [vertical, rows] of byVertical) {
        if (rows.some((row) => LIVE_SUBSCRIPTION_STATUSES.some((status) => status === row.status)))
            continue;
        const attempts = rows
            .filter((row) => row.succeedsId === null)
            .sort(
                (left, right) =>
                    right.createdAt.getTime() - left.createdAt.getTime() ||
                    right.id.localeCompare(left.id)
            );
        const latest = attempts[0];
        if (
            latest?.status !== 'CHARGE_DECLINED' ||
            !latest.billingOptionId ||
            input.now.getTime() - latest.updatedAt.getTime() >= DECLINED_SIGNUP_NOTICE_DAYS * DAY_MS
        )
            continue;
        notices.push({
            subscriptionId: latest.id,
            vertical,
            billingOptionId: latest.billingOptionId,
            declaredPayerEmail: latest.declaredPayerEmail,
            declinedAt: latest.updatedAt,
            plan: { slug: latest.planSlug, name: latest.planName }
        });
    }
    return notices.sort((left, right) => left.vertical.localeCompare(right.vertical));
}

/**
 * Reads the owner's PRINCIPAL rows and applies {@link selectDeclinedSignupNotices}.
 *
 * @param input.userId - The owner; only their own rows are read.
 * @param input.now - The caller's clock instant.
 * @returns The declined signups the owner should still hear about.
 */
export async function readOwnDeclinedSignupNotices(input: {
    readonly userId: string;
    readonly now: Date;
}): Promise<DeclinedSignupNotice[]> {
    const rows = await getDb()
        .select({
            id: subscriptions.id,
            vertical: subscriptions.vertical,
            status: subscriptions.status,
            succeedsId: subscriptions.succeedsId,
            createdAt: subscriptions.createdAt,
            updatedAt: subscriptions.updatedAt,
            billingOptionId: subscriptions.billingOptionId,
            declaredPayerEmail: subscriptions.declaredPayerEmail,
            planSlug: plans.slug,
            planName: plans.name
        })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .innerJoin(plans, eq(plans.id, planVersions.planId))
        .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.class, 'PRINCIPAL')))
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));
    const candidates: DeclinedSignupCandidateRow[] = rows.flatMap((row) =>
        row.vertical === null ? [] : [{ ...row, vertical: row.vertical }]
    );
    return selectDeclinedSignupNotices({ rows: candidates, now: input.now });
}
