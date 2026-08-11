/**
 * @file resolve-trade-stats.ts
 * @description What the directory card is allowed to claim about a provider
 * (HOS-376 T-052, §6.5).
 *
 * The card carries reputation about a real person's trade, so every number on
 * it is a claim that has to be backed. Two rules do the work:
 *
 *  - **An average needs {@link HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE} reviews
 *    behind it** (AC-25). One disgruntled host would otherwise print "★ 1,0"
 *    over a plumber's name, and a single delighted one "★ 5,0" — neither is a
 *    rating, both read like one. Below the threshold the count still shows:
 *    "2 valoraciones" is honest and lets a host go read them.
 *  - **Uses and distinct hosts travel together** (AC-26). The pair is the
 *    anti-collusion signal: "34 usos · 21 anfitriones" reads well precisely
 *    because "40 usos · 2 anfitriones" would give itself away.
 *
 * Separated from the card because these are claims about values, and an
 * assertion on rendered output cannot tell a withheld average from a branch
 * that was never reached.
 */

import { HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE } from '@repo/schemas';

/** The aggregate columns the card reads, all optional as the schema has them. */
export interface TradeStatsSource {
    readonly reviewsCount?: number | undefined;
    readonly averageRating?: number | undefined;
    readonly confirmedUsesCount?: number | undefined;
    readonly distinctHostsCount?: number | undefined;
}

/** The resolved line, with every absence already decided. */
export interface TradeStats {
    /** The rating to print, or `null` when it must be withheld. */
    readonly average: number | null;
    readonly reviewsCount: number;
    readonly confirmedUsesCount: number;
    readonly distinctHostsCount: number;
    /**
     * Whether the provider has no activity at all.
     *
     * A brand-new provider renders no stats line rather than a row of zeros —
     * the same rule `isMeaningfulStat` applies on the home page, and for the
     * same reason: a rendered "0" reads as a measurement, not as absence.
     */
    readonly isEmpty: boolean;
}

/**
 * Decides which stats a provider's card may state.
 *
 * @param params - The provider's aggregate columns.
 * @param params.trade - The aggregates, as the public tier serves them.
 * @returns The resolved line.
 */
export function resolveTradeStats({ trade }: { readonly trade: TradeStatsSource }): TradeStats {
    const reviewsCount = trade.reviewsCount ?? 0;
    const confirmedUsesCount = trade.confirmedUsesCount ?? 0;
    const distinctHostsCount = trade.distinctHostsCount ?? 0;

    // The count is what the threshold is measured against, not the rating:
    // a rating with no reviews behind it is stale aggregate state.
    const hasEnoughReviews = reviewsCount >= HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE;
    const rating = trade.averageRating;
    const average = hasEnoughReviews && typeof rating === 'number' && rating > 0 ? rating : null;

    return {
        average,
        reviewsCount,
        confirmedUsesCount,
        distinctHostsCount,
        isEmpty: reviewsCount === 0 && confirmedUsesCount === 0 && distinctHostsCount === 0
    };
}
