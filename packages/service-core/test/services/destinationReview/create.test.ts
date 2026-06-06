import { DestinationReviewModel } from '@repo/db';
import type {
    DestinationIdType,
    DestinationReview,
    DestinationReviewCreateInput,
    DestinationReviewIdType,
    UserIdType
} from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
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
        lifecycleState: LifecycleStatusEnum.ACTIVE,
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

    const buildCreatedReview = (input: DestinationReviewCreateInput): DestinationReview => {
        const now = new Date();
        return {
            id: getMockId('feature', 'review-1') as DestinationReviewIdType,
            destinationId: input.destinationId,
            userId: input.userId,
            title: input.title,
            content: input.content,
            rating: input.rating,
            averageRating: 0,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.PENDING,
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
            createdById: input.userId,
            updatedById: input.userId
        };
    };

    it('creates a review and updates destination stats', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
        const reviewInput = buildReviewInput();
        const createdReview = buildCreatedReview(reviewInput);
        vi.spyOn(reviewModel, 'findOne').mockResolvedValue(null);
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

    // ===========================================================================
    // SPEC-202 T-013 — duplicate guard in _beforeCreate
    // ===========================================================================

    it('throws ALREADY_EXISTS when a non-deleted review already exists for the user+destination', async () => {
        // Arrange — model.findOne resolves an existing (non-deleted) review row
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const reviewInput = buildReviewInput();
        const existingReview = buildCreatedReview(reviewInput);
        vi.spyOn(reviewModel, 'findOne').mockResolvedValue(existingReview);

        // Act
        const result = await service.create(actor, reviewInput);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('proceeds to create when findOne resolves null (no existing review)', async () => {
        // Arrange — model.findOne returns null → no prior review exists
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const reviewInput = buildReviewInput();
        const createdReview = buildCreatedReview(reviewInput);
        vi.spyOn(reviewModel, 'findOne').mockResolvedValue(null);
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'update').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'updateById').mockResolvedValue();
        vi.spyOn(
            service as unknown as {
                recalculateAndUpdateDestinationStats: (...args: unknown[]) => Promise<void>;
            },
            'recalculateAndUpdateDestinationStats'
        ).mockResolvedValue();

        // Act
        const result = await service.create(actor, reviewInput);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('omits deletedAt from the findOne filter (soft-deleted rows also block re-submission, matching the plain unique index)', async () => {
        // Arrange
        const actor = createActor({
            id: getMockId('user', 'actor-1') as UserIdType,
            permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
        });
        const reviewInput = buildReviewInput();
        const createdReview = buildCreatedReview(reviewInput);
        const findOneSpy = vi.spyOn(reviewModel, 'findOne').mockResolvedValue(null);
        vi.spyOn(reviewModel, 'create').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'update').mockResolvedValue(createdReview);
        vi.spyOn(reviewModel, 'updateById').mockResolvedValue();
        vi.spyOn(
            service as unknown as {
                recalculateAndUpdateDestinationStats: (...args: unknown[]) => Promise<void>;
            },
            'recalculateAndUpdateDestinationStats'
        ).mockResolvedValue();

        // Act
        await service.create(actor, reviewInput);

        // Assert — the duplicate pre-check must NOT filter on deletedAt: the DB
        // unique index on (user_id, destination_id) is plain, so a soft-deleted
        // row would still reject the insert; matching it here yields a clean 409.
        expect(findOneSpy).toHaveBeenCalledWith({
            userId: reviewInput.userId,
            destinationId: reviewInput.destinationId
        });
    });
});
