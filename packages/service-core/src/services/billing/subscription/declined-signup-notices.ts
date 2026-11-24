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
 * The vertical's LAST signup attempt (a row that does not succeed another), for every vertical
 * that has no live subscription. Verticals with a live row are left out entirely.
 */
function selectLastAttemptsWithoutLiveTitle(
    rows: readonly DeclinedSignupCandidateRow[]
): Array<[string, DeclinedSignupCandidateRow]> {
    const byVertical = new Map<string, DeclinedSignupCandidateRow[]>();
    for (const row of rows) {
        const bucket = byVertical.get(row.vertical) ?? [];
        bucket.push(row);
        byVertical.set(row.vertical, bucket);
    }
    const lastAttempts: Array<[string, DeclinedSignupCandidateRow]> = [];
    for (const [vertical, bucket] of byVertical) {
        if (
            bucket.some((row) => LIVE_SUBSCRIPTION_STATUSES.some((status) => status === row.status))
        )
            continue;
        const [latest] = bucket
            .filter((row) => row.succeedsId === null)
            .sort(
                (left, right) =>
                    right.createdAt.getTime() - left.createdAt.getTime() ||
                    right.id.localeCompare(left.id)
            );
        if (latest) lastAttempts.push([vertical, latest]);
    }
    return lastAttempts;
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
    const notices: DeclinedSignupNotice[] = [];
    for (const [vertical, latest] of selectLastAttemptsWithoutLiveTitle(input.rows)) {
        if (
            latest.status !== 'CHARGE_DECLINED' ||
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

/** A declined signup whose seven-day retry window has passed (HOS-2193): a restart path only. */
export interface ExpiredDeclinedSignupNotice {
    readonly subscriptionId: string;
    readonly vertical: string;
    readonly declinedAt: Date;
    readonly plan: { readonly slug: string; readonly name: string };
}

/**
 * Pure rule for the notice that follows {@link selectDeclinedSignupNotices} (one per vertical at
 * most, ordered by vertical). A declined row is listed when it is the vertical's LAST signup
 * attempt, the vertical has no live subscription, and at least
 * {@link DECLINED_SIGNUP_NOTICE_DAYS} days have passed since the decline. It is the exact
 * complement of the retry notice, so a vertical never shows both.
 *
 * @param input.rows - Every PRINCIPAL row of one owner, any status.
 * @param input.now - The caller's clock instant.
 * @returns The expired declined signups.
 */
export function selectExpiredDeclinedSignups(input: {
    readonly rows: readonly DeclinedSignupCandidateRow[];
    readonly now: Date;
}): ExpiredDeclinedSignupNotice[] {
    const expired: ExpiredDeclinedSignupNotice[] = [];
    for (const [vertical, latest] of selectLastAttemptsWithoutLiveTitle(input.rows)) {
        if (
            latest.status !== 'CHARGE_DECLINED' ||
            input.now.getTime() - latest.updatedAt.getTime() < DECLINED_SIGNUP_NOTICE_DAYS * DAY_MS
        )
            continue;
        expired.push({
            subscriptionId: latest.id,
            vertical,
            declinedAt: latest.updatedAt,
            plan: { slug: latest.planSlug, name: latest.planName }
        });
    }
    return expired.sort((left, right) => left.vertical.localeCompare(right.vertical));
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
    const candidates = await readOwnPrincipalCandidates(input.userId);
    return selectDeclinedSignupNotices({ rows: candidates, now: input.now });
}

/**
 * Reads the owner's PRINCIPAL rows and applies {@link selectExpiredDeclinedSignups}.
 *
 * @param input.userId - The owner; only their own rows are read.
 * @param input.now - The caller's clock instant.
 * @returns The declined signups whose retry window has passed.
 */
export async function readOwnExpiredDeclinedSignups(input: {
    readonly userId: string;
    readonly now: Date;
}): Promise<ExpiredDeclinedSignupNotice[]> {
    const candidates = await readOwnPrincipalCandidates(input.userId);
    return selectExpiredDeclinedSignups({ rows: candidates, now: input.now });
}

async function readOwnPrincipalCandidates(userId: string): Promise<DeclinedSignupCandidateRow[]> {
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
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.class, 'PRINCIPAL')))
        .orderBy(asc(subscriptions.createdAt), asc(subscriptions.id));
    return rows.flatMap((row) =>
        row.vertical === null ? [] : [{ ...row, vertical: row.vertical }]
    );
}
