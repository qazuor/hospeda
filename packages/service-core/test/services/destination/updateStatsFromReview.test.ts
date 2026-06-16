/**
 * @file updateStatsFromReview.test.ts
 *
 * Unit tests for DestinationService.updateStatsFromReview.
 * Covers:
 * - Happy path: delegates to model.updateById with correct fields
 * - Passes rating (or undefined) to the model
 */

import type { DestinationModel } from '@repo/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service.js';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory.js';

const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('DestinationService.updateStatsFromReview', () => {
    let service: DestinationService;
    let destModelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        destModelMock = createModelMock(['updateById']);
        service = new DestinationService(
            { logger: createLoggerMock() },
            destModelMock as unknown as DestinationModel
        );
        asMock(destModelMock.updateById).mockResolvedValue(undefined);
    });

    it('should call model.updateById with reviewsCount, averageRating and rating', async () => {
        // Arrange
        const destinationId = 'dest-001';
        const rating = {
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
        };

        // Act
        await service.updateStatsFromReview(destinationId, {
            reviewsCount: 42,
            averageRating: 4.1,
            rating
        });

        // Assert
        expect(destModelMock.updateById).toHaveBeenCalledOnce();
        expect(destModelMock.updateById).toHaveBeenCalledWith(
            destinationId,
            {
                reviewsCount: 42,
                averageRating: 4.1,
                rating
            },
            undefined
        );
    });

    it('should call model.updateById with undefined rating when rating is not provided', async () => {
        // Arrange
        const destinationId = 'dest-002';

        // Act
        await service.updateStatsFromReview(destinationId, {
            reviewsCount: 0,
            averageRating: 0,
            rating: undefined
        });

        // Assert
        expect(destModelMock.updateById).toHaveBeenCalledWith(
            destinationId,
            {
                reviewsCount: 0,
                averageRating: 0,
                rating: undefined
            },
            undefined
        );
    });

    it('should propagate the transaction when ctx.tx is provided', async () => {
        // Arrange
        const destinationId = 'dest-003';
        const fakeTx = {} as Parameters<typeof service.updateStatsFromReview>[2] extends {
            tx?: infer T;
        }
            ? T
            : never;

        // Act — pass a minimal ctx with a tx
        await service.updateStatsFromReview(
            destinationId,
            { reviewsCount: 5, averageRating: 3.5, rating: undefined },
            {
                tx: fakeTx as Parameters<typeof service.updateStatsFromReview>[2] extends {
                    tx?: infer T;
                }
                    ? T
                    : never
            }
        );

        // Assert — tx is forwarded to updateById
        expect(destModelMock.updateById).toHaveBeenCalledWith(
            destinationId,
            expect.any(Object),
            fakeTx
        );
    });
});
