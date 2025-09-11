import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DestinationFilterInputSchema,
    DestinationListItemWithStringAttractionsSchema,
    DestinationSearchForListOutputSchema,
    DestinationSummaryExtendedSchema,
    DestinationSummarySchema,
    GetDestinationAccommodationsInputSchema,
    GetDestinationStatsInputSchema,
    GetDestinationSummaryInputSchema
} from '../../../src/entities/destination/destination.query.schema.js';
import { createValidDestination } from '../../fixtures/destination.fixtures.js';

describe('Destination Query Schemas', () => {
    describe('DestinationFilterInputSchema', () => {
        it('should validate empty filter input', () => {
            const input = {};
            expect(() => DestinationFilterInputSchema.parse(input)).not.toThrow();
        });

        it('should validate filter input with pagination', () => {
            const input = {
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };
            expect(() => DestinationFilterInputSchema.parse(input)).not.toThrow();
        });

        it('should validate filter input with filters and pagination', () => {
            const input = {
                filters: {
                    isFeatured: true,
                    country: 'US',
                    minRating: 4.0
                },
                pagination: {
                    page: 2,
                    pageSize: 20
                }
            };
            expect(() => DestinationFilterInputSchema.parse(input)).not.toThrow();
        });

        it('should apply default pagination values', () => {
            const input = {
                pagination: {}
            };
            const result = DestinationFilterInputSchema.parse(input);
            expect(result.pagination?.page).toBe(1);
            expect(result.pagination?.pageSize).toBe(10);
        });

        it('should reject invalid pagination values', () => {
            const input = {
                pagination: {
                    page: 0,
                    pageSize: 101
                }
            };
            expect(() => DestinationFilterInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('GetDestinationAccommodationsInputSchema', () => {
        it('should validate with destinationId', () => {
            const input = {
                destinationId: faker.string.uuid()
            };
            expect(() => GetDestinationAccommodationsInputSchema.parse(input)).not.toThrow();
        });

        it('should validate with id', () => {
            const input = {
                id: faker.string.uuid()
            };
            expect(() => GetDestinationAccommodationsInputSchema.parse(input)).not.toThrow();
        });

        it('should validate with both destinationId and id', () => {
            const input = {
                destinationId: faker.string.uuid(),
                id: faker.string.uuid()
            };
            expect(() => GetDestinationAccommodationsInputSchema.parse(input)).not.toThrow();
        });

        it('should reject when neither destinationId nor id is provided', () => {
            const input = {};
            expect(() => GetDestinationAccommodationsInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid UUID format', () => {
            const input = {
                destinationId: 'invalid-uuid'
            };
            expect(() => GetDestinationAccommodationsInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('GetDestinationStatsInputSchema', () => {
        it('should validate valid destinationId', () => {
            const input = {
                destinationId: faker.string.uuid()
            };
            expect(() => GetDestinationStatsInputSchema.parse(input)).not.toThrow();
        });

        it('should reject missing destinationId', () => {
            const input = {};
            expect(() => GetDestinationStatsInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid UUID format', () => {
            const input = {
                destinationId: 'invalid-uuid'
            };
            expect(() => GetDestinationStatsInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('GetDestinationSummaryInputSchema', () => {
        it('should validate valid destinationId', () => {
            const input = {
                destinationId: faker.string.uuid()
            };
            expect(() => GetDestinationSummaryInputSchema.parse(input)).not.toThrow();
        });

        it('should reject missing destinationId', () => {
            const input = {};
            expect(() => GetDestinationSummaryInputSchema.parse(input)).toThrow(ZodError);
        });

        it('should reject invalid UUID format', () => {
            const input = {
                destinationId: 'invalid-uuid'
            };
            expect(() => GetDestinationSummaryInputSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('DestinationSummarySchema', () => {
        it('should validate destination summary with required fields', () => {
            const destination = createValidDestination();
            const summary = {
                id: destination.id,
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                media: destination.media,
                averageRating: destination.averageRating,
                reviewsCount: destination.reviewsCount
            };
            expect(() => DestinationSummarySchema.parse(summary)).not.toThrow();
        });

        it('should reject summary missing required fields', () => {
            const summary = {
                id: faker.string.uuid(),
                name: faker.location.city()
                // Missing other required fields
            };
            expect(() => DestinationSummarySchema.parse(summary)).toThrow(ZodError);
        });
    });

    describe('DestinationSummaryExtendedSchema', () => {
        it('should validate extended summary with all fields', () => {
            const destination = createValidDestination();
            const extendedSummary = {
                id: destination.id,
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                isFeatured: destination.isFeatured,
                location: destination.location,
                media: destination.media,
                rating: destination.rating,
                accommodationsCount: destination.accommodationsCount,
                averageRating: destination.averageRating,
                reviewsCount: destination.reviewsCount
            };
            expect(() => DestinationSummaryExtendedSchema.parse(extendedSummary)).not.toThrow();
        });
    });

    describe('DestinationListItemWithStringAttractionsSchema', () => {
        it('should validate list item with string attractions', () => {
            const destination = createValidDestination();
            const listItem = {
                id: destination.id,
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                isFeatured: destination.isFeatured,
                location: destination.location,
                media: destination.media,
                rating: destination.rating,
                accommodationsCount: destination.accommodationsCount,
                createdAt: destination.createdAt,
                updatedAt: destination.updatedAt,
                attractions: ['Beach', 'Museum', 'Park']
            };
            expect(() =>
                DestinationListItemWithStringAttractionsSchema.parse(listItem)
            ).not.toThrow();
        });

        it('should validate list item without attractions', () => {
            const destination = createValidDestination();
            const listItem = {
                id: destination.id,
                slug: destination.slug,
                name: destination.name,
                summary: destination.summary,
                isFeatured: destination.isFeatured,
                location: destination.location,
                media: destination.media,
                rating: destination.rating,
                accommodationsCount: destination.accommodationsCount,
                createdAt: destination.createdAt,
                updatedAt: destination.updatedAt
            };
            expect(() =>
                DestinationListItemWithStringAttractionsSchema.parse(listItem)
            ).not.toThrow();
        });
    });

    describe('DestinationSearchForListOutputSchema', () => {
        it('should validate search for list output', () => {
            const destination = createValidDestination();
            const output = {
                items: [
                    {
                        id: destination.id,
                        slug: destination.slug,
                        name: destination.name,
                        summary: destination.summary,
                        isFeatured: destination.isFeatured,
                        location: destination.location,
                        media: destination.media,
                        rating: destination.rating,
                        accommodationsCount: destination.accommodationsCount,
                        createdAt: destination.createdAt,
                        updatedAt: destination.updatedAt,
                        attractions: ['Beach', 'Museum']
                    }
                ],
                total: 1
            };
            expect(() => DestinationSearchForListOutputSchema.parse(output)).not.toThrow();
        });

        it('should validate empty search results', () => {
            const output = {
                items: [],
                total: 0
            };
            expect(() => DestinationSearchForListOutputSchema.parse(output)).not.toThrow();
        });

        it('should reject negative total', () => {
            const output = {
                items: [],
                total: -1
            };
            expect(() => DestinationSearchForListOutputSchema.parse(output)).toThrow(ZodError);
        });
    });
});
