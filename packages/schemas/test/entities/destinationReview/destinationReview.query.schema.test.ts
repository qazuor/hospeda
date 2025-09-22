import { describe, expect, it } from 'vitest';
import {
    DestinationReviewCountInputSchema,
    DestinationReviewListInputSchema,
    DestinationReviewSearchInputSchema,
    DestinationReviewStatsInputSchema
} from '../../../src/entities/destinationReview/destinationReview.query.schema';

describe('DestinationReview Query Schemas', () => {
    describe('DestinationReviewSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const searchData = {
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc' as const,
                q: 'great destination',
                filters: {
                    destinationId: '123e4567-e89b-12d3-a456-426614174002',
                    userId: '123e4567-e89b-12d3-a456-426614174001',
                    minRating: 3,
                    maxRating: 5,
                    hasTitle: true,
                    hasContent: true,
                    reviewedAfter: new Date('2024-01-01'),
                    reviewedBefore: new Date('2024-12-31')
                }
            };

            const result = DestinationReviewSearchInputSchema.safeParse(searchData);
            expect(result.success).toBe(true);
        });

        it('should allow empty search input', () => {
            const emptySearch = {};

            const result = DestinationReviewSearchInputSchema.safeParse(emptySearch);
            expect(result.success).toBe(true);
        });

        it('should validate rating range', () => {
            const invalidRatingRange = {
                filters: {
                    rating: {
                        min: 6, // Invalid: max is 5
                        max: 5
                    }
                }
            };

            const result = DestinationReviewSearchInputSchema.safeParse(invalidRatingRange);
            expect(result.success).toBe(false);
        });

        it('should allow partial filters', () => {
            const partialFilters = {
                filters: {
                    destinationId: '123e4567-e89b-12d3-a456-426614174002',
                    hasTitle: true
                }
            };

            const result = DestinationReviewSearchInputSchema.safeParse(partialFilters);
            expect(result.success).toBe(true);
        });
    });

    describe('DestinationReviewListInputSchema', () => {
        it('should validate valid list input', () => {
            const listData = {
                page: 1,
                pageSize: 20,
                destinationId: '123e4567-e89b-12d3-a456-426614174002',
                userId: '123e4567-e89b-12d3-a456-426614174001'
            };

            const result = DestinationReviewListInputSchema.safeParse(listData);
            expect(result.success).toBe(true);
        });

        it('should allow minimal list input', () => {
            const minimalList = {};

            const result = DestinationReviewListInputSchema.safeParse(minimalList);
            expect(result.success).toBe(true);
        });

        it('should validate pagination values', () => {
            const invalidPagination = {
                page: 0, // Invalid: should be positive
                pageSize: 10
            };

            const result = DestinationReviewListInputSchema.safeParse(invalidPagination);
            expect(result.success).toBe(false);
        });

        it('should default pagination values', () => {
            const listData = {};

            const result = DestinationReviewListInputSchema.safeParse(listData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(10);
            }
        });
    });

    describe('DestinationReviewCountInputSchema', () => {
        it('should validate valid count input', () => {
            const countData = {
                filters: {
                    destinationId: '123e4567-e89b-12d3-a456-426614174002',
                    minRating: 4
                }
            };

            const result = DestinationReviewCountInputSchema.safeParse(countData);
            expect(result.success).toBe(true);
        });

        it('should allow empty count input', () => {
            const emptyCount = {};

            const result = DestinationReviewCountInputSchema.safeParse(emptyCount);
            expect(result.success).toBe(true);
        });
    });

    describe('DestinationReviewStatsInputSchema', () => {
        it('should validate valid stats input', () => {
            const statsData = {
                destinationId: '123e4567-e89b-12d3-a456-426614174002',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31')
            };

            const result = DestinationReviewStatsInputSchema.safeParse(statsData);
            expect(result.success).toBe(true);
        });

        it('should require destinationId', () => {
            const statsData = {
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31')
            };

            const result = DestinationReviewStatsInputSchema.safeParse(statsData);
            expect(result.success).toBe(false);
        });

        it('should allow optional date range', () => {
            const statsData = {
                destinationId: '123e4567-e89b-12d3-a456-426614174002'
            };

            const result = DestinationReviewStatsInputSchema.safeParse(statsData);
            expect(result.success).toBe(true);
        });

        it('should validate UUID format for destinationId', () => {
            const statsData = {
                destinationId: 'invalid-uuid'
            };

            const result = DestinationReviewStatsInputSchema.safeParse(statsData);
            expect(result.success).toBe(false);
        });
    });
});
