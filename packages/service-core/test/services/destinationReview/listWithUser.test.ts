/**
 * @file listWithUser.test.ts
 *
 * Unit tests for DestinationReviewService.listWithUser.
 * Covers:
 * - Happy path: returns reviews with ACTIVE + APPROVED forced filters
 * - Empty result
 * - Default pagination used when no input provided
 * - Verifies pagination metadata is computed correctly
 */

import { DestinationReviewModel } from '@repo/db';
import type {
    DestinationIdType,
    DestinationReview,
    DestinationReviewIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, ModerationStatusEnum } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service.js';
import type { ServiceConfig } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

describe('DestinationReviewService.listWithUser', () => {
    let service: DestinationReviewService;
    let reviewModel: DestinationReviewModel;
    let ctx: ServiceConfig;

    const destinationId = getMockId('destination', 'dest-1') as DestinationIdType;
    const userId = getMockId('user', 'user-1') as UserIdType;

    function makeReviewWithUser() {
        return {
            id: getMockId('destinationReview', 'rev-1') as DestinationReviewIdType,
            destinationId,
            userId,
            user: { id: userId, name: 'Ana García' },
            title: 'Amazing destination',
            content: 'Loved the local culture.',
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
            averageRating: 3.9,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.APPROVED,
            isBusinessTravel: false,
            isVerified: false,
            isPublished: true,
            isRecommended: true,
            wouldVisitAgain: true,
            helpfulVotes: 0,
            totalVotes: 0,
            hasOwnerResponse: false,
            createdAt: new Date(),
            updatedAt: new Date()
        } as unknown as DestinationReview;
    }

    beforeEach(() => {
        reviewModel = createTypedModelMock(DestinationReviewModel, ['findAll', 'findAllWithUser']);
        ctx = { logger: createLoggerMock() } as ServiceConfig;
        service = new DestinationReviewService(ctx);
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
        expect(result.data?.data).toHaveLength(1);
        // Verify forced filters
        expect(reviewModel.findAllWithUser).toHaveBeenCalledWith(
            expect.objectContaining({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED
            }),
            expect.any(Object),
            undefined
        );
    });

    it('should return empty data when no reviews exist', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.listWithUser(actor);

        // Assert
        expectSuccess(result);
        expect(result.data?.data).toHaveLength(0);
    });

    it('should compute pagination metadata correctly', async () => {
        // Arrange — 25 total items, page=1, pageSize=10
        const actor = createActor({ id: userId });
        const items = Array.from({ length: 10 }, () => makeReviewWithUser());
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items, total: 25 });

        // Act
        const result = await service.listWithUser(actor, { page: 1, pageSize: 10 });

        // Assert
        expectSuccess(result);
        expect(result.data?.pagination.total).toBe(25);
        expect(result.data?.pagination.totalPages).toBe(3);
        expect(result.data?.pagination.hasNextPage).toBe(true);
        expect(result.data?.pagination.hasPreviousPage).toBe(false);
    });

    it('should use default pagination (page=1, pageSize=10) when no input is provided', async () => {
        // Arrange
        const actor = createActor({ id: userId });
        (reviewModel.findAllWithUser as Mock).mockResolvedValue({ items: [], total: 0 });

        // Act
        await service.listWithUser(actor);

        // Assert
        expect(reviewModel.findAllWithUser).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ page: 1, pageSize: 10 }),
            undefined
        );
    });
});
