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
 * - inquiries of THIS accommodation in the period:
 *   `ConversationService.countInquiriesForOwnAccommodation` (soft-deleted
 *   conversations excluded), reported as `inquiriesThisListing`;
 * - inquiries per month and response rate / time:
 *   `ConversationService.getHostMonthlyInquiries` and `getHostResponseRate`
 *   (`routes/conversations/protected/{monthly-inquiries,response-rate}.ts`).
 *   Those two are computed over ALL the owner's accommodations, not this one;
 *   they live under `allMyAccommodations` with `scope`, apart from the
 *   per-listing figure, so the two cannot be mixed up.
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
     * Inquiries received by THIS accommodation alone in the selected period
     * (same days as `views.current`). Omitted when the owner may not read inquiries.
     */
    readonly inquiriesThisListing?: {
        readonly period: string;
        readonly count: number;
    };
    /**
     * Figures computed over ALL of the owner's accommodations, never over this
     * one alone. Do not present them as this listing's. Omitted when the owner
     * may not read inquiries.
     */
    readonly allMyAccommodations?: {
        readonly scope: 'all_my_accommodations';
        /** Inquiries per calendar month, the current one (so far) and the previous one. */
        readonly inquiriesByMonth: readonly MonthlyInquiries[];
        /** Reply rate in percent (0 to 100), all time. */
        readonly responseRatePercent: number;
        /** Average minutes from the first guest message to the first reply, all time; `null` while none was answered. */
        readonly averageResponseMinutes: number | null;
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
    period,
    windowDays,
    includeFavorites
}: {
    readonly actor: Actor;
    readonly listingId: string;
    /** The selected period label (`7d`, `30d`, `90d`). */
    readonly period: string;
    /** Its length in days, the same window the views use. */
    readonly windowDays: number;
    /** Whether the plan includes `view_advanced_stats`; favorites are read only then. */
    readonly includeFavorites: boolean;
}): Promise<AccommodationExtrasResult> {
    const conversations = getInquiryConversationService();
    const [favorites, monthly, responseRate, listingInquiries] = await Promise.all([
        includeFavorites
            ? listingToolBookmarkService.countBookmarksForEntity(actor, {
                  entityId: listingId,
                  entityType: EntityTypeEnum.ACCOMMODATION
              })
            : undefined,
        conversations.getHostMonthlyInquiries(actor, { months: LISTING_STATS_INQUIRY_MONTHS }),
        conversations.getHostResponseRate(actor),
        conversations.countInquiriesForOwnAccommodation(actor, {
            accommodationId: listingId,
            windowDays
        })
    ]);

    if (favorites?.error) {
        return { error: favorites.error };
    }
    // Missing permission means "not available to this owner", not a failure.
    for (const result of [monthly, responseRate, listingInquiries]) {
        if (result.error && result.error.code !== ServiceErrorCode.FORBIDDEN) {
            return { error: result.error };
        }
    }

    return {
        extras: {
            ...(favorites ? { favorites: favorites.data?.count ?? 0 } : {}),
            ...(includeFavorites ? {} : { omitted: { favorites: 'not_in_plan' as const } }),
            ...(listingInquiries.data
                ? { inquiriesThisListing: { period, count: listingInquiries.data.count } }
                : {}),
            ...(monthly.data && responseRate.data
                ? {
                      allMyAccommodations: {
                          scope: 'all_my_accommodations' as const,
                          inquiriesByMonth: monthly.data.map(({ month, count }) => ({
                              month,
                              count
                          })),
                          responseRatePercent: responseRate.data.responseRatePct,
                          averageResponseMinutes: responseRate.data.avgResponseTimeMinutes
                      }
                  }
                : {})
        }
    };
}
