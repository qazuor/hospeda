/**
 * @file owner-summary-metrics.ts
 * @description The metrics block of `get_owner_summary` (HOS-2331, spec
 * HOS-2335 §6.6), one entry per vertical the owner has listings in.
 *
 * Gated per vertical exactly like `get_listing_stats` (`stats-entitlement.ts`):
 * without `view_basic_stats` the vertical's entry is ONLY the omission note
 * (owner decision D-9); listing counts and attention are never gated. With it:
 *
 * - views: `EntityViewService.getStatsForHostAccommodations` /
 *   `getStatsForOwnListings`, the owner-wide reads behind the portal's views
 *   cards (`routes/views/protected/accommodations-me.ts`,
 *   `routes/{venue,experience}/protected/viewStats.ts`), summed;
 * - new reviews in the period: `readOwnerListingReviews`, the owner review
 *   reader of `list_reviews` (§6.5), filtered by `since`;
 * - accommodation inquiries: `ConversationService.getHostMonthlyInquiries` and
 *   `getHostResponseRate`, as `get_listing_stats` reads them;
 * - unanswered inquiries: conversations in `PENDING_OWNER`, the `total` of the
 *   `list_inquiries` read (`ConversationService.listForOwner`);
 * - favorites (advanced stats): `countAccommodationFavorites`, a sum of live
 *   bookmarks, not of distinct users.
 *
 * A metric that cannot be read for a permission reason is OMITTED, never zero
 * (HOS-2184 AC-9). Any other failure fails the call.
 */

import {
    ConversationStatusEnum,
    EntityTypeEnum,
    PermissionEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, entityViewService } from '@repo/service-core';
import { env } from '../../../utils/env';
import { buildPortalUrl, type PortalLocale } from '../../portal/build-portal-url';
import { describePortalDestination } from '../../portal/portal-destination';
import type { PortalDestination } from '../../portal/portal-routes';
import { readOwnerAccommodationIds } from '../inquiry/inquiry-readers';
import { getInquiryConversationService } from '../inquiry/inquiry-services';
import { LISTING_STATS_INQUIRY_MONTHS } from '../listing/get-listing-stats.accommodation';
import type { ListingToolVertical } from '../listing/listing-services';
import {
    hasAdvancedStatsEntitlement,
    hasBasicStatsEntitlement
} from '../listing/stats-entitlement';
import { readOwnerListingReviews } from '../review/owner-review-reader';
import type { ToolErrorPayload } from '../tool-definition';
import { countAccommodationFavorites } from './owner-summary-readers';
import {
    type OmittedMetrics,
    OWNER_SUMMARY_PERIOD_DAYS,
    type OwnerSummaryPeriod,
    type SummaryInquiries,
    type VerticalMetrics
} from './owner-summary-types';

/**
 * The note shown instead of the metrics. HOS-1967 forbids hardcoding plan
 * names; until HOS-2066 exposes which plan versions carry `view_basic_stats`,
 * the note names none (spec §6.6).
 */
export const NO_STATS_NOTE =
    'Las estadísticas están incluidas en los planes que muestran estadísticas. Podés ver los planes acá.';

/** One vertical's metrics, or the error to report. */
export type VerticalMetricsResult =
    | { readonly metrics: VerticalMetrics | OmittedMetrics; readonly error?: never }
    | { readonly metrics?: never; readonly error: ToolErrorPayload };

/** A service result: data, or a service error. */
interface ServiceResult<T> {
    readonly data?: T;
    readonly error?: ToolErrorPayload;
}

/** The omission entry of a vertical without basic stats. */
function omittedMetrics(
    vertical: ListingToolVertical,
    locale: PortalLocale | undefined
): OmittedMetrics {
    const destination: PortalDestination = { kind: 'plans', vertical };
    return {
        omitted: 'NO_STATS_ENTITLEMENT',
        note: NO_STATS_NOTE,
        action: {
            url: buildPortalUrl({ destination, locale, siteUrl: env.HOSPEDA_SITE_URL }),
            label: describePortalDestination({ destination })
        }
    };
}

/** Sums the views of the owner-wide stats read; `undefined` when not permitted. */
async function readViews(args: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly period: OwnerSummaryPeriod;
}): Promise<ServiceResult<number | undefined>> {
    const { actor, vertical, period } = args;
    const result =
        vertical === VerticalEnum.ACCOMMODATION
            ? await entityViewService.getStatsForHostAccommodations({ actor, window: period })
            : await entityViewService.getStatsForOwnListings({
                  actor,
                  entityType:
                      vertical === VerticalEnum.VENUE
                          ? EntityTypeEnum.VENUE
                          : EntityTypeEnum.EXPERIENCE,
                  window: period
              });
    if (result.error) {
        return result.error.code === ServiceErrorCode.FORBIDDEN
            ? { data: undefined }
            : { error: result.error };
    }
    return { data: (result.data ?? []).reduce((sum, item) => sum + item.total, 0) };
}

/** Inquiries and reply speed over the owner's accommodations; `undefined` when not permitted. */
async function readInquiryMetrics(args: {
    readonly actor: Actor;
}): Promise<ServiceResult<SummaryInquiries | undefined>> {
    const { actor } = args;
    const conversations = getInquiryConversationService();
    const [monthly, responseRate] = await Promise.all([
        conversations.getHostMonthlyInquiries(actor, { months: LISTING_STATS_INQUIRY_MONTHS }),
        conversations.getHostResponseRate(actor)
    ]);
    // Missing permission means "not available to this owner", not a failure.
    for (const result of [monthly, responseRate]) {
        if (result.error && result.error.code !== ServiceErrorCode.FORBIDDEN) {
            return { error: result.error };
        }
    }
    if (!monthly.data || !responseRate.data) {
        return { data: undefined };
    }
    return {
        data: {
            scope: 'all_my_accommodations',
            byMonth: monthly.data.map(({ month, count }) => ({ month, count })),
            responseRatePercent: responseRate.data.responseRatePct,
            averageResponseMinutes: responseRate.data.avgResponseTimeMinutes
        }
    };
}

/**
 * Reads the unanswered-inquiries count: the `total` of the read `list_inquiries`
 * makes for `status: PENDING_OWNER` (waiting for the owner's reply), over the
 * same scope (`readOwnerAccommodationIds`) and behind the same
 * `CONVERSATION_VIEW_OWN` permission, so the two tools cannot disagree. Two
 * reads whatever the number of accommodations: the scope, then one page of 1.
 * Read once per summary and shared by the metrics and the (never gated)
 * attention block.
 *
 * @param args - The actor
 * @returns The count; `undefined` when not permitted or the owner has no accommodations
 */
export async function readUnansweredInquiries(args: {
    readonly actor: Actor;
}): Promise<ServiceResult<number | undefined>> {
    const { actor } = args;
    if (!actor.permissions.includes(PermissionEnum.CONVERSATION_VIEW_OWN)) {
        return { data: undefined };
    }
    const accommodationIds = await readOwnerAccommodationIds({ ownerId: actor.id });
    if (accommodationIds.length === 0) {
        return { data: undefined };
    }
    const pending = await getInquiryConversationService().listForOwner(actor, {
        userId: actor.id,
        accommodationIds: [...accommodationIds],
        status: ConversationStatusEnum.PENDING_OWNER,
        page: 1,
        pageSize: 1
    });
    if (pending.error) {
        return pending.error.code === ServiceErrorCode.FORBIDDEN
            ? { data: undefined }
            : { error: pending.error };
    }
    return { data: pending.data?.total };
}

/**
 * Reads the metrics of one vertical, or its omission note.
 *
 * @param args - The actor, the vertical, the owner's listing ids in it, the
 *   period, the instant "now", (accommodation) the unanswered count already read,
 *   and whether the listing read of the vertical was partial (M-3: the per-listing
 *   metrics then cover only the listings read)
 * @returns The metrics entry, or the error to report
 */
export async function readVerticalMetrics(args: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly listingIds: readonly string[];
    readonly period: OwnerSummaryPeriod;
    readonly now: Date;
    readonly unansweredInquiries?: number;
    readonly partial?: boolean;
    /** Locale prefix of the links (the user's web language). Defaults to `es`. */
    readonly locale?: PortalLocale;
}): Promise<VerticalMetricsResult> {
    const { actor, vertical, listingIds, period, now, unansweredInquiries, partial, locale } = args;
    if (!(await hasBasicStatsEntitlement({ userId: actor.id, vertical }))) {
        return { metrics: omittedMetrics(vertical, locale) };
    }
    const isAccommodation = vertical === VerticalEnum.ACCOMMODATION;
    const since = new Date(now.getTime() - OWNER_SUMMARY_PERIOD_DAYS[period] * 86_400_000);
    const [views, reviews, inquiries, includeFavorites] = await Promise.all([
        readViews({ actor, vertical, period }),
        readOwnerListingReviews({
            scopes: [{ vertical, listingIds }],
            filters: { since },
            page: 1,
            pageSize: 1
        }),
        isAccommodation ? readInquiryMetrics({ actor }) : undefined,
        isAccommodation
            ? hasAdvancedStatsEntitlement({ userId: actor.id, vertical })
            : Promise.resolve(false)
    ]);
    if (views.error) {
        return { error: views.error };
    }
    if (inquiries?.error) {
        return { error: inquiries.error };
    }
    const favorites = includeFavorites
        ? await countAccommodationFavorites({ accommodationIds: listingIds })
        : undefined;

    const omitted: Record<string, 'not_in_plan' | 'not_permitted'> = {};
    if (views.data === undefined) omitted.views = 'not_permitted';
    if (isAccommodation && !includeFavorites) omitted.favorites = 'not_in_plan';
    if (isAccommodation && inquiries?.data === undefined) omitted.inquiries = 'not_permitted';
    return {
        metrics: {
            period,
            ...(views.data === undefined ? {} : { views: views.data }),
            newReviews: { total: reviews.total, byModerationState: reviews.countsByState },
            ...(inquiries?.data === undefined ? {} : { inquiries: inquiries.data }),
            ...(isAccommodation && unansweredInquiries !== undefined
                ? { unansweredInquiries }
                : {}),
            ...(favorites === undefined ? {} : { favorites }),
            ...(partial ? { partial: true } : {}),
            ...(Object.keys(omitted).length > 0 ? { omitted } : {})
        }
    };
}
