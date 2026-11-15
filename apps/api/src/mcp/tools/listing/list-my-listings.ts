/**
 * @file list-my-listings.ts
 * @description Tool `list_my_listings` (HOS-2184 T-013, spec §6.5, AC-2):
 * the caller's own listings across accommodation, venue and experience.
 *
 * A thin adapter over the same service calls the protected "list own" routes
 * make, so the tool can never see more than the owner's panel does:
 * - accommodation: `AccommodationService.list` scoped to `ownerId = actor.id`
 *   (`routes/accommodation/protected/list.ts`);
 * - venue / experience: `listOwn`, hard-scoped to the actor
 *   (`routes/{venue,experience}/protected/listMine.ts`).
 *
 * Ownership IS the gate (no permission is required by those routes either):
 * another user's listings are simply never in the result. Every publication
 * state is included, drafts too, because the owner manages all of them.
 *
 * Listing names are the owner's own text, not third-party content, so they
 * are returned as is (§6.6 covers guest-written text only).
 */

import { type PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { z } from 'zod';
import { defineTool, type ToolErrorPayload, type ToolHandlerResult } from '../tool-definition';
import {
    type ListingToolVertical,
    listingToolAccommodationService,
    listingToolExperienceService,
    listingToolVenueService
} from './listing-services';

/**
 * Upper bound of accommodations read in one call. Mirrors `listOwn`'s fixed
 * page of 100 for venue and experience: an owner holds a handful of listings.
 */
export const LIST_MY_LISTINGS_PAGE_SIZE = 100;

/** One listing in the result. */
export interface MyListingSummary {
    /** Listing id (UUID); the `id` input of `get_listing`. */
    readonly id: string;
    /** Vertical the listing belongs to; the `vertical` input of `get_listing`. */
    readonly vertical: ListingToolVertical;
    /** Public name. */
    readonly name: string;
    /** The single publication state (`PUBLISHED`, `DRAFT`, …). */
    readonly publicationStatus: PublicationStatusEnum;
}

/** Result of `list_my_listings`. */
export interface ListMyListingsResult {
    /** The caller's listings: accommodations, then venues, then experiences. */
    readonly listings: readonly MyListingSummary[];
}

/** Fields every vertical's entity carries that the summary needs. */
interface ListingRow {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

/** A per-vertical read: rows, or the service error to report. */
type VerticalRead =
    | { readonly rows: readonly ListingRow[]; readonly error?: never }
    | { readonly rows?: never; readonly error: ToolErrorPayload };

/** Projects service rows to summaries of one vertical. */
function toSummaries(input: {
    readonly vertical: ListingToolVertical;
    readonly rows: readonly ListingRow[];
}): MyListingSummary[] {
    return input.rows.map((row) => ({
        id: row.id,
        vertical: input.vertical,
        name: row.name,
        publicationStatus: row.publicationStatus
    }));
}

/** Input schema: the tool takes no arguments. */
export const ListMyListingsInputSchema = z.object({}).strict();

/**
 * `list_my_listings`: read-only, available to an unverified email exactly as
 * the HTTP "list own" routes are (`READ_OWN`).
 */
export const listMyListingsTool = defineTool({
    name: 'list_my_listings',
    title: 'Mis publicaciones',
    description:
        "Lists every listing the connected Hospeda user owns, across accommodations, venues (food and nightlife) and experiences, in any publication state (drafts and paused listings included). Returns each listing's id, vertical, name and publicationStatus. Use the id and vertical with get_listing to read a listing's editable details.",
    inputSchema: ListMyListingsInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor }): Promise<ToolHandlerResult<ListMyListingsResult>> => {
        const [accommodations, venues, experiences] = await Promise.all([
            listingToolAccommodationService.list(actor, {
                page: 1,
                pageSize: LIST_MY_LISTINGS_PAGE_SIZE,
                where: { ownerId: actor.id },
                sortBy: 'createdAt',
                sortOrder: 'desc'
            }),
            listingToolVenueService.listOwn(actor),
            listingToolExperienceService.listOwn(actor)
        ]);

        const reads: readonly (readonly [ListingToolVertical, VerticalRead])[] = [
            [
                VerticalEnum.ACCOMMODATION,
                accommodations.error
                    ? { error: accommodations.error }
                    : { rows: accommodations.data?.items ?? [] }
            ],
            [
                VerticalEnum.VENUE,
                venues.error ? { error: venues.error } : { rows: venues.data?.listings ?? [] }
            ],
            [
                VerticalEnum.EXPERIENCE,
                experiences.error
                    ? { error: experiences.error }
                    : { rows: experiences.data?.listings ?? [] }
            ]
        ];

        const listings: MyListingSummary[] = [];
        for (const [vertical, read] of reads) {
            // A partial list would read as "you have no venues": fail the call.
            if (read.error) {
                return { error: read.error };
            }
            listings.push(...toSummaries({ vertical, rows: read.rows }));
        }
        return { data: { listings } };
    }
});
