import { AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationIdType,
    AccommodationReview,
    AccommodationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

/**
 * Test suite for AccommodationReviewService.list method.
 * Ensures correct paginated retrieval and permission handling.
 */
describe('list', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceContext;

    beforeEach(() => {
        reviewModel = createTypedModelMock(AccommodationReviewModel, ['findAll']);
        logger = createLoggerMock();
        ctx = { logger } as ServiceContext;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
    });

    it('returns a paginated list of reviews when actor has permission', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        const review: AccommodationReview = {
            id: getMockId('feature', 'review-1') as AccommodationReviewIdType,
            accommodationId: getMockId('accommodation', 'acc-1') as AccommodationIdType,
            userId: getMockId('user', 'user-1') as UserIdType,
            title: 'Great stay',
            content: 'Everything was perfect.',
            rating: {
                cleanliness: 4,
                hospitality: 5,
                services: 3,
                accuracy: 4,
                communication: 5,
                location: 4
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: getMockId('user', 'user-1') as UserIdType,
            updatedById: getMockId('user', 'user-1') as UserIdType,
            adminInfo: undefined
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
        const mockReview: AccommodationReview = {
            id: getMockId('accommodation', 'review-1') as any,
            accommodationId: getMockId('accommodation', 'accommodation-1') as AccommodationIdType,
            userId: getMockId('user', 'user-1') as UserIdType,
            title: 'Great stay',
            content: 'Had a wonderful time at this accommodation.',
            rating: {
                cleanliness: 4.5,
                hospitality: 4.0,
                services: 4.2,
                accuracy: 4.8,
                communication: 4.3,
                location: 4.6
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: undefined,
            createdById: getMockId('user', 'user-1') as UserIdType,
            updatedById: getMockId('user', 'user-1') as UserIdType,
            adminInfo: undefined
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
