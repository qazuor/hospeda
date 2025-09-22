import { describe, expect, it } from 'vitest';
import {
    AccommodationReviewListByAccommodationOutputSchema,
    AccommodationReviewListByAccommodationParamsSchema,
    AccommodationReviewListWithUserOutputSchema,
    AccommodationReviewListWithUserParamsSchema,
    AccommodationReviewSearchParamsSchema,
    AccommodationReviewWithUserSchema
} from '../../../src/entities/accommodationReview/accommodationReview.query.schema.js';

describe('AccommodationReview Query Schemas', () => {
    describe('AccommodationReviewListByAccommodationParamsSchema', () => {
        it('should validate accommodation ID with pagination', () => {
            const validData = {
                accommodationId: '123e4567-e89b-12d3-a456-426614174000',
                page: 1,
                pageSize: 10
            };

            const result = AccommodationReviewListByAccommodationParamsSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate accommodation ID without pagination', () => {
            const validData = {
                accommodationId: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = AccommodationReviewListByAccommodationParamsSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should require accommodationId', () => {
            const invalidData = {
                page: 1,
                pageSize: 10
            };

            const result =
                AccommodationReviewListByAccommodationParamsSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('AccommodationReviewListWithUserParamsSchema', () => {
        it('should validate list with user parameters', () => {
            const validData = {
                page: 1,
                pageSize: 20,
                filters: {
                    rating: 5,
                    hasContent: true
                }
            };

            const result = AccommodationReviewListWithUserParamsSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate empty parameters', () => {
            const result = AccommodationReviewListWithUserParamsSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should validate pageSize limits', () => {
            const invalidData = {
                pageSize: 150 // Max is 100
            };

            const result = AccommodationReviewListWithUserParamsSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('AccommodationReviewSearchParamsSchema', () => {
        it('should validate search parameters', () => {
            const validData = {
                accommodationId: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                rating: 4,
                hasContent: true,
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31'),
                page: 1,
                pageSize: 10
            };

            const result = AccommodationReviewSearchParamsSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate minimal search parameters', () => {
            const validData = {
                page: 1
            };

            const result = AccommodationReviewSearchParamsSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate rating range', () => {
            const invalidData = {
                filters: {
                    rating: 6 // Max is 5
                }
            };

            const result = AccommodationReviewSearchParamsSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('AccommodationReviewWithUserSchema', () => {
        it('should validate review with user information', () => {
            const validData = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                accommodationId: '123e4567-e89b-12d3-a456-426614174002',
                title: 'Great place',
                content: 'Amazing accommodation with excellent service.',
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
                deletedAt: null,
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                adminInfo: {
                    notes: 'Great review from verified guest',
                    favorite: false
                },
                user: {
                    id: '123e4567-e89b-12d3-a456-426614174001',
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com'
                }
            };

            const result = AccommodationReviewWithUserSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate review without user information', () => {
            const validData = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                userId: '123e4567-e89b-12d3-a456-426614174001',
                accommodationId: '123e4567-e89b-12d3-a456-426614174002',
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
                deletedAt: null,
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                adminInfo: {
                    notes: 'Great review from verified guest',
                    favorite: false
                }
            };

            const result = AccommodationReviewWithUserSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
    });

    describe('Output Schemas', () => {
        it('should validate list with user output', () => {
            const validData = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = AccommodationReviewListWithUserOutputSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should validate list by accommodation output', () => {
            const validData = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            const result = AccommodationReviewListByAccommodationOutputSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });
    });
});
