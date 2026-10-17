import { PublicationStatusEnum } from '@repo/schemas';

/**
 * Reviews belong to their authors and stay stored after a listing is purged, but
 * public review lists must hide them (AC:V9b:3, TRANS:V:PB9). This keeps the
 * same single-source visibility rule used for HOS-1476 listing media.
 * Its SQL twin is `listingReviewsShownCondition` from `@repo/db`; both rules say the same thing.
 */
export function listingShowsReviews(input: {
    readonly publicationStatus: PublicationStatusEnum;
}): boolean {
    return input.publicationStatus !== PublicationStatusEnum.PURGED;
}
