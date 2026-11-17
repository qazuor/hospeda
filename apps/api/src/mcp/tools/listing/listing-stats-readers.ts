/**
 * @file listing-stats-readers.ts
 * @description The one database read `get_listing_stats` makes itself (HOS-2184
 * T-024): the latest reviews of a listing. Everything else the tool reports
 * comes from services (`EntityViewService`, the listing row, and for
 * accommodations the bookmark and conversation services).
 *
 * The review services only expose unsorted lists (up to 100 rows), so "the
 * latest N" needs the review models' own sorted, paginated read. It applies the
 * same visibility the public review lists apply (`ACTIVE` + `APPROVED`, not
 * soft-deleted), which is also what the denormalized `reviewsCount` and
 * `averageRating` of the listing count.
 *
 * Models are built lazily: nothing here touches `@repo/db` at import time.
 */

import { AccommodationReviewModel, ExperienceReviewModel, VenueReviewModel } from '@repo/db';
import { LifecycleStatusEnum, ModerationStatusEnum, VerticalEnum } from '@repo/schemas';
import type { ListingToolVertical } from './listing-services';

/** One review as the tool reports it, before the text is wrapped. */
export interface LatestReviewRow {
    /** Review title, `null` when the reviewer left none. */
    readonly title: string | null;
    /** Review text, `null` when the reviewer left none. */
    readonly content: string | null;
    /** The review's own average rating (0 to 5). */
    readonly averageRating: number;
    /** When the review was written. */
    readonly createdAt: Date;
}

/** Foreign-key column of each vertical's review table. */
const LISTING_COLUMN = {
    [VerticalEnum.ACCOMMODATION]: 'accommodationId',
    [VerticalEnum.VENUE]: 'venueId',
    [VerticalEnum.EXPERIENCE]: 'experienceId'
} as const;

let accommodationReviews: AccommodationReviewModel | undefined;
let venueReviews: VenueReviewModel | undefined;
let experienceReviews: ExperienceReviewModel | undefined;

/** The review model of a vertical, built on first use. */
function reviewModelFor(vertical: ListingToolVertical) {
    if (vertical === VerticalEnum.ACCOMMODATION) {
        accommodationReviews ??= new AccommodationReviewModel();
        return accommodationReviews;
    }
    if (vertical === VerticalEnum.VENUE) {
        venueReviews ??= new VenueReviewModel();
        return venueReviews;
    }
    experienceReviews ??= new ExperienceReviewModel();
    return experienceReviews;
}

/**
 * Reads the most recent publicly visible reviews of a listing, newest first.
 * The caller has already established that the listing is the actor's.
 *
 * @param args - Vertical, listing id and how many reviews to return
 * @returns Up to `limit` reviews (empty when there are none)
 */
export async function readLatestListingReviews({
    vertical,
    listingId,
    limit
}: {
    readonly vertical: ListingToolVertical;
    readonly listingId: string;
    readonly limit: number;
}): Promise<readonly LatestReviewRow[]> {
    const result = await reviewModelFor(vertical).findAll(
        {
            [LISTING_COLUMN[vertical]]: listingId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            deletedAt: null
        },
        { page: 1, pageSize: limit, sortBy: 'createdAt', sortOrder: 'desc' }
    );
    return (result.items as readonly LatestReviewRow[]).map((row) => ({
        title: row.title ?? null,
        content: row.content ?? null,
        averageRating: Number(row.averageRating),
        createdAt: new Date(row.createdAt)
    }));
}
