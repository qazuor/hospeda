import type {
    DestinationId,
    DestinationReviewId,
    DestinationReviewType,
    UserId
} from '@repo/types';
import { getMockId } from './utilsFactory';

/**
 * Returns a mock DestinationReviewType object with default values. You can override any field.
 * @param overrides - Partial fields to override in the mock.
 * @returns DestinationReviewType
 * @example
 * const review = getMockDestinationReview({ id: 'review-2' as DestinationReviewId });
 */
export const getMockDestinationReview = (
    overrides: Partial<DestinationReviewType> = {}
): DestinationReviewType => ({
    id: '22222222-2222-2222-2222-222222222222' as DestinationReviewId,
    destinationId: 'dest-uuid' as DestinationId,
    userId: 'user-uuid' as UserId,
    title: 'Hermoso lugar',
    content: 'La experiencia fue increíble.',
    rating: {
        landscape: 5,
        attractions: 5,
        accessibility: 4,
        safety: 5,
        cleanliness: 5,
        hospitality: 5,
        culturalOffer: 4,
        gastronomy: 5,
        affordability: 4,
        nightlife: 3,
        infrastructure: 4,
        environmentalCare: 5,
        wifiAvailability: 4,
        shopping: 3,
        beaches: 4,
        greenSpaces: 5,
        localEvents: 4,
        weatherSatisfaction: 5
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    ...overrides
});

export const createMockDestinationReview = (
    overrides: Partial<DestinationReviewType> = {}
): DestinationReviewType => getMockDestinationReview(overrides);

export const createMockDestinationReviewInput = (
    overrides: Partial<Omit<DestinationReviewType, 'id'>> = {}
): Omit<DestinationReviewType, 'id'> => {
    const { id, ...input } = getMockDestinationReview();
    return { ...input, ...overrides } as Omit<DestinationReviewType, 'id'>;
};

export const getMockDestinationReviewId = (id?: string): DestinationReviewId => {
    return getMockId('destination-review', id) as DestinationReviewId;
};
