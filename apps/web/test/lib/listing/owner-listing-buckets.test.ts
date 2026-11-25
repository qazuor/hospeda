import { PublicationStatusEnum as Publication } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    bucketOwnerListings,
    resolveOwnerListingBucket
} from '@/lib/listing/owner-listing-buckets';

describe('owner listing buckets (D6)', () => {
    it.each([
        [Publication.PUBLISHED, 'published'],
        [Publication.DRAFT, 'drafts'],
        [Publication.UNPUBLISHED_BY_BILLING, 'drafts'],
        [Publication.MODERATED, 'drafts'],
        [Publication.ARCHIVED, 'archived'],
        [Publication.PURGED, 'deleted']
    ] as const)('groups publication state %s as %s', (publicationStatus, bucket) => {
        expect(resolveOwnerListingBucket({ listing: { publicationStatus } })).toBe(bucket);
    });

    it('preserves order and identity, buckets only the current page, and does not mutate input', () => {
        const listings = Object.freeze([
            Object.freeze({ id: 'draft-a', publicationStatus: Publication.DRAFT }),
            Object.freeze({ id: 'published', publicationStatus: Publication.PUBLISHED }),
            Object.freeze({ id: 'draft-b', publicationStatus: Publication.MODERATED })
        ]);
        const buckets = bucketOwnerListings({ listings });
        expect(buckets.drafts).toEqual([listings[0], listings[2]]);
        expect(buckets.published[0]).toBe(listings[1]);
        expect(buckets.archived).toEqual([]);
        expect(buckets.deleted).toEqual([]);
        expect(Object.values(buckets).flat()).toHaveLength(listings.length);
        expect(bucketOwnerListings({ listings: [] })).toEqual({
            published: [],
            drafts: [],
            archived: [],
            deleted: []
        });
    });
});
