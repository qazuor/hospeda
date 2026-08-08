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

    const aggregates: HostTradeAggregates = {
        confirmedUsesCount: usageRow?.confirmedUsesCount ?? 0,
        distinctHostsCount: usageRow?.distinctHostsCount ?? 0,
        reviewsCount: reviewRow?.reviewsCount ?? 0,
        averageRating: reviewRow?.averageRating ?? 0,
        benefitRespectedCount: reviewRow?.benefitRespectedCount ?? 0
    };

    await db.update(hostTrades).set(aggregates).where(eq(hostTrades.id, hostTradeId));

    return { aggregates };
}
