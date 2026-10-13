import type { PublicationVertical } from './publication-types';

/** Outbox template for the on-archive notice that PB4 and PB5 enqueue (AC:V6:28). */
export const LISTING_ARCHIVED_TEMPLATE = 'verticals.listing-archived';

/**
 * Data-only payload of the on-archive notice: the renderer owns every word. A
 * type alias (not an interface) so it stays assignable to the outbox payload record.
 */
export type ListingArchivedNoticePayload = {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    /** The transition that archived the listing; only PB4 can come back on its own (PB7). */
    readonly transition: 'PB4' | 'PB5';
    /** ISO instant written to `deletion_announced_at` by the same transition. */
    readonly deletionAnnouncedAt: string;
    /** Listing-scoped addon sources on this listing, read from the coverage PB4/PB5 already read. */
    readonly listingAddonCount: number;
};

/**
 * Builds the data-only payload of the on-archive notice.
 *
 * @param args - The archived listing, its transition, the announced deletion instant and its addon count
 * @returns The payload, with the announced deletion as an ISO instant
 */
export function buildListingArchivedPayload(args: {
    readonly vertical: PublicationVertical;
    readonly listingId: string;
    readonly transition: 'PB4' | 'PB5';
    readonly deletionAnnouncedAt: Date;
    readonly listingAddonCount: number;
}): ListingArchivedNoticePayload {
    return {
        vertical: args.vertical,
        listingId: args.listingId,
        transition: args.transition,
        deletionAnnouncedAt: args.deletionAnnouncedAt.toISOString(),
        listingAddonCount: args.listingAddonCount
    };
}
