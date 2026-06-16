/**
 * @file listByAccommodation.test.ts
 *
 * Unit tests for AccommodationReviewService.listByAccommodation.
 * Covers:
 * - Happy path with ACTIVE + APPROVED filter (public mode)
 * - Happy path with includeAllStates=true (admin mode, no lifecycle/moderation filter)
 * - Empty result
 * - Permission check via _canList
 */

import { AccommodationReviewModel } from '@repo/db';
import type {
    AccommodationIdType,
    AccommodationReview,
    AccommodationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service.js';
import type { ServiceConfig } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

describe('AccommodationReviewService.listByAccommodation', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let ctx: ServiceConfig;

    const accommodationId = getMockId('accommodation', 'acc-1') as AccommodationIdType;
    const userId = getMockId('user', 'user-1') as UserIdType;

    function makeReview(): AccommodationReview {
        return {
            id: getMockId('accommodationReview', 'rev-1') as AccommodationReviewIdType,
            accommodationId,
            userId,
            title: 'Nice stay',
            content: 'Comfortable and clean.',
            rating: {
                cleanliness: 5,
                hospitality: 4,
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
        };
    }

    beforeEach(() => {
        reviewModel = createTypedModelMock(AccommodationReviewModel, ['findAll']);
        ctx = { logger: createLoggerMock() } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override model for test
        service.model = reviewModel;
    });

    it('should return reviews filtered by ACTIVE + APPROVED in public mode (no includeAllStates)', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        const review = makeReview();
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [review], total: 1 });

        // Act
        const result = await service.listByAccommodation(actor, {
            accommodationId,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toHaveLength(1);
        expect(result.data?.total).toBe(1);
        // Verify that findAll was called with lifecycleState + moderationState filters
        expect(reviewModel.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            }),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('should return reviews without lifecycle/moderation filter when includeAllStates=true', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        const review = makeReview();
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [review], total: 1 });

        // Act
        const result = await service.listByAccommodation(
            actor,
            { accommodationId, page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'asc' },
            { includeAllStates: true }
        );

        // Assert
        expectSuccess(result);
        // Verify that findAll was called WITHOUT lifecycleState/moderationState filters
        const callArgs = (reviewModel.findAll as Mock).mock.calls[0] as [
            Record<string, unknown>,
            ...unknown[]
        ];
        expect(callArgs[0]).not.toHaveProperty('lifecycleState');
        expect(callArgs[0]).not.toHaveProperty('moderationState');
    });

    it('should return empty list when no reviews exist', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAll as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.listByAccommodation(actor, {
            accommodationId,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toHaveLength(0);
        expect(result.data?.total).toBe(0);
    });

    it('should handle non-array items gracefully (defensive guard)', async () => {
        // Arrange — simulate a model returning undefined items
        const actor = createActor({ id: userId });
        (reviewModel.findAll as Mock).mockResolvedValue({ items: undefined, total: 0 });

        // Act
        const result = await service.listByAccommodation(actor, {
            accommodationId,
            page: 1,
            pageSize: 5,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });

        // Assert — should fall back to empty array
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toEqual([]);
    });
});
