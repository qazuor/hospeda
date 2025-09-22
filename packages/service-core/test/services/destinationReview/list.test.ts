import { DestinationReviewModel } from '@repo/db';
import type {
    DestinationIdType,
    DestinationReview,
    DestinationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for DestinationReviewService.list method.
 * Ensures correct paginated retrieval and permission handling.
 */
describe('list', () => {
    let service: DestinationReviewService;
    let reviewModel: DestinationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceContext;

    beforeEach(() => {
        reviewModel = createTypedModelMock(DestinationReviewModel, ['findAll']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceContext;
        service = new DestinationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
    });

    it('returns a paginated list of reviews when actor has permission', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const review: DestinationReview = {
            id: getMockId('feature', 'review-1') as DestinationReviewIdType,
            destinationId: getMockId('destination', 'dest-1') as DestinationIdType,
            userId: getMockId('user', 'user-1') as UserIdType,
            title: 'Amazing destination',
            content: 'Loved everything.',
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
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: getMockId('user', 'user-1') as UserIdType,
            updatedById: getMockId('user', 'user-1') as UserIdType
        };
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [review], total: 1 });

        // Act
        const result = await service.list(actor, { page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.items?.[0]?.id).toBe(review.id);
    });

    it('returns success even if actor has no specific permissions (public access)', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-2') as UserIdType,
            permissions: []
        });
        const mockReview: DestinationReview = {
            id: getMockId('destinationReview', 'review-1') as DestinationReviewIdType,
            destinationId: getMockId('destination', 'destination-1') as DestinationIdType,
            userId: getMockId('user', 'user-1') as UserIdType,
            title: 'Amazing destination',
            content: 'Had a wonderful experience visiting this destination.',
            rating: {
                landscape: 4.8,
                attractions: 5,
                accessibility: 4,
                safety: 5,
                cleanliness: 4.5,
                hospitality: 4.7,
                culturalOffer: 4,
                gastronomy: 4,
                affordability: 4.2,
                nightlife: 3.8,
                infrastructure: 4.3,
                environmentalCare: 4.6,
                wifiAvailability: 4.1,
                shopping: 3.9,
                beaches: 4.4,
                greenSpaces: 4.5,
                localEvents: 4.0,
                weatherSatisfaction: 4.7
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: getMockId('user', 'user-1') as UserIdType,
            updatedById: getMockId('user', 'user-1') as UserIdType
        };
        const mockReviews = [mockReview];
        (reviewModel.findAll as Mock).mockResolvedValue({
            items: mockReviews,
            total: 1
        });
        // Act
        const result = await service.list(actor, { page: 1, pageSize: 10 });
        // Assert
        expectSuccess(result);
        expect(result.data?.items).toEqual(mockReviews);
        expect(reviewModel.findAll as Mock).toHaveBeenCalled();
    });
});
