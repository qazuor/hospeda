/** State grouping shared by all three owner listing indexes (D6, HOS-2626). */
import { LifecycleStatusEnum, ModerationStatusEnum, PublicationStatusEnum } from '@repo/schemas';

/** Stable display order, independent of the order returned by the API. */
export const OWNER_LISTING_BUCKETS = ['published', 'drafts', 'archived', 'deleted'] as const;
/** One owner-list section. */
export type OwnerListingBucket = (typeof OWNER_LISTING_BUCKETS)[number];
/** Fields available across full entities and compact owner projections. */
export interface OwnerListingState {
    readonly publicationStatus: PublicationStatusEnum;
    readonly lifecycleState?: LifecycleStatusEnum;
    readonly moderationState?: ModerationStatusEnum;
}

/** Consistent pill state, including moderation signalled by older projections. */
export function resolveOwnerListingDisplayStatus({
    listing
}: {
    readonly listing: OwnerListingState;
}): PublicationStatusEnum {
    if (listing.publicationStatus === PublicationStatusEnum.PURGED)
        return PublicationStatusEnum.PURGED;
    if (
        listing.publicationStatus === PublicationStatusEnum.ARCHIVED ||
        listing.lifecycleState === LifecycleStatusEnum.ARCHIVED
    )
        return PublicationStatusEnum.ARCHIVED;
    if (
        listing.publicationStatus === PublicationStatusEnum.MODERATED ||
        listing.moderationState === ModerationStatusEnum.PENDING ||
        listing.moderationState === ModerationStatusEnum.REJECTED
    )
        return PublicationStatusEnum.MODERATED;
    return listing.publicationStatus;
}

/** Resolve one bucket: deletion wins, then archive, then moderation, then publication. */
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
