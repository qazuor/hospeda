/**
 * @file get-listing-stats.ts
 * @description Tool `get_listing_stats` (HOS-2184 T-024, spec §6.5, AC-9,
 * AC-6): views and reviews of one of the caller's listings, with the previous
 * period for comparison.
 *
 * Where each metric comes from (nothing is invented; these are what the owner
 * panel shows):
 * - views: `EntityViewService.getDailySeriesComparisonForOwnListing`, the
 *   `entity_views` daily series of ONE listing (the panel shows the same series
 *   summed over all of the owner's listings, `routes/{venue,experience}/protected/viewStats*`);
 * - reviews count and average: the listing's own `reviewsCount` and
 *   `averageRating` columns, as the panel dashboard reads them
 *   (`dashboard-sources/host.ts`); latest reviews: `listing-stats-readers.ts`.
 *
 * Ownership is `get_listing`'s: the vertical service's `getById` plus the
 * `READ_OWN` resource step. A missing, foreign, staff-visible-only or purged
 * listing is the same not-found error (AC-6).
 *
 * Plan gated, like the HTTP routes: the call needs the `view_basic_stats`
 * entitlement, and the favorites block needs `view_advanced_stats`. Without the
 * basic entitlement the call is refused (see `enforceUserGate`).
 *
 * Review titles and texts are written by third parties, so they are returned
 * inside the untrusted-data envelope (spec §6.6).
 */

import { EntityTypeEnum, ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { entityViewService, type HostViewDailySeriesOutputItem } from '@repo/service-core';
import { z } from 'zod';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { type OwnListingRow, readOwnListingRow } from './get-listing';
import {
    type AccommodationStatsExtras,
    readAccommodationStatsExtras
} from './get-listing-stats.accommodation';
import { listingRefusalLink, readListingRef } from './listing-refusal-actions';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';
import { readLatestListingReviews } from './listing-stats-readers';
import {
    hasAdvancedStatsEntitlement,
    hasBasicStatsEntitlement,
    NO_STATS_ENTITLEMENT_REASON
} from './stats-entitlement';

/** Periods offered for views. The panel offers 7d and 30d; 90d has no comparison. */
export const LISTING_STATS_PERIODS = ['7d', '30d', '90d'] as const;

/** Days in each period. */
export const LISTING_STATS_PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

/** Latest reviews returned with the stats. */
export const LISTING_STATS_LATEST_REVIEWS = 3;

/** Input schema: which listing, over which period. */
export const GetListingStatsInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical returned by list_my_listings for this listing.'
        ),
        listingId: z.uuid().describe('The listing id returned by list_my_listings.'),
        period: z
            .enum(LISTING_STATS_PERIODS)
            .default('30d')
            .describe(
                'Length of the views period: the last 7, 30 or 90 days, today included. Defaults to 30d. 90d has no previous-period comparison.'
            )
    })
    .strict();

/** One period of views. */
export interface ListingViewsPeriod {
    /** First day, `YYYY-MM-DD` (Argentina calendar day). */
    readonly from: string;
    /** Last day, `YYYY-MM-DD`. */
    readonly to: string;
    /** Visits in the period. */
    readonly views: number;
}

/** Views of the period, the previous period and their difference. */
export interface ListingViewsStats {
    /** The last `period` days, today included. */
    readonly current: ListingViewsPeriod;
    /**
     * `available`: `previous`, `change` and `changePercent` are filled.
     * `unavailable_beyond_retention`: the previous period would reach back past
     * the 120 days views are kept, so they are `null`.
     */
    readonly comparison: 'available' | 'unavailable_beyond_retention';
    /** The `period` days right before `current`; `null` when the comparison is unavailable. */
    readonly previous: ListingViewsPeriod | null;
    /** `current.views - previous.views`; `null` when the comparison is unavailable. */
    readonly change: number | null;
    /**
     * Change relative to the previous period, in percent; `null` when it had no
     * views or when the comparison is unavailable.
     */
    readonly changePercent: number | null;
}

/** A review, with its third-party text delimited. */
export interface ListingLatestReview {
    /** Delimited review title, `null` when there is none. */
    readonly title: string | null;
    /** Delimited review text, `null` when there is none. */
    readonly comment: string | null;
    /** The review's average rating (0 to 5). */
    readonly rating: number;
    /** When the review was written (ISO 8601). */
    readonly createdAt: string;
}

/** Review stats. All-time, not tied to the period. */
export interface ListingReviewsStats {
    /** Approved reviews, all time. */
    readonly count: number;
    /** Average rating (0 to 5), all time; `null` while there are no reviews. */
    readonly averageRating: number | null;
    /** The most recent approved reviews, newest first. */
    readonly latest: readonly ListingLatestReview[];
}

/** Result of `get_listing_stats`. */
export interface ListingStats {
    /** Listing id. */
    readonly listingId: string;
    /** Vertical of the listing. */
    readonly vertical: ListingToolVertical;
    /** Public name of the listing. */
    readonly name: string;
    /** The period the `views` block covers. */
    readonly period: (typeof LISTING_STATS_PERIODS)[number];
    /** Views for the period and the one before it. */
    readonly views: ListingViewsStats;
    /** Reviews, all time. */
    readonly reviews: ListingReviewsStats;
    /** Accommodation-only metrics. Absent for venues and experiences. */
    readonly accommodation?: AccommodationStatsExtras;
}

/** `reason` of the refusal when the plan has no stats; its Spanish text is below. */
export { NO_STATS_ENTITLEMENT_REASON };

/** Spanish messages for the reasons this tool refuses with. */
const GET_LISTING_STATS_REASON_MESSAGES: Readonly<Record<string, string>> = {
    [NO_STATS_ENTITLEMENT_REASON]:
        'Tu plan no incluye estadísticas. Podés mejorar tu plan desde tu panel de Hospeda para verlas.'
};

/** Entity type the view telemetry is keyed by, per vertical. */
const ENTITY_TYPE_FOR = {
    [VerticalEnum.ACCOMMODATION]: EntityTypeEnum.ACCOMMODATION,
    [VerticalEnum.VENUE]: EntityTypeEnum.VENUE,
    [VerticalEnum.EXPERIENCE]: EntityTypeEnum.EXPERIENCE
} as const;

/** Sums a daily series into one period. */
function toPeriod(series: readonly HostViewDailySeriesOutputItem[]): ListingViewsPeriod {
    return {
        from: series[0]?.date ?? '',
        to: series[series.length - 1]?.date ?? '',
        views: series.reduce((sum, day) => sum + day.total, 0)
    };
}

/** Compares two periods. */
function toViewsStats(input: {
    readonly current: readonly HostViewDailySeriesOutputItem[];
    readonly previous: readonly HostViewDailySeriesOutputItem[] | null;
}): ListingViewsStats {
    const current = toPeriod(input.current);
    if (input.previous === null) {
        return {
            current,
            comparison: 'unavailable_beyond_retention',
            previous: null,
            change: null,
            changePercent: null
        };
    }
    const previous = toPeriod(input.previous);
    const change = current.views - previous.views;
    return {
        current,
        comparison: 'available',
        previous,
        change,
        changePercent:
            previous.views === 0 ? null : Math.round((change / previous.views) * 1000) / 10
    };
}

/** Builds the reviews block from the row's aggregates and the latest reviews. */
async function readReviews(input: {
    readonly vertical: ListingToolVertical;
    readonly row: OwnListingRow;
}): Promise<ListingReviewsStats> {
    const { vertical, row } = input;
    const count = row.reviewsCount ?? 0;
    const latest =
        count > 0
            ? await readLatestListingReviews({
                  vertical,
                  listingId: row.id,
                  limit: LISTING_STATS_LATEST_REVIEWS
              })
            : [];
    return {
        count,
        averageRating: count > 0 ? (row.averageRating ?? 0) : null,
        latest: latest.map((review) => ({
            title:
                review.title === null
                    ? null
                    : wrapUntrustedText({ text: review.title, source: 'review' }),
            comment:
                review.content === null
                    ? null
                    : wrapUntrustedText({ text: review.content, source: 'review' }),
            rating: review.averageRating,
            createdAt: review.createdAt.toISOString()
        }))
    };
}

/**
 * `get_listing_stats`: read-only, available to an unverified email exactly as
 * the HTTP get-own routes are (`READ_OWN`).
 */
export const getListingStatsTool = defineTool({
    name: 'get_listing_stats',
    title: 'Estadísticas de la publicación',
    description: `Reads the statistics of one listing the connected Hospeda user owns. Returns "views": visits in the chosen period (last 7, 30 or 90 days, today included, Argentina calendar days; a visitor returning within 30 minutes counts once) next to the previous period of the same length, with the change and the percent change (percent is null when the previous period had no views). For 90d there is NO comparison: views are only kept for 120 days, so "comparison" is "unavailable_beyond_retention" and previous, change and changePercent are null. Returns "reviews": approved review count and average rating, ALL TIME and not tied to the period (average is null when there are no reviews), plus the latest reviews with title, comment and rating. Requires the plan's basic stats; without it the call is refused with "Tu plan no incluye estadísticas". Works for accommodations, venues and experiences. For accommodations only it also returns "accommodation": "favorites" (users who currently saved it, not tied to the period; only with the plan's advanced stats, otherwise left out and "omitted": {"favorites": "not_in_plan"} says why), "inquiriesThisListing" (inquiries THIS accommodation received in the selected period) and "allMyAccommodations" (scope all_my_accommodations: inquiries per calendar month, this month and the previous one, plus reply rate in percent and average minutes to the first reply, all time; these cover ALL the owner's accommodations, never present them as this listing's). Inquiries figures are omitted if the user may not read inquiries. Venues and experiences have no "accommodation" block at all. Metrics that do not exist for a vertical are omitted, never reported as zero. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and listingId from list_my_listings. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: GetListingStatsInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    reasonMessages: GET_LISTING_STATS_REASON_MESSAGES,
    refusalAction: ({ error, input }) => {
        const ref = readListingRef({ input, idKey: 'listingId' });
        if (ref === undefined) {
            return undefined;
        }
        return error.reason === NO_STATS_ENTITLEMENT_REASON
            ? { destination: { kind: 'plans', vertical: ref.vertical } }
            : listingRefusalLink({ error, ref });
    },
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListingStats>> => {
        const { vertical, listingId, period } = input;

        // The same capability the HTTP stats routes require of this vertical.
        if (!(await hasBasicStatsEntitlement({ userId: actor.id, vertical }))) {
            return {
                error: {
                    code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                    message: 'Entitlement required',
                    reason: NO_STATS_ENTITLEMENT_REASON
                }
            };
        }
        const admitted = await readOwnListingRow({ actor, vertical, id: listingId });
        if (admitted.error) {
            return admitted.error;
        }
        const { row } = admitted;

        const isAccommodation = vertical === VerticalEnum.ACCOMMODATION;
        // Favorites need the advanced capability, as `hostFavoritesBreakdown` does.
        const includeFavorites =
            isAccommodation && (await hasAdvancedStatsEntitlement({ userId: actor.id, vertical }));
        const [viewsResult, reviews, extras] = await Promise.all([
            entityViewService.getDailySeriesComparisonForOwnListing({
                actor,
                entityType: ENTITY_TYPE_FOR[vertical],
                listingId: row.id,
                window: period
            }),
            readReviews({ vertical, row }),
            isAccommodation
                ? readAccommodationStatsExtras({
                      actor,
                      listingId: row.id,
                      period,
                      windowDays: LISTING_STATS_PERIOD_DAYS[period],
                      includeFavorites
                  })
                : undefined
        ]);
        if (viewsResult.error) {
            return { error: viewsResult.error };
        }
        if (extras?.error) {
            return { error: extras.error };
        }

        return {
            data: {
                listingId: row.id,
                vertical,
                name: row.name,
                period,
                views: toViewsStats(viewsResult.data),
                reviews,
                ...(extras?.extras ? { accommodation: extras.extras } : {})
            }
        };
    }
});
