import { LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { accommodationReviewModel } from '../../src/models/accommodation/accommodationReview.model.ts';
import { destinationReviewModel } from '../../src/models/destination/destinationReview.model.ts';
import { accommodationReviews } from '../../src/schemas/accommodation/accommodation_review.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { destinationReviews } from '../../src/schemas/destination/destination_review.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005'
];
const createdAt = [
    new Date('2025-01-01T00:00:00Z'),
    new Date('2025-01-02T00:00:00Z'),
    new Date('2025-01-03T00:00:00Z'),
    new Date('2025-01-03T00:00:00Z'),
    new Date('2025-01-04T00:00:00Z')
];
const expected = [ids[4], ids[3], ids[2], ids[1], ids[0]];

describe('TEST:1705:3 AC:1705:3 findAllWithUser orders newest first with an id tiebreak', () => {
    it('orders accommodation review pages and reports the total', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const reviewers = ids.map(() => testData.user());
            const destination = testData.destination();
            await tx.insert(users).values([owner, ...reviewers]);
            await tx.insert(destinations).values(destination);
            const accommodation = await new AccommodationModel().create(
                {
                    ownerId: owner.id,
                    destinationId: destination.id,
                    name: `Review order ${crypto.randomUUID()}`,
                    slug: `review-order-${crypto.randomUUID()}`,
                    summary: 'Review order fixture',
                    description: 'Review order fixture description',
                    type: 'CABIN'
                } as never,
                tx
            );
            await tx.insert(accommodationReviews).values(
                ids.map((id, index) => ({
                    id,
                    accommodationId: accommodation.id,
                    userId: reviewers[index]!.id,
                    rating: {
                        cleanliness: 4,
                        hospitality: 4,
                        services: 4,
                        accuracy: 4,
                        communication: 4,
                        location: 4
                    },
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    moderationState: ModerationStatusEnum.APPROVED,
                    createdAt: createdAt[index]
                }))
            );
            const pages = await Promise.all(
                [1, 2, 3].map((page) =>
                    accommodationReviewModel.findAllWithUser(
                        { accommodationId: accommodation.id },
                        { page, pageSize: 2 },
                        tx
                    )
                )
            );
            expect(pages.map((page) => page.items.map((review) => review.id))).toEqual([
                expected.slice(0, 2),
                expected.slice(2, 4),
                expected.slice(4)
            ]);
            expect(pages.map((page) => page.total)).toEqual([5, 5, 5]);
        });
    });

    it('orders destination review pages and reports the total', async () => {
        await withTestTransaction(async (tx) => {
            const reviewers = ids.map(() => testData.user());
            const destination = testData.destination();
            await tx.insert(users).values(reviewers);
            await tx.insert(destinations).values(destination);
            await tx.insert(destinationReviews).values(
                ids.map((id, index) => ({
                    id,
                    destinationId: destination.id,
                    userId: reviewers[index]!.id,
                    rating: {
                        cleanliness: 4,
                        hospitality: 4,
                        services: 4,
                        accuracy: 4,
                        communication: 4,
                        location: 4
                    },
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    moderationState: ModerationStatusEnum.APPROVED,
                    createdAt: createdAt[index]
                }))
            );
            const pages = await Promise.all(
                [1, 2, 3].map((page) =>
                    destinationReviewModel.findAllWithUser(
                        { destinationId: destination.id },
                        { page, pageSize: 2 },
                        tx
                    )
                )
            );
            expect(pages.map((page) => page.items.map((review) => review.id))).toEqual([
                expected.slice(0, 2),
                expected.slice(2, 4),
                expected.slice(4)
            ]);
            expect(pages.map((page) => page.total)).toEqual([5, 5, 5]);
        });
    });
});
