/**
 * Cohort selection for the nine-send trial email series (HOS-1012 T-016/T-017).
 *
 * Two queries, one per direction, and a live re-check that runs immediately
 * before each dispatch.
 *
 * **Only Hospeda-owned trials.** Every query filters `mp_subscription_id IS
 * NULL`. A legacy card-first trial (HOS-171) is one MercadoPago is about to
 * charge automatically, so telling its owner that "mañana tu publicación sale
 * del sitio" would be false — and the two such rows still live in production
 * belong to real customers (OQ-3), not to test data. They are converted by
 * hand in T-032, and until then this filter is what keeps the series off them.
 *
 * **Exact buckets, deliberately not skip-tolerant.** The pre-HOS-1012 reminder
 * covered `[N, N-1]` so a skipped cron day would not drop it. That tolerance is
 * not portable here: every send's copy states its own distance ("todavía te
 * quedan diez días", "Pasaron diez días"), so a catch-up send would state a
 * distance that is not true. A dropped send is better than a wrong one, and
 * with nine sends losing one is no longer losing the only one.
 *
 * @module services/billing/trial-series-cohort
 */

import { isEntitlementGrantingStatus } from '@repo/billing';
import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    gte,
    isNotNull,
    isNull,
    lte
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import {
    POST_EXPIRY_OFFSET_DAYS,
    PRE_EXPIRY_OFFSET_DAYS,
    type TrialSeriesSend
} from './trial-notification-offsets.js';

/** Milliseconds in a day, for the bucket arithmetic below. */
const DAY_MS = 1000 * 60 * 60 * 24;

/** The furthest pre-expiry offset, used to bound the SQL prefilter. */
const MAX_PRE_OFFSET = Math.max(...PRE_EXPIRY_OFFSET_DAYS);

/** The furthest post-expiry offset. Nothing is sent beyond it. */
const MAX_POST_OFFSET = Math.max(...POST_EXPIRY_OFFSET_DAYS);

/**
 * A subscription eligible for one send of the series, with everything the
 * dispatch needs that is not customer- or plan-shaped.
 */
export interface TrialSeriesCandidate {
    readonly subscriptionId: string;
    readonly customerId: string;
    readonly planId: string;
    /** When the trial ends (or ended). Rendered in most of the nine templates. */
    readonly trialEnd: Date;
    /**
     * The billing interval the customer originally chose, read back from
     * `metadata.intendedInterval`. Untyped at the source, so it may be absent.
     */
    readonly intendedInterval?: string;
}

/**
 * Days a trial still has left, in whole days, using the same `ceil` convention
 * as `calculateTrialDaysRemaining` — the arithmetic the pre-HOS-1012 reminder
 * already selected on, kept so the buckets do not shift under existing rows.
 */
function daysUntil(target: Date, now: Date): number {
    return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Whole days elapsed since an instant. `floor`, not `ceil`: the day something
 * happened is day 0 of it, which is what the expiry mail's copy assumes.
 */
function daysSince(past: Date, now: Date): number {
    return Math.floor((now.getTime() - past.getTime()) / DAY_MS);
}

/**
 * Read `metadata.intendedInterval` off a subscription row without trusting its
 * shape — the QZPay SDK does not narrow subscription metadata.
 */
function readIntendedInterval(metadata: unknown): string | undefined {
    if (typeof metadata !== 'object' || metadata === null) return undefined;
    const value = (metadata as Record<string, unknown>).intendedInterval;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Select the trials due a PRE-EXPIRY send today (offsets −10, −5, −1).
 *
 * One query for the whole direction rather than one per offset: three queries
 * returning overlapping supersets and de-duplicated in JS is what the previous
 * implementation did, and it is how a trial straddling two adjacent windows
 * ended up needing a `Map` to be processed once.
 *
 * @param input.now - Clock override, for tests.
 * @param input.db - Drizzle client override, for tests.
 * @returns Candidates keyed by the send they are due, offsets with no cohort omitted.
 */
export async function findPreExpiryCohorts(input: {
    readonly sends: readonly TrialSeriesSend[];
    readonly now?: Date;
    readonly db?: DrizzleClient;
}): Promise<Map<number, TrialSeriesCandidate[]>> {
    const { sends } = input;
    const now = input.now ?? new Date();
    const db = input.db ?? getDb();

    const horizon = new Date(now.getTime() + (MAX_PRE_OFFSET + 1) * DAY_MS);

    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            trialEnd: billingSubscriptions.trialEnd,
            metadata: billingSubscriptions.metadata
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING),
                isNull(billingSubscriptions.mpSubscriptionId),
                isNull(billingSubscriptions.deletedAt),
                isNotNull(billingSubscriptions.trialEnd),
                gte(billingSubscriptions.trialEnd, now),
                lte(billingSubscriptions.trialEnd, horizon)
            )
        );

    const byOffset = new Map<number, TrialSeriesCandidate[]>();

    for (const row of rows) {
        if (!row.trialEnd) continue;

        const remaining = daysUntil(row.trialEnd, now);
        const send = sends.find((s) => s.direction === 'pre' && Math.abs(s.offset) === remaining);
        if (!send) continue;

        const bucket = byOffset.get(send.offset) ?? [];
        bucket.push({
            subscriptionId: row.id,
            customerId: row.customerId,
            planId: row.planId,
            trialEnd: row.trialEnd,
            ...(readIntendedInterval(row.metadata)
                ? { intendedInterval: readIntendedInterval(row.metadata) }
                : {})
        });
        byOffset.set(send.offset, bucket);
    }

    return byOffset;
}

/**
 * Select the trials due the EXPIRY-DAY send or a WIN-BACK today (offsets 0, +1,
 * +5, +10, +30, +60).
 *
 * The distance is measured from the `TRIAL_EXPIRED` event, NOT from
 * `trial_end`. Those two are usually the same day, but they come apart exactly
 * when it matters: if the expiry job is down for two days, `trial_end` says the
 * listing came down on Monday while the owner watched it come down on
 * Wednesday. Every one of these six emails talks about that event — "hoy salió
 * del sitio", "ayer", "pasaron diez días" — so it has to be measured from when
 * it actually happened. Gating on the event also means the expiry mail can
 * never announce a takedown that has not run.
 *
 * @param input.now - Clock override, for tests.
 * @param input.db - Drizzle client override, for tests.
 * @returns Candidates keyed by the send they are due, offsets with no cohort omitted.
 */
export async function findPostExpiryCohorts(input: {
    readonly sends: readonly TrialSeriesSend[];
    readonly now?: Date;
    readonly db?: DrizzleClient;
}): Promise<Map<number, TrialSeriesCandidate[]>> {
    const { sends } = input;
    const now = input.now ?? new Date();
    const db = input.db ?? getDb();

    const earliest = new Date(now.getTime() - (MAX_POST_OFFSET + 1) * DAY_MS);

    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId,
            trialEnd: billingSubscriptions.trialEnd,
            metadata: billingSubscriptions.metadata,
            expiredAt: billingSubscriptionEvents.createdAt
        })
        .from(billingSubscriptions)
        .innerJoin(
            billingSubscriptionEvents,
            and(
                eq(billingSubscriptionEvents.subscriptionId, billingSubscriptions.id),
                eq(billingSubscriptionEvents.eventType, BILLING_EVENT_TYPES.TRIAL_EXPIRED)
            )
        )
        .where(
            and(
                isNull(billingSubscriptions.mpSubscriptionId),
                isNull(billingSubscriptions.deletedAt),
                gte(billingSubscriptionEvents.createdAt, earliest)
            )
        );

    const byOffset = new Map<number, TrialSeriesCandidate[]>();

    for (const row of rows) {
        if (!row.expiredAt) continue;

        const elapsed = daysSince(row.expiredAt, now);
        const send = sends.find(
            (s) => (s.direction === 'expiry' || s.direction === 'post') && s.offset === elapsed
        );
        if (!send) continue;

        const bucket = byOffset.get(send.offset) ?? [];
        bucket.push({
            subscriptionId: row.id,
            customerId: row.customerId,
            planId: row.planId,
            // `trial_end` is what the templates print; the event date is only
            // what selects the bucket. Falls back to the event date on the rows
            // (none today) that carry no trial_end.
            trialEnd: row.trialEnd ?? row.expiredAt,
            ...(readIntendedInterval(row.metadata)
                ? { intendedInterval: readIntendedInterval(row.metadata) }
                : {})
        });
        byOffset.set(send.offset, bucket);
    }

    return byOffset;
}

/**
 * Whether the customer is paying RIGHT NOW (HOS-1012 T-018).
 *
 * The series stops entirely the moment the person pays, and "the moment" is
 * meant literally: this is re-read immediately before each dispatch, never
 * taken from the snapshot the cohort query returned. A cohort assembled at
 * 08:00 and mailed at 08:04 can contain someone who paid at 08:02, and mailing
 * them "tu publicación sale del sitio" minutes after they bought a plan is the
 * single worst thing this series can do.
 *
 * Reads any entitlement-granting subscription for the customer, in any product
 * domain: paying for a gastronomy listing does not stop an accommodation trial
 * from expiring, but the trial row this series is chasing is superseded by the
 * customer's own new subscription (T-022), and that new row is what shows up
 * here.
 *
 * @param input.customerId - Billing customer to re-check.
 * @param input.excludeSubscriptionId - The trial row itself, which is still
 *   `trialing` and would otherwise count as live.
 * @param input.db - Drizzle client override, for tests.
 */
export async function customerIsPaying(input: {
    readonly customerId: string;
    readonly excludeSubscriptionId: string;
    readonly db?: DrizzleClient;
}): Promise<boolean> {
    const { customerId, excludeSubscriptionId } = input;
    const db = input.db ?? getDb();

    const rows = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customerId),
                isNull(billingSubscriptions.deletedAt)
            )
        );

    return rows.some(
        (row) =>
            row.id !== excludeSubscriptionId &&
            row.status !== SubscriptionStatusEnum.TRIALING &&
            isEntitlementGrantingStatus(row.status)
    );
}
