/**
 * @file get-listing-stats.accommodation.ts
 * @description The accommodation-only extras of `get_listing_stats` (HOS-2184
 * T-025, AC-9). Venues and experiences have no equivalent, so for them the
 * tool omits the whole block (never zero): favorites are not tracked for them
 * and only accommodations receive inquiries (spec §5, NG-2).
 *
 * Sources, the same calls the owner panel's stats cards make:
 * - favorites: `UserBookmarkService.countBookmarksForEntity` for this one
 *   accommodation (`routes/accommodation/protected/hostFavoritesBreakdown.ts`);
 *   soft-deleted bookmarks are excluded by the service;
 * - inquiries per month and response rate / time:
 *   `ConversationService.getHostMonthlyInquiries` and `getHostResponseRate`
 *   (`routes/conversations/protected/{monthly-inquiries,response-rate}.ts`).
 *   Those two are computed over ALL the owner's accommodations, not this one,
 *   and the result says so in `scope`.
 *
 * Favorites need the `view_advanced_stats` entitlement, exactly as
 * `hostFavoritesBreakdown` requires; without it they are omitted and `omitted`
 * says so.
 *
 * The two conversation reads need `CONVERSATION_VIEW_OWN`. An owner without it
 * gets those metrics omitted; any other failure is reported as an error.
 */

import { EntityTypeEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { getInquiryConversationService } from '../inquiry/inquiry-services';
import type { ToolErrorPayload } from '../tool-definition';
import { listingToolBookmarkService } from './listing-services';

/** Months of inquiries returned: the current one (so far) and the previous one. */
export const LISTING_STATS_INQUIRY_MONTHS = 2;

/** Inquiries received in one calendar month. */
export interface MonthlyInquiries {
    /** Calendar month, `YYYY-MM`. */
    readonly month: string;
    /** Inquiries (conversations) started that month. */
    readonly count: number;
}

/** Accommodation-only block of `get_listing_stats`. */
export interface AccommodationStatsExtras {
    /**
     * Users who currently have this accommodation saved as a favorite. Not tied
     * to the period. Omitted (see `omitted`) when the plan lacks `view_advanced_stats`.
     */
    readonly favorites?: number;
    /** Metrics left out of this block and why. Absent when nothing was left out. */
    readonly omitted?: { readonly favorites: 'not_in_plan' };
    /**
     * Inquiries per calendar month over ALL the owner's accommodations (not only
     * this one). Omitted when the owner may not read inquiries.
     */
    readonly inquiries?: {
        readonly scope: 'all_my_accommodations';
        readonly byMonth: readonly MonthlyInquiries[];
    };
    /**
     * Reply speed over ALL the owner's accommodations, all time. Omitted when
     * the owner may not read inquiries.
     */
    readonly responseTime?: {
        readonly scope: 'all_my_accommodations';
        /** Share of inquiries that got at least one owner reply, in percent (0 to 100). */
        readonly responseRatePercent: number;
        /** Average minutes from the first guest message to the first reply; `null` while none was answered. */
        readonly averageMinutes: number | null;
    };
}

/** Outcome of the extras read. */
export type AccommodationExtrasResult =
    | { readonly extras: AccommodationStatsExtras; readonly error?: never }
    | { readonly extras?: never; readonly error: ToolErrorPayload };

/**
 * Reads the accommodation-only stats of a listing the caller owns.
 *
 * @param args - The actor and the (already authorized) accommodation id
 * @returns The extras, or the service error to report
 */
export async function readAccommodationStatsExtras({
    actor,
    listingId,
    includeFavorites
}: {
    readonly actor: Actor;
    readonly listingId: string;
    /** Whether the plan includes `view_advanced_stats`; favorites are read only then. */
    readonly includeFavorites: boolean;
}): Promise<AccommodationExtrasResult> {
    const conversations = getInquiryConversationService();
    const [favorites, monthly, responseRate] = await Promise.all([
        includeFavorites
            ? listingToolBookmarkService.countBookmarksForEntity(actor, {
                  entityId: listingId,
                  entityType: EntityTypeEnum.ACCOMMODATION
              })
            : undefined,
        conversations.getHostMonthlyInquiries(actor, { months: LISTING_STATS_INQUIRY_MONTHS }),
        conversations.getHostResponseRate(actor)
    ]);

    if (favorites?.error) {
        return { error: favorites.error };
    }
    // Missing permission means "not available to this owner", not a failure.
    for (const result of [monthly, responseRate]) {
        if (result.error && result.error.code !== ServiceErrorCode.FORBIDDEN) {
            return { error: result.error };
        }
    }

    return {
        extras: {
            ...(favorites ? { favorites: favorites.data?.count ?? 0 } : {}),
            ...(includeFavorites ? {} : { omitted: { favorites: 'not_in_plan' as const } }),
            ...(monthly.data
                ? {
                      inquiries: {
                          scope: 'all_my_accommodations' as const,
                          byMonth: monthly.data.map(({ month, count }) => ({ month, count }))
                      }
                  }
                : {}),
            ...(responseRate.data
                ? {
                      responseTime: {
                          scope: 'all_my_accommodations' as const,
                          responseRatePercent: responseRate.data.responseRatePct,
                          averageMinutes: responseRate.data.avgResponseTimeMinutes
                      }
                  }
                : {})
        }
    };
}
