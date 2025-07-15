import { DestinationModel, DestinationReviewModel } from '@repo/db';
import type {
    DestinationId,
    DestinationReviewId,
    DestinationReviewType,
    NewDestinationReviewInputType,
    UserId
} from '@repo/types';
import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DestinationService } from '../../../src/services/destination/destination.service';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

/**
 * Test suite for DestinationReviewService.create method.
 * Ensures correct creation of reviews and update of destination stats.
 */
describe('create', () => {
    let service: DestinationReviewService;
    let reviewModel: DestinationReviewModel;
    let destinationModel: DestinationModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceContext;

    beforeEach(() => {
        reviewModel = new DestinationReviewModel();
        destinationModel = new DestinationModel();
        logger = createLoggerMock();
        ctx = { logger } as ServiceContext;
        service = new DestinationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
        // @ts-expect-error: override for test
        service.destinationService.model = destinationModel;
    });

    // Helper para construir el input correcto para crear un review
    const buildReviewInput = (
        overrides: Partial<NewDestinationReviewInputType> = {}
    ): NewDestinationReviewInputType => ({
        destinationId: getMockId('destination', 'dest-1') as DestinationId,
        userId: getMockId('user', 'user-1') as UserId,
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
        title: 'Amazing destination',
        content: 'Loved everything.',
        ...overrides
    });

    it('creates a review and updates destination stats', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserId,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-1') as DestinationId;
        const userId = getMockId('user', 'user-1') as UserId;
        const reviewInput = buildReviewInput();
        const now = new Date();
        const createdReview: DestinationReviewType = {
            id: getMockId('feature', 'review-1') as DestinationReviewId,
            destinationId,
            userId,
            title: reviewInput.title,
            content: reviewInput.content,
            rating: reviewInput.rating,
            createdAt: now,
            updatedAt: now,
            deletedAt: undefined,
            createdById: userId,
            updatedById: userId
        };
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'findAll').mockResolvedValue({ items: [createdReview], total: 1 });
        // Use 'as unknown as { destinationService: ... }' to access the private property for testing
        const updateStatsMock = vi
            .spyOn(
                (service as unknown as { destinationService: DestinationService })
                    .destinationService,
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
            expect(callArgs[0]).toBe(destinationId);
            expect(callArgs[1]).toMatchObject({
                reviewsCount: 1,
                rating: reviewInput.rating
            });
            expect(callArgs[1].averageRating).toBeCloseTo(
                Object.values(reviewInput.rating).reduce((a, b) => a + b, 0) / 18,
                4
            );
        }
    });
});
