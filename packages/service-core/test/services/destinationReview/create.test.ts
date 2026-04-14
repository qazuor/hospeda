import { DestinationReviewModel } from '@repo/db';
import type {
    DestinationIdType,
    DestinationReview,
    DestinationReviewCreateInput,
    DestinationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceConfig } from '../../../src/types';
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
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    beforeEach(() => {
        reviewModel = new DestinationReviewModel();
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new DestinationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
    });

    // Helper para construir el input correcto para crear un review
    const buildReviewInput = (
        overrides: Partial<DestinationReviewCreateInput> = {}
    ): DestinationReviewCreateInput => ({
        destinationId: getMockId('destination', 'dest-1') as DestinationIdType,
        userId: getMockId('user', 'user-1') as UserIdType,
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
        isBusinessTravel: false,
        isVerified: false,
        isPublished: false,
        isRecommended: true,
        wouldVisitAgain: true,
        helpfulVotes: 0,
        totalVotes: 0,
        hasOwnerResponse: false,
        ...overrides
    });

    it('creates a review and updates destination stats', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
        const userId = getMockId('user', 'user-1') as UserIdType;
        const reviewInput = buildReviewInput();
        const now = new Date();
        const createdReview: DestinationReview = {
            id: getMockId('feature', 'review-1') as DestinationReviewIdType,
            destinationId,
            userId,
            title: reviewInput.title,
            content: reviewInput.content,
            rating: reviewInput.rating,
            averageRating: 0,
            isBusinessTravel: false,
            isVerified: false,
            isPublished: false,
            isRecommended: true,
            wouldVisitAgain: true,
            helpfulVotes: 0,
            totalVotes: 0,
            hasOwnerResponse: false,
            createdAt: now,
            updatedAt: now,
            deletedAt: undefined,
            createdById: userId,
            updatedById: userId
        };
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'findAll').mockResolvedValue({ items: [createdReview], total: 1 });
        vi.spyOn(reviewModel, 'update').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'updateById').mockResolvedValue();
        // Mock recalculateAndUpdateDestinationStats since it now uses raw SQL (getDb())
        // which requires an initialized database connection
        const recalcMock = vi
            .spyOn(
                service as unknown as {
                    recalculateAndUpdateDestinationStats: (...args: unknown[]) => Promise<void>;
                },
                'recalculateAndUpdateDestinationStats'
            )
            .mockResolvedValue();

        // Act
        const result = await service.create(actor, reviewInput);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(createdReview.id);
        expect(recalcMock).toHaveBeenCalledTimes(1);
        expect(recalcMock).toHaveBeenCalledWith(destinationId, undefined);
    });
});
