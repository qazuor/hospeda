import type { DestinationRatingInput, DestinationReview } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/destinationReview/destinationReview.normalizers';

const fullRating: DestinationRatingInput = {
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

const baseInput: DestinationReview = {
    id: 'review-1' as unknown as import('@repo/schemas').DestinationReviewIdType,
    destinationId: 'dest-1' as unknown as import('@repo/schemas').DestinationIdType,
    userId: 'user-1' as unknown as import('@repo/schemas').UserIdType,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
    createdById: 'user-1' as unknown as import('@repo/schemas').UserIdType,
    updatedById: 'user-1' as unknown as import('@repo/schemas').UserIdType,
    deletedAt: undefined,
    deletedById: undefined,
    rating: fullRating,
    title: 'Great place!',
    content: 'Very nice experience.'
};

describe('destinationReview.normalizers', () => {
    describe('normalizeCreateInput', () => {
        it('should return the input unchanged', () => {
            const result = normalizeCreateInput(baseInput, {
                id: 'user-1',
                role: RoleEnum.USER,
                permissions: []
            });
            expect(result).toEqual(baseInput);
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should return the input unchanged', () => {
            const result = normalizeUpdateInput(baseInput, {
                id: 'user-1',
                role: RoleEnum.USER,
                permissions: []
            });
            expect(result).toEqual(baseInput);
        });
    });
});
