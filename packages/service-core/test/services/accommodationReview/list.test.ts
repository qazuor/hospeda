import { AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationId,
    AccommodationReviewId,
    AccommodationReviewType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceContext } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectSuccess } from '../../helpers/assertions';
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
            id: getMockId('user', 'actor-1') as UserId,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        const review: AccommodationReviewType = {
            id: getMockId('feature', 'review-1') as AccommodationReviewId,
            accommodationId: getMockId('accommodation', 'acc-1') as AccommodationId,
            userId: getMockId('user', 'user-1') as UserId,
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
            createdById: getMockId('user', 'user-1') as UserId,
            updatedById: getMockId('user', 'user-1') as UserId,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: undefined
        };
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [review], total: 1 });

        // Act
        const result = await service.list(actor, { page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.items?.[0]?.id).toBe(review.id);
    });

    it('returns FORBIDDEN if actor lacks permission', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-2') as UserId,
            permissions: []
        });
        // Act
        const result = await service.list(actor, { page: 1, pageSize: 10 });
        // Assert
        expectForbiddenError(result);
        expect(reviewModel.findAll as Mock).not.toHaveBeenCalled();
    });
});
