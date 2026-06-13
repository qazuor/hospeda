import { DestinationReviewModel } from '@repo/db';
import type {
    DestinationIdType,
    DestinationReview,
    DestinationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for DestinationReviewService.listByUser method.
 * Verifies ownership check: actors may only list their own reviews.
 */
describe('listByUser', () => {
    let service: DestinationReviewService;
    let reviewModel: DestinationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    const ownerId = getMockId('user', 'owner') as UserIdType;
    const otherId = getMockId('user', 'other') as UserIdType;
    const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;

    const makeReview = (userId: UserIdType): DestinationReview => ({
        id: getMockId('destinationReview', 'review-1') as DestinationReviewIdType,
        destinationId,
        userId,
        title: 'Great destination',
        content: 'Loved the local culture.',
        rating: {
            landscape: 5,
            attractions: 4,
            accessibility: 3,
            safety: 4,
            cleanliness: 5,
            hospitality: 4,
            culturalOffer: 3,
            gastronomy: 4,
            affordability: 3,
            nightlife: 2,
            infrastructure: 4,
            environmentalCare: 3,
            wifiAvailability: 4,
            shopping: 3,
            beaches: 5,
            greenSpaces: 4,
            localEvents: 3,
            weatherSatisfaction: 5
        },
        averageRating: 3.9,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        isBusinessTravel: false,
        isVerified: false,
        isPublished: true,
        isRecommended: true,
        wouldVisitAgain: true,
        helpfulVotes: 0,
        totalVotes: 0,
        hasOwnerResponse: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        createdById: userId,
        updatedById: userId
    });

    beforeEach(() => {
        reviewModel = createTypedModelMock(DestinationReviewModel, ['findAll']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new DestinationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
    });

    describe('when actor requests their own reviews', () => {
        it('should return paginated reviews when userId matches actor.id', async () => {
            // Arrange
            const actor = createActor({ id: ownerId });
            const review = makeReview(ownerId);
            (reviewModel.findAll as Mock).mockResolvedValue({ items: [review], total: 1 });

            // Act
            const result = await service.listByUser(actor, {
                userId: ownerId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Assert
            expectSuccess(result);
            expect(result.data?.data).toHaveLength(1);
            expect(result.data?.pagination.total).toBe(1);
        });
    });

    describe('when actor requests reviews for a different user', () => {
        it('should return FORBIDDEN when userId differs from actor.id', async () => {
            // Arrange
            const actor = createActor({ id: ownerId });

            // Act
            const result = await service.listByUser(actor, {
                userId: otherId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Assert
            expectForbiddenError(result);
            expect(reviewModel.findAll as Mock).not.toHaveBeenCalled();
        });
    });
});
