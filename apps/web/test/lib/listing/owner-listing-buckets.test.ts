import {
    LifecycleStatusEnum as Lifecycle,
    ModerationStatusEnum as Moderation,
    PublicationStatusEnum as Publication
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    bucketOwnerListings,
    resolveOwnerListingBucket,
    resolveOwnerListingDisplayStatus
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

    it('keeps moderation in drafts, with archive and deletion taking precedence', () => {
        for (const moderationState of [Moderation.PENDING, Moderation.REJECTED]) {
            expect(
                resolveOwnerListingDisplayStatus({
                    listing: { publicationStatus: Publication.PUBLISHED, moderationState }
                })
            ).toBe(Publication.MODERATED);
            expect(
                resolveOwnerListingBucket({
                    listing: { publicationStatus: Publication.PUBLISHED, moderationState }
                })
            ).toBe('drafts');
            expect(
                resolveOwnerListingBucket({
                    listing: { publicationStatus: Publication.ARCHIVED, moderationState }
                })
            ).toBe('archived');
            expect(
                resolveOwnerListingBucket({
                    listing: {
                        publicationStatus: Publication.PURGED,
                        lifecycleState: Lifecycle.ARCHIVED,
                        moderationState
                    }
                })
            ).toBe('deleted');
        }
    });

    it('handles lifecycle archive without mistaking a paused listing for an archive', () => {
        expect(
            resolveOwnerListingBucket({
                listing: {
                    publicationStatus: Publication.DRAFT,
                    lifecycleState: Lifecycle.ARCHIVED
                }
            })
        ).toBe('archived');
        expect(
            resolveOwnerListingBucket({
                listing: {
                    publicationStatus: Publication.DRAFT,
                    lifecycleState: Lifecycle.INACTIVE
                }
            })
        ).toBe('drafts');
        expect(
            resolveOwnerListingBucket({
                listing: {
                    publicationStatus: Publication.PUBLISHED,
                    moderationState: Moderation.APPROVED
                }
            })
        ).toBe('published');
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
