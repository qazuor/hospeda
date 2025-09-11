import { describe, expect, it } from 'vitest';
import { DestinationReviewSchema } from '../../../src/entities/destinationReview/destinationReview.schema';

describe('DestinationReview Schemas', () => {
    const validReviewData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        destinationId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Amazing destination',
        content:
            'This destination was incredible. The landscape was breathtaking and the local culture was fascinating.',
        rating: {
            landscape: 5,
            attractions: 4,
            accessibility: 3,
            safety: 5,
            cleanliness: 4,
            hospitality: 5,
            culturalOffer: 4,
            gastronomy: 5,
            affordability: 3,
            nightlife: 4,
            infrastructure: 4,
            environmentalCare: 5,
            wifiAvailability: 3,
            shopping: 3,
            beaches: 4,
            greenSpaces: 5,
            localEvents: 4,
            weatherSatisfaction: 4
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: '123e4567-e89b-12d3-a456-426614174003',
        updatedById: '123e4567-e89b-12d3-a456-426614174003',
        deletedAt: null,
        adminInfo: {
            notes: 'Great review from verified traveler',
            favorite: false
        }
    };

    describe('DestinationReviewSchema', () => {
        it('should validate a complete destination review', () => {
            const result = DestinationReviewSchema.safeParse(validReviewData);
            expect(result.success).toBe(true);
        });

        it('should require all required fields', () => {
            const { id, ...invalidData } = validReviewData;

            const result = DestinationReviewSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate rating structure', () => {
            const invalidRating = {
                ...validReviewData,
                rating: {
                    ...validReviewData.rating,
                    landscape: 6 // Invalid: should be max 5
                }
            };

            const result = DestinationReviewSchema.safeParse(invalidRating);
            expect(result.success).toBe(false);
        });

        it('should require all rating fields', () => {
            const invalidRating = {
                ...validReviewData,
                rating: {
                    landscape: 5,
                    attractions: 4,
                    accessibility: 3,
                    safety: 5,
                    cleanliness: 4,
                    hospitality: 5,
                    culturalOffer: 4,
                    gastronomy: 5,
                    affordability: 3,
                    nightlife: 4,
                    infrastructure: 4,
                    environmentalCare: 5,
                    wifiAvailability: 3,
                    shopping: 3,
                    beaches: 4,
                    greenSpaces: 5,
                    localEvents: 4
                    // Missing weatherSatisfaction
                }
            };

            const result = DestinationReviewSchema.safeParse(invalidRating);
            expect(result.success).toBe(false);
        });

        it('should validate title length constraints', () => {
            const invalidTitle = {
                ...validReviewData,
                title: 'A'.repeat(51) // Too long (max 50)
            };

            const result = DestinationReviewSchema.safeParse(invalidTitle);
            expect(result.success).toBe(false);
        });

        it('should validate content length constraints', () => {
            const invalidContent = {
                ...validReviewData,
                content: 'Short' // Too short (min 10)
            };

            const result = DestinationReviewSchema.safeParse(invalidContent);
            expect(result.success).toBe(false);
        });

        it('should allow optional title and content', () => {
            const minimalData = {
                ...validReviewData,
                title: undefined,
                content: undefined,
                adminInfo: undefined
            };

            const result = DestinationReviewSchema.safeParse(minimalData);
            expect(result.success).toBe(true);
        });

        it('should validate rating values are within range', () => {
            const invalidRatingNegative = {
                ...validReviewData,
                rating: {
                    ...validReviewData.rating,
                    safety: -1 // Invalid: should be min 0
                }
            };

            const result = DestinationReviewSchema.safeParse(invalidRatingNegative);
            expect(result.success).toBe(false);
        });

        it('should require userId and destinationId', () => {
            const { userId, ...withoutUserId } = validReviewData;
            const { destinationId, ...withoutDestinationId } = validReviewData;

            const resultWithoutUserId = DestinationReviewSchema.safeParse(withoutUserId);
            const resultWithoutDestinationId =
                DestinationReviewSchema.safeParse(withoutDestinationId);

            expect(resultWithoutUserId.success).toBe(false);
            expect(resultWithoutDestinationId.success).toBe(false);
        });
    });
});
