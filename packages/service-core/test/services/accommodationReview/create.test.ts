// Mock getThresholdForContext so tests are isolated from DB.
vi.mock('../../../src/services/contentModeration/get-threshold-for-context.js', () => ({
    getThresholdForContext: vi.fn().mockResolvedValue({
        context: 'review',
        pending: 0.5,
        reject: 0.85,
        source: 'code-constants'
    })
}));

// Mock @repo/content-moderation to avoid env-var parsing.
vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn().mockResolvedValue({
        score: 0,
        categories: { spam: 0, sexual: 0, violence: 0, hate: 0, harassment: 0, other: 0 },
        matchedTerms: []
    })
}));

import { AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationIdType,
    AccommodationRatingInput,
    AccommodationReview,
    AccommodationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceConfig } from '../../../src/types';
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
    let logger: ReturnType<typeof createLoggerMock>;
    let ctx: ServiceConfig;

    beforeEach(() => {
        reviewModel = new AccommodationReviewModel();
        logger = createLoggerMock();
        ctx = { logger } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override for test
        service.model = reviewModel;
    });

    it('creates a review and updates accommodation stats', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
        });
        const accommodationId = getMockId('accommodation', 'acc-1') as AccommodationIdType;
        const userId = getMockId('user', 'user-1') as UserIdType;
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
            } as AccommodationRatingInput,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            title: 'Great stay',
            content: 'Everything was perfect.'
        };
        const now = new Date();
        const createdReview: AccommodationReview = {
            id: getMockId('feature', 'review-1') as AccommodationReviewIdType,
            accommodationId,
            userId,
            title: reviewInput.title,
            content: reviewInput.content,
            rating: reviewInput.rating,
            averageRating: 0,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            createdAt: now,
            updatedAt: now,
            deletedAt: undefined,
            createdById: userId,
            updatedById: userId,
            adminInfo: undefined
        };
        vi.spyOn(reviewModel, 'findOne').mockResolvedValue(null);
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'findAll').mockResolvedValue({ items: [createdReview], total: 1 });
        vi.spyOn(reviewModel, 'updateById').mockResolvedValue();
        // Mock recalculateAndUpdateAccommodationStats since it now uses raw SQL (getDb())
        // which requires an initialized database connection
        const recalcMock = vi
            .spyOn(
                service as unknown as {
                    recalculateAndUpdateAccommodationStats: (...args: unknown[]) => Promise<void>;
                },
                'recalculateAndUpdateAccommodationStats'
            )
            .mockResolvedValue();

        // Act
        const result = await service.create(actor, reviewInput);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.id).toBe(createdReview.id);
        expect(recalcMock).toHaveBeenCalledTimes(1);
        expect(recalcMock).toHaveBeenCalledWith(accommodationId, undefined);
    });
});
