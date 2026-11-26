import { accommodationMediaModel, experienceMediaModel, venueMediaModel } from '@repo/db';
import { LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL, VerticalEnum } from '@repo/schemas';

/** The three verticals whose galleries are capped by the owner's effective photo limit. */
export type ListingPhotoVertical =
    | VerticalEnum.ACCOMMODATION
    | VerticalEnum.VENUE
    | VerticalEnum.EXPERIENCE;

/** The photo limit key of one listing vertical. */
export type ListingPhotoLimitKey =
    (typeof LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL)[keyof typeof LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL];

/** What a photo write asks step 7 for. */
export type ListingPhotoLimitRequest = {
    readonly key: ListingPhotoLimitKey;
    readonly requested: number;
};

/**
 * Counts the visible gallery photos of a listing, excluding the cover (HOS-791),
 * in any moderation state: exactly what step 7 counts for a gallery write.
 *
 * @param input.vertical - The listing vertical.
 * @param input.listingId - The listing id.
 * @returns `{ used }`, the number of visible non-featured, non-deleted rows.
 */
export async function countListingGalleryPhotos({
    vertical,
    listingId
}: {
    readonly vertical: ListingPhotoVertical;
    readonly listingId: string;
}): Promise<{ readonly used: number }> {
    const filter = { state: 'visible', isFeatured: false } as const;
    if (vertical === VerticalEnum.VENUE) {
        const { total } = await venueMediaModel.findByVenue({ venueId: listingId, ...filter });
        return { used: total };
    }
    if (vertical === VerticalEnum.EXPERIENCE) {
        const { total } = await experienceMediaModel.findByExperience({
            experienceId: listingId,
            ...filter
        });
        return { used: total };
    }
    const { total } = await accommodationMediaModel.findByAccommodation({
        accommodationId: listingId,
        ...filter
    });
    return { used: total };
}

/**
 * Builds the step-7 limit of a GALLERY write for one vertical: the next visible
 * gallery count, excluding the cover.
 *
 * @param input.vertical - The listing vertical.
 * @returns A `listingAccess.limit` function resolving `{ key, requested: used + 1 }`.
 */
export function listingGalleryPhotoLimit({
    vertical
}: {
    readonly vertical: ListingPhotoVertical;
}): (args: { readonly listingId: string }) => Promise<ListingPhotoLimitRequest> {
    return async ({ listingId }) => {
        const { used } = await countListingGalleryPhotos({ vertical, listingId });
        return { key: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[vertical], requested: used + 1 };
    };
}

/**
 * Builds the step-7 limit of a COVER write for one vertical. The cover never
 * counts toward the cap, but adding or replacing it requires a cap of at least 1.
 *
 * @param input.vertical - The listing vertical.
 * @returns A `listingAccess.limit` function resolving `{ key, requested: 1 }`.
 */
export function listingCoverPhotoLimit({
    vertical
}: {
    readonly vertical: ListingPhotoVertical;
}): () => Promise<ListingPhotoLimitRequest> {
    return async () => ({ key: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[vertical], requested: 1 });
}

/** The accommodation gallery limit (HOS-2031). Kept as a named alias for existing callers. */
export const accommodationGalleryPhotoLimit = listingGalleryPhotoLimit({
    vertical: VerticalEnum.ACCOMMODATION
});
