/**
 * @file dashboard-listing-counts.ts
 * @description Splits an owner's venue/experience listings into what the public
 * can see and what the owner has but nobody sees yet, for the account dashboard
 * card (HOS-1948).
 *
 * The card's label is "Fichas publicadas", so its number must be the
 * `PUBLISHED` ones. It used to be the length of the list, which counted
 * drafts as published and hid the one thing a merchant with an unpublished
 * listing needs to know: that it is not visible.
 */
import { PublicationStatusEnum } from '@repo/schemas';

/** The only field of an owner listing summary this module reads. */
export interface ListingWithPublicationStatus {
    /** Publication state as the `/mine` endpoints serialise it. */
    readonly publicationStatus?: string;
}

/** Counts shown on the dashboard listings card. */
export interface ListingVisibilityCounts {
    /** Listings the public can see (`PUBLISHED`). */
    readonly published: number;
    /** Listings the owner has that the public cannot see yet (`DRAFT`, `UNPUBLISHED_BY_BILLING`). */
    readonly hidden: number;
}

/**
 * Counts published listings and the not-yet-visible ones the owner can act on.
 *
 * `ARCHIVED`, `MODERATED` and `PURGED` count toward neither: they are not
 * "waiting to be published", so a notice nudging the owner would be wrong.
 *
 * @param input.listings - Listings from both verticals' `/mine` endpoints.
 * @returns The published and hidden counts.
 */
export function summarizeListingVisibility({
    listings
}: {
    readonly listings: readonly ListingWithPublicationStatus[];
}): ListingVisibilityCounts {
    let published = 0;
    let hidden = 0;
    for (const { publicationStatus } of listings) {
        if (publicationStatus === PublicationStatusEnum.PUBLISHED) {
            published += 1;
        } else if (
            publicationStatus === PublicationStatusEnum.DRAFT ||
            publicationStatus === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ) {
            hidden += 1;
        }
    }
    return { published, hidden };
}
