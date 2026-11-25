/** State grouping shared by all three owner listing indexes (D6, HOS-2626). */
import { PublicationStatusEnum } from '@repo/schemas';

/** Stable display order, independent of the order returned by the API. */
export const OWNER_LISTING_BUCKETS = ['published', 'drafts', 'archived', 'deleted'] as const;
/** One owner-list section. */
export type OwnerListingBucket = (typeof OWNER_LISTING_BUCKETS)[number];
/** The only field the grouping reads: the listing's publication status. */
export interface OwnerListingState {
    readonly publicationStatus: PublicationStatusEnum;
}

/** Consistent pill state: the publication status itself (moderation is `MODERATED`). */
export function resolveOwnerListingDisplayStatus({
    listing
}: {
    readonly listing: OwnerListingState;
}): PublicationStatusEnum {
    return listing.publicationStatus;
}

/** Resolve one bucket: deletion, archive, then published; every other state is a draft. */
export function resolveOwnerListingBucket({
    listing
}: {
    readonly listing: OwnerListingState;
}): OwnerListingBucket {
    const status = resolveOwnerListingDisplayStatus({ listing });
    if (status === PublicationStatusEnum.PURGED) return 'deleted';
    if (status === PublicationStatusEnum.ARCHIVED) return 'archived';
    return status === PublicationStatusEnum.PUBLISHED ? 'published' : 'drafts';
}

/** Group only the supplied rows (one page for accommodations), preserving their order. */
export function bucketOwnerListings<T extends OwnerListingState>({
    listings
}: {
    readonly listings: readonly T[];
}): Readonly<Record<OwnerListingBucket, readonly T[]>> {
    const buckets: Record<OwnerListingBucket, T[]> = {
        published: [],
        drafts: [],
        archived: [],
        deleted: []
    };
    for (const listing of listings) buckets[resolveOwnerListingBucket({ listing })].push(listing);
    return buckets;
}
