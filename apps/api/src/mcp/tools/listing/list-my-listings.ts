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
 *
 * The `plans` block (HOS-2184 phase B, T-035): the `get_my_plan` item of each
 * listing vertical the owner has a plan in, read ONCE per call with the shared
 * reader (`plan/my-plan-block.ts`), never once per listing. Behind
 * `BILLING_VIEW_OWN` like `get_my_plan`; without it the block is left out. A
 * failed plan read never fails the list.
 */

import {
    type Accommodation,
    type Experience,
    PermissionEnum,
    type PublicationStatusEnum,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { z } from 'zod';
import { getClock } from '../../../utils/clock';
import { readSubscriptionBlock } from '../plan/my-plan-block';
import type { MyPlanItem } from '../plan/my-plan-types';
import {
    defineTool,
    type ToolContext,
    type ToolErrorPayload,
    type ToolHandlerResult
} from '../tool-definition';
import {
    LISTING_TOOL_VERTICALS,
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

/** Result of the `list_my_listings` tool: the listings plus the owner's plans. */
export interface ListMyListingsToolResult extends ListMyListingsResult {
    /**
     * Per listing vertical the owner has a plan in, the `get_my_plan` item
     * (status, expiry dates, what it includes); a vertical with no plan is
     * absent. Absent without `BILLING_VIEW_OWN` and when the plan could not be
     * read (then named in {@link omitted}).
     */
    readonly plans?: Readonly<Partial<Record<ListingToolVertical, MyPlanItem>>>;
    /** Blocks left out because they could not be read. Absent when none was. */
    readonly omitted?: Readonly<{ readonly plans: 'unavailable' }>;
}

/** Fields every vertical's entity carries that the summary needs. */
interface ListingRow {
    readonly id: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

/** One vertical's stored listings, as the "list own" service call returned them. */
export interface VerticalListingRows<TRow> {
    /** The listings read (at most {@link LIST_MY_LISTINGS_PAGE_SIZE}). */
    readonly rows: readonly TRow[];
    /** How many listings the owner has in the vertical, read or not. */
    readonly total: number;
}

/**
 * The caller's own stored listings per vertical, the full entities the "list
 * own" service calls return. `readMyListings` projects them; the owner summary
 * (`get_owner_summary`) counts and evaluates them without reading them again.
 */
export interface MyListingRows {
    readonly [VerticalEnum.ACCOMMODATION]: VerticalListingRows<Accommodation>;
    readonly [VerticalEnum.VENUE]: VerticalListingRows<Venue>;
    readonly [VerticalEnum.EXPERIENCE]: VerticalListingRows<Experience>;
}

/** A per-vertical read: rows, or the service error to report. */
type VerticalRead<TRow> =
    | (VerticalListingRows<TRow> & { readonly error?: never })
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
interface OwnReadInput<TRow> {
    readonly read: {
        readonly data?: { readonly listings: readonly TRow[] };
        readonly error?: ToolErrorPayload;
    };
    readonly count: {
        readonly data?: { readonly count: number };
        readonly error?: ToolErrorPayload;
    } | null;
}

/** Combines a `listOwn` page with its optional `countOwn` into one vertical read. */
function readOwn<TRow>({ read, count }: OwnReadInput<TRow>): VerticalRead<TRow> {
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
 * Reads the caller's own stored listings across the three verticals with the
 * same service calls the protected "list own" routes make. A partial read
 * would look like "you have no venues", so any vertical's failure fails it.
 *
 * @param args - The actor
 * @returns The rows and totals per vertical, or the service error
 */
export async function readMyListingRows({
    actor
}: {
    readonly actor: Actor;
}): Promise<ToolHandlerResult<MyListingRows>> {
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
        experiences.error || (experiences.data?.listings.length ?? 0) < LIST_MY_LISTINGS_PAGE_SIZE
            ? null
            : listingToolExperienceService.countOwn(actor)
    ]);

    if (accommodations.error) {
        return { error: accommodations.error };
    }
    const venueRead = readOwn({ read: venues, count: venueTotal });
    if (venueRead.error) {
        return { error: venueRead.error };
    }
    const experienceRead = readOwn({ read: experiences, count: experienceTotal });
    if (experienceRead.error) {
        return { error: experienceRead.error };
    }
    const accommodationRows = accommodations.data?.items ?? [];
    return {
        data: {
            [VerticalEnum.ACCOMMODATION]: {
                rows: accommodationRows,
                total: accommodations.data?.total ?? accommodationRows.length
            },
            [VerticalEnum.VENUE]: { rows: venueRead.rows, total: venueRead.total },
            [VerticalEnum.EXPERIENCE]: { rows: experienceRead.rows, total: experienceRead.total }
        }
    };
}

/**
 * Reads the caller's own listings across the three verticals with the same
 * service calls the protected "list own" routes make. Shared by `list_my_listings`
 * and by the tools that scope a read to the owner's listings (`list_reviews`).
 *
 * @param args - The actor
 * @returns The listings with `total` and `hasMore`, or the service error
 */
export async function readMyListings({
    actor
}: {
    readonly actor: Actor;
}): Promise<ToolHandlerResult<ListMyListingsResult>> {
    const read = await readMyListingRows({ actor });
    if (read.error) {
        return { error: read.error };
    }
    const listings: MyListingSummary[] = [];
    let total = 0;
    for (const vertical of LISTING_TOOL_VERTICALS) {
        const { rows, total: verticalTotal } = read.data[vertical];
        listings.push(...toSummaries({ vertical, rows }));
        total += verticalTotal;
    }
    return {
        data: {
            listings,
            total: Math.max(total, listings.length),
            hasMore: listings.length < total
        }
    };
}

/**
 * The `plans` part of the result: one shared plan read for the three listing
 * verticals, or the omission.
 *
 * @param args - The owner and the link locale
 * @returns `{ plans }` or `{ omitted }`
 */
async function readPlansPart({
    userId,
    locale
}: {
    readonly userId: string;
    readonly locale: ToolContext['locale'];
}): Promise<Pick<ListMyListingsToolResult, 'plans' | 'omitted'>> {
    const block = await readSubscriptionBlock({
        userId,
        locale,
        now: getClock().clock.now(),
        tool: 'list_my_listings'
    });
    if (block.unavailable) {
        return { omitted: { plans: 'unavailable' } };
    }
    const plans: Partial<Record<ListingToolVertical, MyPlanItem>> = {};
    for (const vertical of LISTING_TOOL_VERTICALS) {
        const item = block.subscription?.[vertical];
        if (item) {
            plans[vertical] = item;
        }
    }
    return { plans };
}

/**
 * `list_my_listings`: read-only, available to an unverified email exactly as
 * the HTTP "list own" routes are (`READ_OWN`).
 */
export const listMyListingsTool = defineTool({
    name: 'list_my_listings',
    title: 'Mis publicaciones',
    description:
        "Lists every listing the connected Hospeda user owns, across accommodations, venues (food and nightlife) and experiences, in any publication state (drafts and paused listings included). Returns each listing's id, vertical, name and publicationStatus. Use the id and vertical with get_listing to read a listing's editable details. The result carries `total` (everything the user owns) and `hasMore`: when hasMore is true the list is truncated (at most 100 listings per vertical are returned), so tell the user it is partial instead of presenting it as complete. `plans` (only when the user may see their billing) holds, per vertical where the user has a plan (accommodation, venue, experience), the same item get_my_plan returns: plan name, status, expiry dates (nextChargeAt, serviceEndsAt, graceEndsAt, trialDaysLeft, coverageEndsAt) and `includes`; a vertical with no plan is absent. If the plans could not be read, `plans` is absent and `omitted` says {plans: 'unavailable'}.",
    inputSchema: ListMyListingsInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({ actor, context }): Promise<ToolHandlerResult<ListMyListingsToolResult>> => {
        const [listings, plansPart] = await Promise.all([
            readMyListings({ actor }),
            actor.permissions.includes(PermissionEnum.BILLING_VIEW_OWN)
                ? readPlansPart({ userId: actor.id, locale: context.locale })
                : undefined
        ]);
        if (listings.error) {
            return { error: listings.error };
        }
        return { data: { ...listings.data, ...plansPart } };
    }
});
