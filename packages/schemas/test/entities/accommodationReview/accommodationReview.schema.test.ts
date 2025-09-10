import { describe, expect, it } from 'vitest';
import { AccommodationReviewSchema } from '../../../src/entities/accommodationReview/accommodationReview.schema';

describe('AccommodationReview Schemas', () => {
    const validReviewData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        accommodationId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Great place to stay',
        content:
            'This accommodation was amazing. The location was perfect and the amenities were excellent.',
        rating: {
            cleanliness: 5,
            hospitality: 4,
            services: 5,
            accuracy: 4,
            communication: 5,
            location: 4
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: '123e4567-e89b-12d3-a456-426614174003',
        updatedById: '123e4567-e89b-12d3-a456-426614174003',
        deletedAt: null,
        adminInfo: {
            notes: 'Great review from verified guest',
            favorite: false
        }
    };

    describe('AccommodationReviewSchema', () => {
        it('should validate a complete accommodation review', () => {
            const result = AccommodationReviewSchema.safeParse(validReviewData);
            expect(result.success).toBe(true);
        });

        it('should require all required fields', () => {
            const { id, ...invalidData } = validReviewData;

            const result = AccommodationReviewSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate rating structure', () => {
            const invalidRating = {
                ...validReviewData,
                rating: {
                    cleanliness: 6, // Invalid: should be max 5
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewSchema.safeParse(invalidRating);
            expect(result.success).toBe(false);
        });

        it('should require all rating fields', () => {
            const invalidRating = {
                ...validReviewData,
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5
                    // Missing location
                }
            };

            const result = AccommodationReviewSchema.safeParse(invalidRating);
            expect(result.success).toBe(false);
        });

        it('should validate title length constraints', () => {
            const invalidTitle = {
                ...validReviewData,
                title: 'A'.repeat(201) // Too long
            };

            const result = AccommodationReviewSchema.safeParse(invalidTitle);
            expect(result.success).toBe(false);
        });

        it('should validate content length constraints', () => {
            const invalidContent = {
                ...validReviewData,
                content: 'Short' // Too short
            };

            const result = AccommodationReviewSchema.safeParse(invalidContent);
            expect(result.success).toBe(false);
        });

        it('should allow optional title and content', () => {
            const minimalData = {
                ...validReviewData,
                title: undefined,
                content: undefined,
                adminInfo: undefined
            };

            const result = AccommodationReviewSchema.safeParse(minimalData);
            expect(result.success).toBe(true);
        });
    });
});
