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
 * Upper bound of listings read per vertical in one call. Mirrors `listOwn`'s
 * fixed page of 100 for venue and experience: an owner holds a handful of
 * listings. A vertical that reaches this bound is reported as truncated
 * (`hasMore`), never silently cut.
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
    /** How many listings the user owns in total, across the three verticals. */
    readonly total: number;
    /**
     * `true` when `listings` is shorter than `total`: at most
     * {@link LIST_MY_LISTINGS_PAGE_SIZE} listings per vertical are returned and the
     * rest are not shown. Tell the user the list is partial.
     */
    readonly hasMore: boolean;
}

/** Fields every vertical's entity carries that the summary needs. */
interface ListingRow {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

/** A per-vertical read: rows, or the service error to report. */
type VerticalRead =
    | { readonly rows: readonly ListingRow[]; readonly total: number; readonly error?: never }
    | { readonly rows?: never; readonly total?: never; readonly error: ToolErrorPayload };

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

/** Output of `listOwn` and, when the page was full, of `countOwn`. */
interface OwnReadInput {
    readonly read: {
        readonly data?: { readonly listings: readonly ListingRow[] };
        readonly error?: ToolErrorPayload;
    };
    readonly count: {
        readonly data?: { readonly count: number };
        readonly error?: ToolErrorPayload;
    } | null;
}

/** Combines a `listOwn` page with its optional `countOwn` into one vertical read. */
function readOwn({ read, count }: OwnReadInput): VerticalRead {
    if (read.error) {
        return { error: read.error };
    }
    if (count?.error) {
        return { error: count.error };
    }
    const rows = read.data?.listings ?? [];
    return { rows, total: count?.data?.count ?? rows.length };
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
        "Lists every listing the connected Hospeda user owns, across accommodations, venues (food and nightlife) and experiences, in any publication state (drafts and paused listings included). Returns each listing's id, vertical, name and publicationStatus. Use the id and vertical with get_listing to read a listing's editable details. The result carries `total` (everything the user owns) and `hasMore`: when hasMore is true the list is truncated (at most 100 listings per vertical are returned), so tell the user it is partial instead of presenting it as complete.",
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

        // `listOwn` reads one fixed page. Only a full page can hide rows, so the
        // count query runs just then.
        const [venueTotal, experienceTotal] = await Promise.all([
            venues.error || (venues.data?.listings.length ?? 0) < LIST_MY_LISTINGS_PAGE_SIZE
                ? null
                : listingToolVenueService.countOwn(actor),
            experiences.error ||
            (experiences.data?.listings.length ?? 0) < LIST_MY_LISTINGS_PAGE_SIZE
                ? null
                : listingToolExperienceService.countOwn(actor)
        ]);

        const reads: readonly (readonly [ListingToolVertical, VerticalRead])[] = [
            [
                VerticalEnum.ACCOMMODATION,
                accommodations.error
                    ? { error: accommodations.error }
                    : {
                          rows: accommodations.data?.items ?? [],
                          total:
                              accommodations.data?.total ?? accommodations.data?.items.length ?? 0
                      }
            ],
            [VerticalEnum.VENUE, readOwn({ read: venues, count: venueTotal })],
            [VerticalEnum.EXPERIENCE, readOwn({ read: experiences, count: experienceTotal })]
        ];

        const listings: MyListingSummary[] = [];
        let total = 0;
        for (const [vertical, read] of reads) {
            // A partial list would read as "you have no venues": fail the call.
            if (read.error) {
                return { error: read.error };
            }
            listings.push(...toSummaries({ vertical, rows: read.rows }));
            total += read.total;
        }
        return {
            data: {
                listings,
                total: Math.max(total, listings.length),
                hasMore: listings.length < total
            }
        };
    }
});
