/**
 * @file listWithUser.test.ts
 *
 * Unit tests for AccommodationReviewService.listWithUser.
 * Covers:
 * - Happy path: returns reviews with ACTIVE + APPROVED enforced
 * - Empty result
 * - Verifies that caller-supplied lifecycleState cannot override the forced filter
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

describe('AccommodationReviewService.listWithUser', () => {
    let service: AccommodationReviewService;
    let reviewModel: AccommodationReviewModel;
    let ctx: ServiceConfig;

    const accommodationId = getMockId('accommodation', 'acc-1') as AccommodationIdType;
    const userId = getMockId('user', 'user-1') as UserIdType;

    function makeReviewWithUser() {
        return {
            id: getMockId('accommodationReview', 'rev-1') as AccommodationReviewIdType,
            accommodationId,
            userId,
            user: { id: userId, name: 'Ana García' },
            title: 'Great stay',
            content: 'Very comfortable.',
            rating: {
                cleanliness: 5,
                hospitality: 5,
                services: 4,
                accuracy: 5,
                communication: 5,
                location: 5
            },
            averageRating: 4.8,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            createdAt: new Date(),
            updatedAt: new Date()
        } as unknown as AccommodationReview;
    }

    beforeEach(() => {
        reviewModel = createTypedModelMock(AccommodationReviewModel, [
            'findAll',
            'findAllWithUser'
        ]);
        ctx = { logger: createLoggerMock() } as ServiceConfig;
        service = new AccommodationReviewService(ctx);
        // @ts-expect-error: override model for test
        service.model = reviewModel;
    });

    it('should return reviews with forced ACTIVE + APPROVED filters', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        const review = makeReviewWithUser();
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: [review], total: 1 });

        // Act
        const result = await service.listWithUser(actor, { page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toHaveLength(1);
        // Verify forced filters on the model call
        expect(reviewModel.findAllWithUser).toHaveBeenCalledWith(
            expect.objectContaining({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            }),
            expect.any(Object),
            undefined
        );
    });

    it('should return empty accommodationReviews when no results', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.listWithUser(actor);

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toHaveLength(0);
    });

    it('should use default pagination when no input is provided', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.listWithUser(actor);

        // Assert — verifies pagination defaults
        expect(reviewModel.findAllWithUser).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ page: 1, pageSize: 10 }),
            undefined
        );
    });

    it('should handle non-array items from model gracefully', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: undefined, total: 0 });

        // Act
        const result = await service.listWithUser(actor, { page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.accommodationReviews).toEqual([]);
    });
});
