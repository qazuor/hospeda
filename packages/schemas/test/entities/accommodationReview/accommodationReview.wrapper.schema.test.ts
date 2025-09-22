import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationReviewListWrapperSchema,
    AccommodationReviewStatsWrapperSchema,
    AccommodationReviewWithUserListWrapperSchema
} from '../../../src/entities/accommodationReview/accommodationReview.query.schema.js';

// Mock data for testing
const mockAccommodationReview = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    accommodationId: '123e4567-e89b-12d3-a456-426614174001',
    userId: '123e4567-e89b-12d3-a456-426614174002',
    rating: {
        cleanliness: 5,
        hospitality: 4,
        services: 5,
        accuracy: 4,
        communication: 5,
        location: 4
    },
    title: 'Great stay!',
    content: 'Had an amazing time at this accommodation.',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-01T00:00:00Z')
};

const mockAccommodationReviewWithUser = {
    ...mockAccommodationReview,
    user: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John D.',
        avatar: 'https://example.com/avatar.jpg'
    }
};

const mockAccommodationReviewStats = {
    accommodationId: '123e4567-e89b-12d3-a456-426614174001',
    totalReviews: 10,
    averageRating: 4.2,
    ratingDistribution: {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4
    },
    reviewsWithContent: 8,
    reviewsWithImages: 5,
    verifiedReviews: 7,
    reviewsWithOwnerResponse: 3,
    reviewsThisMonth: 2,
    reviewsThisYear: 10
};

describe('AccommodationReviewListWrapperSchema', () => {
    it('should validate accommodation review list wrapper with valid data', () => {
        const wrapper = { accommodationReviews: [mockAccommodationReview] };
        expect(() => AccommodationReviewListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should validate empty accommodation review array', () => {
        const wrapper = { accommodationReviews: [] };
        expect(() => AccommodationReviewListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should validate multiple accommodation reviews', () => {
        const wrapper = {
            accommodationReviews: [mockAccommodationReview, mockAccommodationReview]
        };
        expect(() => AccommodationReviewListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should reject invalid wrapper structure', () => {
        const invalidWrapper = { reviews: [mockAccommodationReview] }; // Wrong property name
        expect(() => AccommodationReviewListWrapperSchema.parse(invalidWrapper)).toThrow(ZodError);
    });

    it('should reject invalid accommodation review data', () => {
        const invalidReview = { ...mockAccommodationReview, id: 'invalid-uuid' };
        const wrapper = { accommodationReviews: [invalidReview] };
        expect(() => AccommodationReviewListWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });
});

describe('AccommodationReviewStatsWrapperSchema', () => {
    it('should validate accommodation review stats wrapper with valid data', () => {
        const wrapper = { stats: mockAccommodationReviewStats };
        expect(() => AccommodationReviewStatsWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should reject invalid wrapper structure', () => {
        const invalidWrapper = { statistics: mockAccommodationReviewStats }; // Wrong property name
        expect(() => AccommodationReviewStatsWrapperSchema.parse(invalidWrapper)).toThrow(ZodError);
    });

    it('should reject invalid stats data', () => {
        const invalidStats = { ...mockAccommodationReviewStats, totalReviews: -1 }; // Negative count
        const wrapper = { stats: invalidStats };
        expect(() => AccommodationReviewStatsWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });

    it('should reject missing required stats fields', () => {
        const incompleteStats = { accommodationId: '123e4567-e89b-12d3-a456-426614174001' };
        const wrapper = { stats: incompleteStats };
        expect(() => AccommodationReviewStatsWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });
});

describe('AccommodationReviewWithUserListWrapperSchema', () => {
    it('should validate accommodation review with user list wrapper', () => {
        const wrapper = { accommodationReviews: [mockAccommodationReviewWithUser] };
        expect(() => AccommodationReviewWithUserListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should validate accommodation review without user data', () => {
        const reviewWithoutUser = { ...mockAccommodationReview };
        const wrapper = { accommodationReviews: [reviewWithoutUser] };
        expect(() => AccommodationReviewWithUserListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should validate empty accommodation review array', () => {
        const wrapper = { accommodationReviews: [] };
        expect(() => AccommodationReviewWithUserListWrapperSchema.parse(wrapper)).not.toThrow();
    });

    it('should reject invalid user data', () => {
        const invalidUserReview = {
            ...mockAccommodationReview,
            user: { id: 'invalid-uuid' } // Invalid UUID
        };
        const wrapper = { accommodationReviews: [invalidUserReview] };
        expect(() => AccommodationReviewWithUserListWrapperSchema.parse(wrapper)).toThrow(ZodError);
    });

    it('should reject invalid wrapper structure', () => {
        const invalidWrapper = { reviews: [mockAccommodationReviewWithUser] }; // Wrong property name
        expect(() => AccommodationReviewWithUserListWrapperSchema.parse(invalidWrapper)).toThrow(
            ZodError
        );
    });
});
