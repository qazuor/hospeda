/**
 * @file owner-summary-readers.ts
 * @description The two owner-wide reads `get_owner_summary` makes below the
 * service layer (HOS-2331), because no service method answers them for many
 * listings at once and a call per listing is exactly what the summary exists
 * to avoid (spec HOS-2335 §5.3).
 *
 * - **Favorites**: the same count `UserBookmarkService.countBookmarksForEntity`
 *   runs for ONE accommodation (`entityId`, `entityType`, `deletedAt: null`,
 *   the query behind `routes/accommodation/protected/hostFavoritesBreakdown.ts`),
 *   over all of the owner's accommodation ids in one `IN` query. The result is
 *   the sum of the numbers the portal breakdown shows.
 * - **Open fix requests**: `listingNoticesModel.readOwnerListingNotices`, the
 *   reader the portal's listing notices (`GET /publish/listing-notices`) are
 *   built from. A `FIX_REQUESTED` notice is its `openFixRequest`, except on a
 *   purged listing (`buildListingNoticeItems`); the same exclusion applies here.
 *
 * Models are reached lazily: nothing here touches `@repo/db` at import time.
 */

import { listingNoticesModel, UserBookmarkModel } from '@repo/db';
import { EntityTypeEnum, PublicationStatusEnum } from '@repo/schemas';
import type { ListingToolVertical } from '../listing/listing-services';

let bookmarks: UserBookmarkModel | undefined;

/**
 * Counts the live favorites of a set of accommodations, all together.
 *
 * @param args - The accommodation ids, already known to be the actor's
 * @returns How many users currently have any of them saved (0 for no ids, no query)
 */
export async function countAccommodationFavorites({
    accommodationIds
}: {
    readonly accommodationIds: readonly string[];
}): Promise<number> {
    if (accommodationIds.length === 0) {
        return 0;
    }
    bookmarks ??= new UserBookmarkModel();
    return bookmarks.count({
        entityId: [...accommodationIds],
        entityType: EntityTypeEnum.ACCOMMODATION,
        deletedAt: null
    });
}

/** A listing of the owner with an open fix request. */
export interface OpenFixRequestListing {
    /** Listing id. */
    readonly id: string;
    /** Listing name (the owner's own text). */
    readonly name: string;
    /** `true` when the owner already told Hospeda it is fixed (still open until staff closes it). */
    readonly reportedFixed: boolean;
}

/**
 * Reads the owner's listings of one vertical that have an open fix request.
 *
 * @param args - The vertical and the owner
 * @returns The listings with an open request, purged ones excluded
 */
export async function readOpenFixRequestListings({
    vertical,
    ownerId
}: {
    readonly vertical: ListingToolVertical;
    readonly ownerId: string;
}): Promise<readonly OpenFixRequestListing[]> {
    const rows = await listingNoticesModel.readOwnerListingNotices({ vertical, ownerId });
    return rows
        .filter(
            (row) =>
                row.openFixRequest !== null &&
                row.publicationStatus !== PublicationStatusEnum.PURGED
        )
        .map((row) => ({
            id: row.id,
            name: row.name,
            reportedFixed: Boolean(row.openFixRequest?.ownerReportedFixedAt)
        }));
}
