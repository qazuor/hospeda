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
import { getClock } from '../../utils/clock';

const DAY_MS = 86_400_000;

/** How long "Mi suscripción" keeps showing a declined signup (owner default, HOS-2064). */
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
 * Pure rule of §4 (one notice per vertical at most), ordered by vertical.
 * Known risk: the seven-day window uses `updatedAt`, and the `set_updated_at`
 * trigger rewrites it on every UPDATE. A future writer that updates a
 * `CHARGE_DECLINED` row without changing its status would restart the window.
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

/** Reads the caller's principal rows and applies {@link selectDeclinedSignupNotices}. */
export async function readOwnDeclinedSignups(userId: string): Promise<DeclinedSignupNotice[]> {
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
    const candidates: DeclinedSignupCandidateRow[] = rows.flatMap((row) =>
        row.vertical === null ? [] : [{ ...row, vertical: row.vertical }]
    );
    return selectDeclinedSignupNotices({ rows: candidates, now: getClock().clock.now() });
}
