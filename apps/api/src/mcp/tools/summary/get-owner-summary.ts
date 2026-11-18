/**
 * @file get-owner-summary.ts
 * @description Tool `get_owner_summary` (HOS-2331, spec HOS-2335 §6.6): one
 * read of how the owner's listings are doing, instead of one
 * `get_listing_stats` call per listing.
 *
 * - `listings`: counts per vertical and publication state, from the rows
 *   `list_my_listings` reads (AC-C29);
 * - `metrics`: per vertical, plan gated exactly like `get_listing_stats`;
 *   without `view_basic_stats` only that vertical's metrics are replaced by
 *   the omission note and the plans link (D-9, AC-C30);
 * - `attention`: what waits on the owner, with the portal page that resolves
 *   each item (AC-C31), at most {@link OWNER_SUMMARY_ATTENTION_CAP};
 * - the subscription block arrives with HOS-2328 (after HOS-2066), not here.
 *
 * Every read is owner-wide or batched per vertical, so the number of queries
 * does not grow with the number of listings, and the serialized result is
 * fitted to `MCP_RESULT_MAX_CHARS` (AC-C32). Ownership is the gate: every read
 * is scoped to the actor by the service, and the tool takes no resource id.
 */

import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { getClock } from '../../../utils/clock';
import { readMyListingRows } from '../listing/list-my-listings';
import { LISTING_TOOL_VERTICALS, type ListingToolVertical } from '../listing/listing-services';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    capAttention,
    OWNER_SUMMARY_ATTENTION_CAP,
    readFixRequestItems,
    readPendingUsageItems,
    unansweredInquiriesItems
} from './owner-summary-attention';
import { fitSummaryToBudget } from './owner-summary-budget';
import { countAllListings, readDraftAttention } from './owner-summary-listings';
import { readUnansweredInquiries, readVerticalMetrics } from './owner-summary-metrics';
import {
    type OmittedMetrics,
    OWNER_SUMMARY_PERIODS,
    type OwnerSummary,
    type VerticalMetrics
} from './owner-summary-types';

/** Input schema of `get_owner_summary`. One flat object (C-2). */
export const GetOwnerSummaryInputSchema = z
    .object({
        period: z
            .enum(OWNER_SUMMARY_PERIODS)
            .default('30d')
            .describe(
                'Period of views and new reviews: the last 7 or 30 days. Defaults to 30d. For 90 days, use get_listing_stats per listing.'
            )
    })
    .strict();

/**
 * `get_owner_summary`: read-only, available to an unverified email like the
 * owner reads it aggregates (`READ_OWN`).
 */
export const getOwnerSummaryTool = defineTool({
    name: 'get_owner_summary',
    title: 'Resumen de mis publicaciones',
    description: `Summarizes all the listings the connected Hospeda user owns in one call (use it instead of calling get_listing_stats per listing). Returns "listings": per vertical (accommodation, venue, experience) the total and the count per publication state (DRAFT, PUBLISHED, UNPUBLISHED_BY_BILLING, ARCHIVED, MODERATED; purged listings are not counted; "partial": true means the owner has more listings than one read covers). Returns "metrics": per vertical the owner has listings in, over all its listings: views and new reviews (every moderation state) in the period, and for accommodations inquiries per month with reply rate and time (scope all_my_accommodations), unanswered inquiries and favorites (favorites only with the plan's advanced stats). Metrics that are not available are left out and listed in "omitted", never reported as zero. If the plan of a vertical does not include statistics, that vertical's metrics are replaced by {"omitted": "NO_STATS_ENTITLEMENT", "note", "action"}: tell the user the note and give them the action url; the rest of the summary is still valid. Returns "attention": up to ${OWNER_SUMMARY_ATTENTION_CAP} things waiting on the user, most urgent first, each with "actionUrl", the page that resolves it: unanswered_inquiries (count), pending_benefit_usages (count; side host or provider), open_fix_request (Hospeda asked to fix a listing; reportedFixed true means the user already reported it fixed), incomplete (a draft missing the requirements in "missing") and missing_photos (a draft without its main photo). "moreAttention" counts the items left out. Plan and subscription details are not part of this summary.`,
    inputSchema: GetOwnerSummaryInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, input }): Promise<ToolHandlerResult<OwnerSummary>> => {
        const read = await readMyListingRows({ actor });
        if (read.error) {
            return { error: read.error };
        }
        const rows = read.data;
        const listings = countAllListings({ rows });
        const verticalsWithListings: readonly ListingToolVertical[] = LISTING_TOOL_VERTICALS.filter(
            (vertical) => rows[vertical].rows.length > 0
        );
        const idsOf = (vertical: ListingToolVertical): readonly string[] =>
            rows[vertical].rows.map((row) => row.id);
        const accommodationIds = idsOf(VerticalEnum.ACCOMMODATION);
        const now = getClock().clock.now();

        const [unanswered, usages, fixRequests, drafts] = await Promise.all([
            readUnansweredInquiries({ actor, accommodationIds }),
            readPendingUsageItems({ actor }),
            readFixRequestItems({ ownerId: actor.id, verticals: verticalsWithListings }),
            readDraftAttention({ rows })
        ]);
        if (unanswered.error) {
            return { error: unanswered.error };
        }
        if (usages.error) {
            return { error: usages.error };
        }

        const metricReads = await Promise.all(
            verticalsWithListings.map((vertical) =>
                readVerticalMetrics({
                    actor,
                    vertical,
                    listingIds: idsOf(vertical),
                    period: input.period,
                    now,
                    ...(unanswered.data === undefined
                        ? {}
                        : { unansweredInquiries: unanswered.data })
                })
            )
        );
        const metrics: Partial<Record<ListingToolVertical, VerticalMetrics | OmittedMetrics>> = {};
        for (const [index, vertical] of verticalsWithListings.entries()) {
            const entry = metricReads[index];
            if (entry?.error) {
                return { error: entry.error };
            }
            if (entry?.metrics) {
                metrics[vertical] = entry.metrics;
            }
        }

        const { attention, moreAttention } = capAttention({
            items: [
                ...unansweredInquiriesItems({ count: unanswered.data }),
                ...usages.items,
                ...fixRequests,
                ...drafts
            ]
        });
        const fitted = fitSummaryToBudget({
            summary: { listings, metrics, attention, moreAttention }
        });
        if (fitted === undefined) {
            return {
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Owner summary exceeds the response budget'
                }
            };
        }
        return { data: fitted };
    }
});
