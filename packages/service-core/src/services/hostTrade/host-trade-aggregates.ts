import type { DrizzleClient } from '@repo/db';
import {
    and,
    eq,
    getDb,
    hostTradeBenefitUsages,
    hostTradeReviews,
    hostTrades,
    isNull,
    sql
} from '@repo/db';
import { HostTradeUsageStatusEnum, ModerationStatusEnum } from '@repo/schemas';

/**
 * @file host-trade-aggregates.ts
 * @description Recomputes the five denormalised counters on `host_trades`
 * (HOS-376 §7.2).
 *
 * Recalculated from TypeScript on every write that can move them, in the mould
 * of `recalculateAndUpdateAccommodationStats` — deliberately NOT a Postgres
 * trigger. Two reasons, both practical: a trigger is invisible to anyone
 * reading the service, and it would fire on paths that must NOT recount (a
 * moderation decision is a plain UPDATE, and telling "APPROVED → REJECTED"
 * apart from "content edited" inside a trigger means duplicating the domain
 * rules in PL/pgSQL).
 *
 * The counters are always recomputed from the rows that exist, never
 * incremented. An increment drifts the first time a write fails halfway, and a
 * drifted counter is invisible: nothing about "37 usos" says it should have
 * said 36.
 */

/** The five denormalised values, as written to the listing. */
export interface HostTradeAggregates {
    /** CONFIRMED, non-deleted usages. */
    readonly confirmedUsesCount: number;
    /** Distinct hosts among those usages — the anti-collusion signal (§6.5). */
    readonly distinctHostsCount: number;
    /** APPROVED, non-deleted reviews. */
    readonly reviewsCount: number;
    /** Mean `overallRating` of those reviews, 2 decimals, 0 when there are none. */
    readonly averageRating: number;
    /** How many of those reviews say the benefit was honoured. */
    readonly benefitRespectedCount: number;
}

/**
 * Recomputes and persists the five aggregates for one provider listing.
 *
 * Only CONFIRMED usages and APPROVED reviews count, and soft-deleted rows never
 * do. That is not a detail: the numbers are what the public card shows, so they
 * must match exactly what the public list serves. A PENDING review contributing
 * to the average would publish, through a number, the very text moderation is
 * still holding back.
 *
 * `distinctHostsCount` counts HOSTS, not rows. Three visits by the same host
 * are three usages and one client, and collapsing the two would erase the
 * signal the column exists for — "40 usos · 2 anfitriones" delata solo.
 *
 * @param params.hostTradeId - The listing to recompute.
 * @param params.tx - Optional transaction client, so the recount joins the
 *   caller's boundary instead of committing on its own.
 * @returns The aggregates that were written.
 */
export async function recalculateHostTradeAggregates(params: {
    hostTradeId: string;
    tx?: DrizzleClient;
}): Promise<{ aggregates: HostTradeAggregates }> {
    const { hostTradeId, tx } = params;
    const db = tx ?? getDb();

    const aggregates = await computeHostTradeAggregates({ hostTradeId, tx });

    await db.update(hostTrades).set(aggregates).where(eq(hostTrades.id, hostTradeId));

    return { aggregates };
}

/**
 * Computes the five aggregates WITHOUT persisting them.
 *
 * Split out of {@link recalculateHostTradeAggregates} so the weekly
 * reconciliation can compare stored against real, and so its `dryRun` is a real
 * read rather than a write it promises not to have made.
 *
 * @param params.hostTradeId - The listing to measure.
 * @param params.tx - Optional transaction client.
 * @returns What the rows currently add up to.
 */
export async function computeHostTradeAggregates(params: {
    hostTradeId: string;
    tx?: DrizzleClient;
}): Promise<HostTradeAggregates> {
    const { hostTradeId, tx } = params;
    const db = tx ?? getDb();

    const [usageRow] = await db
        .select({
            confirmedUsesCount: sql<number>`count(*)::int`,
            distinctHostsCount: sql<number>`count(distinct ${hostTradeBenefitUsages.hostUserId})::int`
        })
        .from(hostTradeBenefitUsages)
        .where(
            and(
                eq(hostTradeBenefitUsages.hostTradeId, hostTradeId),
                eq(hostTradeBenefitUsages.status, HostTradeUsageStatusEnum.CONFIRMED),
                isNull(hostTradeBenefitUsages.deletedAt)
            )
        );

    const [reviewRow] = await db
        .select({
            reviewsCount: sql<number>`count(*)::int`,
            // Rounded in SQL because the column is numeric(3,2): a raw mean of
            // 4.333… is not a value this column can hold.
            averageRating: sql<number>`coalesce(round(avg(${hostTradeReviews.overallRating})::numeric, 2), 0)::float`,
            benefitRespectedCount: sql<number>`(count(*) filter (where ${hostTradeReviews.respectedBenefit}))::int`
        })
        .from(hostTradeReviews)
        .where(
            and(
                eq(hostTradeReviews.hostTradeId, hostTradeId),
                eq(hostTradeReviews.moderationState, ModerationStatusEnum.APPROVED),
                isNull(hostTradeReviews.deletedAt)
            )
        );

    return {
        confirmedUsesCount: usageRow?.confirmedUsesCount ?? 0,
        distinctHostsCount: usageRow?.distinctHostsCount ?? 0,
        reviewsCount: reviewRow?.reviewsCount ?? 0,
        averageRating: reviewRow?.averageRating ?? 0,
        benefitRespectedCount: reviewRow?.benefitRespectedCount ?? 0
    };
}

/** One listing whose stored counters did not match the recomputed ones. */
export interface HostTradeAggregateDrift {
    /** The listing that was wrong. */
    readonly hostTradeId: string;
    /** What the row said before. */
    readonly stored: Partial<HostTradeAggregates>;
    /** What the rows actually add up to. */
    readonly recomputed: HostTradeAggregates;
}

/**
 * Recomputes every listing's counters and reports the ones that had drifted
 * (HOS-376 T-044, AC-29).
 *
 * THE BACKSTOP, NOT THE MECHANISM (R-6). Every write that can move a counter
 * already recomputes it, so a healthy week corrects nothing — and that is the
 * point: a run that reports drift is evidence one of those write paths has a
 * hole. Without this, a wrong number is invisible, because nothing about
 * "37 usos" says it should have said 36.
 *
 * `dryRun` reads and compares without writing, so the weekly check can be run
 * against production to SEE the drift before deciding to paper over it.
 *
 * @param params.dryRun - Compare only; do not persist corrections.
 * @param params.tx - Optional transaction client, matching the two functions
 *   above. The cron passes none, so its behaviour is unchanged; the parameter
 *   exists because a scan-and-correct over the whole table is otherwise
 *   untestable — it would have to write outside the caller's boundary.
 * @returns How many listings were checked, and every one that was wrong.
 */
export async function reconcileAllHostTradeAggregates(params?: {
    dryRun?: boolean;
    tx?: DrizzleClient;
}): Promise<{ checked: number; corrected: HostTradeAggregateDrift[] }> {
    const db = params?.tx ?? getDb();
    const rows = await db
        .select({
            id: hostTrades.id,
            confirmedUsesCount: hostTrades.confirmedUsesCount,
            distinctHostsCount: hostTrades.distinctHostsCount,
            reviewsCount: hostTrades.reviewsCount,
            averageRating: hostTrades.averageRating,
            benefitRespectedCount: hostTrades.benefitRespectedCount
        })
        .from(hostTrades);

    const corrected: HostTradeAggregateDrift[] = [];

    for (const row of rows) {
        const recomputed = await computeHostTradeAggregates({
            hostTradeId: row.id,
            tx: params?.tx
        });

        const stored = {
            confirmedUsesCount: row.confirmedUsesCount,
            distinctHostsCount: row.distinctHostsCount,
            reviewsCount: row.reviewsCount,
            averageRating: Number(row.averageRating ?? 0),
            benefitRespectedCount: row.benefitRespectedCount
        };

        const drifted =
            stored.confirmedUsesCount !== recomputed.confirmedUsesCount ||
            stored.distinctHostsCount !== recomputed.distinctHostsCount ||
            stored.reviewsCount !== recomputed.reviewsCount ||
            stored.benefitRespectedCount !== recomputed.benefitRespectedCount ||
            Math.abs(stored.averageRating - recomputed.averageRating) > 0.001;

        if (!drifted) continue;

        corrected.push({ hostTradeId: row.id, stored, recomputed });

        if (!params?.dryRun) {
            await db.update(hostTrades).set(recomputed).where(eq(hostTrades.id, row.id));
        }
    }

    return { checked: rows.length, corrected };
}
