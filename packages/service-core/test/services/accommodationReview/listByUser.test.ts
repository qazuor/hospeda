import { AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationIdType,
    AccommodationReview,
    AccommodationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for AccommodationReviewService.listByUser method.
 * Verifies ownership check: actors may only list their own reviews.
 */
describe('listByUser', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    const ownerId = getMockId('user', 'owner') as UserIdType;
    const otherId = getMockId('user', 'other') as UserIdType;
    const accommodationId = getMockId('accommodation', 'acc-1') as AccommodationIdType;

    const makeReview = (userId: UserIdType): AccommodationReview => ({
        id: getMockId('accommodationReview', 'review-1') as AccommodationReviewIdType,
        accommodationId,
        userId,
        title: 'Nice stay',
        content: 'Comfortable and clean.',
        rating: {
            cleanliness: 4,
            hospitality: 5,
            services: 3,
            accuracy: 4,
            communication: 5,
            location: 4
        },
        averageRating: 4.2,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        createdById: userId,
        updatedById: userId,
        adminInfo: undefined
    });

    beforeEach(() => {
        reviewModel = createTypedModelMock(AccommodationReviewModel, ['findAll']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
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
            expect(result.data?.accommodationReviews).toHaveLength(1);
            expect(result.data?.total).toBe(1);
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

    describe('when actor filters by accommodationId', () => {
        it('should pass accommodationId to the model query when provided', async () => {
            // Arrange
            const actor = createActor({ id: ownerId });
            (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

            // Act
            await service.listByUser(actor, {
                userId: ownerId,
                accommodationId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Assert — accommodationId must be included in the model filter
            expect(reviewModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ userId: ownerId, accommodationId }),
                expect.any(Object),
                undefined,
                undefined
            );
        });
    });
});
