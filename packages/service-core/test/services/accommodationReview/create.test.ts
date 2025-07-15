import { AccommodationModel, AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationId,
    AccommodationRatingType,
    AccommodationReviewId,
    AccommodationReviewType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

/**
 * Test suite for AccommodationReviewService.create method.
 * Ensures correct creation of reviews and update of accommodation stats.
 */
describe('create', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let accommodationModel: AccommodationModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceContext;

    beforeEach(() => {
        reviewModel = new AccommodationReviewModel();
        accommodationModel = new AccommodationModel();
        logger = createLoggerMock();
        ctx = { logger } as ServiceContext;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
        // @ts-expect-error: override for test
        service.accommodationService.accommodationModel = accommodationModel;
    });

    it('creates a review and updates accommodation stats', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserId,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        const accommodationId = getMockId('accommodation', 'acc-1') as AccommodationId;
        const userId = getMockId('user', 'user-1') as UserId;
        const reviewInput = {
            accommodationId,
            userId,
            rating: {
                cleanliness: 4,
                hospitality: 5,
                services: 3,
                accuracy: 4,
                communication: 5,
                location: 4
            } as AccommodationRatingType,
            title: 'Great stay',
            content: 'Everything was perfect.'
        };
        const now = new Date();
        const createdReview: AccommodationReviewType = {
            id: getMockId('feature', 'review-1') as AccommodationReviewId,
            accommodationId,
            userId,
            title: reviewInput.title,
            content: reviewInput.content,
            rating: reviewInput.rating,
            createdAt: now,
            updatedAt: now,
            deletedAt: undefined,
            createdById: userId,
            updatedById: userId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: undefined
        };
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'findAll').mockResolvedValue({ items: [createdReview], total: 1 });
        // Use 'as unknown as { accommodationService: ... }' to access the private property for testing
        const updateStatsMock = vi
            .spyOn(
                (service as unknown as { accommodationService: AccommodationService })
                    .accommodationService,
                'updateStatsFromReview'
            )
            .mockResolvedValue();

        // Act
        const result = await service.create(actor, reviewInput);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(createdReview.id);
        expect(updateStatsMock).toHaveBeenCalledTimes(1);
        // Check the exact values passed to updateStatsFromReview
        const callArgs = updateStatsMock.mock.calls[0];
        expect(callArgs).toBeDefined();
        if (callArgs) {
            expect(callArgs[0]).toBe(accommodationId);
            expect(callArgs[1]).toMatchObject({
                reviewsCount: 1,
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 3,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            });
            expect(callArgs[1].averageRating).toBeCloseTo(4.1667, 4);
        }
    });
});
