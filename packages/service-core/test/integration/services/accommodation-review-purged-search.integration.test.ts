import { accommodationReviews, accommodations, destinations, inArray, users } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import { createGuestActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    seedAccommodationReview
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('TEST:1686:3 AC:1686:3 - public review search hides reviews of PURGED listings (HOS-1686)', () => {
    let service: AccommodationReviewService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new AccommodationReviewService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'hides PURGED reviews while retaining PUBLISHED and ARCHIVED reviews',
        async () => {
            const db = getServiceTestDb();
            const published = await seedAccommodationReview(db);
            const purged = await seedAccommodation(db, {
                publicationStatus: PublicationStatusEnum.PURGED
            });
            const archived = await seedAccommodation(db, {
                publicationStatus: PublicationStatusEnum.ARCHIVED
            });
            const purgedReviewId = crypto.randomUUID();
            const archivedReviewId = crypto.randomUUID();
            const seededIds = [published.reviewId, purgedReviewId, archivedReviewId];
            const accommodationIds = [
                published.accommodationId,
                purged.accommodationId,
                archived.accommodationId
            ];
            const destinationIds = [
                published.destinationId,
                purged.destinationId,
                archived.destinationId
            ];
            const authorId = published.userId;

            try {
                await db.insert(accommodationReviews).values([
                    {
                        id: purgedReviewId,
                        accommodationId: purged.accommodationId,
                        userId: authorId,
                        title: 'Purged review',
                        content: 'Seed review',
                        rating: publishedReviewRating,
                        averageRating: 5,
                        lifecycleState: 'ACTIVE',
                        moderationState: 'APPROVED'
                    },
                    {
                        id: archivedReviewId,
                        accommodationId: archived.accommodationId,
                        userId: authorId,
                        title: 'Archived review',
                        content: 'Seed review',
                        rating: publishedReviewRating,
                        averageRating: 5,
                        lifecycleState: 'ACTIVE',
                        moderationState: 'APPROVED'
                    }
                ] as (typeof accommodationReviews.$inferInsert)[]);

                const result = await service.search(createGuestActor({ id: crypto.randomUUID() }), {
                    page: 1,
                    pageSize: 100
                });
                expect(result.error).toBeUndefined();
                if (!result.data) throw new Error('Expected public review search results');

                const seededIdSet = new Set(seededIds);
                const seededResults = result.data.items.filter((review) =>
                    seededIdSet.has(review.id)
                );
                expect(seededResults.map((review) => review.id)).toEqual(
                    expect.arrayContaining([published.reviewId, archivedReviewId])
                );
                expect(seededResults.map((review) => review.id)).not.toContain(purgedReviewId);
                expect(seededResults).toHaveLength(2);
                expect(result.data.total).toBe(2);
            } finally {
                await db
                    .delete(accommodationReviews)
                    .where(inArray(accommodationReviews.id, seededIds));
                await db.delete(accommodations).where(inArray(accommodations.id, accommodationIds));
                await db.delete(destinations).where(inArray(destinations.id, destinationIds));
                await db
                    .delete(users)
                    .where(inArray(users.id, [published.userId, purged.userId, archived.userId]));
            }
        }
    );
});

const publishedReviewRating = {
    cleanliness: 5,
    hospitality: 5,
    services: 5,
    accuracy: 5,
    communication: 5,
    location: 5
};
