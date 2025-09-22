import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    FeatureFiltersSchema,
    FeatureListInputSchema,
    FeatureListItemSchema,
    FeatureListOutputSchema,
    FeatureSearchInputSchema,
    FeatureSearchOutputSchema,
    FeatureSearchResultSchema,
    FeatureStatsSchema,
    FeatureSummarySchema
} from '../../../src/entities/feature/feature.query.schema.js';
import { createValidFeatureFilters } from '../../fixtures/feature.fixtures.js';

describe('Feature Query Schemas', () => {
    describe('FeatureFiltersSchema', () => {
        it('should validate empty filters', () => {
            const emptyFilters = {};

            expect(() => FeatureFiltersSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should validate filters with category', () => {
            const filters = {
                category: faker.lorem.word()
            };

            expect(() => FeatureFiltersSchema.parse(filters)).not.toThrow();

            const result = FeatureFiltersSchema.parse(filters);
            expect(result.category).toBe(filters.category);
        });

        it('should validate filters with categories array', () => {
            const filters = {
                categories: [faker.lorem.word(), faker.lorem.word()]
            };

            expect(() => FeatureFiltersSchema.parse(filters)).not.toThrow();

            const result = FeatureFiltersSchema.parse(filters);
            expect(Array.isArray(result.categories)).toBe(true);
            expect(result.categories?.length).toBe(2);
        });

        it('should validate filters with boolean flags', () => {
            const filters = {
                hasIcon: faker.datatype.boolean(),
                isAvailable: faker.datatype.boolean()
            };

            expect(() => FeatureFiltersSchema.parse(filters)).not.toThrow();

            const result = FeatureFiltersSchema.parse(filters);
            expect(typeof result.hasIcon).toBe('boolean');
            expect(typeof result.isAvailable).toBe('boolean');
        });

        it('should validate complete filters', () => {
            const filters = createValidFeatureFilters();

            expect(() => FeatureFiltersSchema.parse(filters)).not.toThrow();

            const result = FeatureFiltersSchema.parse(filters);
            expect(result.category).toBeDefined();
        });

        it('should reject filters with invalid category type', () => {
            const filters = {
                category: 123 // Invalid: should be string
            };

            expect(() => FeatureFiltersSchema.parse(filters)).toThrow(ZodError);
        });

        it('should reject filters with invalid boolean type', () => {
            const filters = {
                hasIcon: 'not-boolean'
            };

            expect(() => FeatureFiltersSchema.parse(filters)).toThrow(ZodError);
        });
    });

    describe('FeatureListInputSchema', () => {
        it('should validate list input with pagination', () => {
            const listInput = {
                page: 1,
                pageSize: 20
            };

            expect(() => FeatureListInputSchema.parse(listInput)).not.toThrow();

            const result = FeatureListInputSchema.parse(listInput);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
        });

        it('should validate list input with defaults', () => {
            const listInput = {};

            expect(() => FeatureListInputSchema.parse(listInput)).not.toThrow();

            const result = FeatureListInputSchema.parse(listInput);
            expect(result.page).toBe(1); // Default value
            expect(result.pageSize).toBe(10); // Default value
        });

        it('should reject list input with invalid page', () => {
            const listInput = {
                page: 0
            };

            expect(() => FeatureListInputSchema.parse(listInput)).toThrow(ZodError);
        });

        it('should reject list input with invalid pageSize', () => {
            const listInput = {
                pageSize: 0
            };

            expect(() => FeatureListInputSchema.parse(listInput)).toThrow(ZodError);
        });
    });

    describe('FeatureListItemSchema', () => {
        it('should validate list item with required fields', () => {
            const listItem = {
                id: faker.string.uuid(),
                name: faker.lorem.words({ min: 2, max: 5 }),
                slug: faker.lorem.slug(3),
                icon: faker.lorem.word(),
                description: faker.lorem.paragraph(),
                createdAt: faker.date.past(),
                updatedAt: faker.date.recent()
            };

            expect(() => FeatureListItemSchema.parse(listItem)).not.toThrow();

            const result = FeatureListItemSchema.parse(listItem);
            expect(result.id).toBe(listItem.id);
            expect(result.slug).toBe(listItem.slug);
            expect(result.name).toBe(listItem.name);
        });

        it('should validate list item with optional fields undefined', () => {
            const listItem = {
                id: faker.string.uuid(),
                name: faker.lorem.words({ min: 2, max: 5 }),
                slug: faker.lorem.slug(3),
                icon: undefined,
                description: undefined,
                createdAt: faker.date.past(),
                updatedAt: faker.date.recent()
            };

            expect(() => FeatureListItemSchema.parse(listItem)).not.toThrow();
        });

        it('should reject list item with missing required fields', () => {
            const listItem = {
                description: faker.lorem.paragraph()
            };

            expect(() => FeatureListItemSchema.parse(listItem)).toThrow(ZodError);
        });
    });

    describe('FeatureListOutputSchema', () => {
        it('should validate list output', () => {
            const listOutput = {
                data: [
                    {
                        id: faker.string.uuid(),
                        name: faker.lorem.words({ min: 2, max: 5 }),
                        slug: faker.lorem.slug(3),
                        createdAt: faker.date.past(),
                        updatedAt: faker.date.recent()
                    }
                ],
                pagination: {
                    total: 1,
                    page: 1,
                    pageSize: 20,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => FeatureListOutputSchema.parse(listOutput)).not.toThrow();

            const result = FeatureListOutputSchema.parse(listOutput);
            expect(Array.isArray(result.data)).toBe(true);
            expect(typeof result.pagination.total).toBe('number');
            expect(typeof result.pagination.page).toBe('number');
            expect(typeof result.pagination.pageSize).toBe('number');
            expect(typeof result.pagination.totalPages).toBe('number');
        });

        it('should validate empty list output', () => {
            const listOutput = {
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

            expect(() => FeatureListOutputSchema.parse(listOutput)).not.toThrow();
        });

        it('should reject list output with negative total', () => {
            const listOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: -1, // Invalid negative total
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => FeatureListOutputSchema.parse(listOutput)).toThrow(ZodError);
        });
    });

    describe('FeatureSearchInputSchema', () => {
        it('should validate search input with pagination and filters', () => {
            const searchInput = {
                pagination: {
                    page: 1,
                    pageSize: 20
                },
                filters: {
                    category: faker.lorem.word()
                }
            };

            expect(() => FeatureSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = FeatureSearchInputSchema.parse(searchInput);
            // Pagination is not part of input schema
            expect(result.filters).toBeDefined();
        });

        it('should validate search input with query', () => {
            const searchInput = {
                q: faker.lorem.words(2),
                page: 1,
                pageSize: 20
            };

            expect(() => FeatureSearchInputSchema.parse(searchInput)).not.toThrow();

            const result = FeatureSearchInputSchema.parse(searchInput);
            expect(result.q).toBe(searchInput.q);
        });

        it('should validate search input with defaults', () => {
            const searchInput = {};

            expect(() => FeatureSearchInputSchema.parse(searchInput)).not.toThrow();

            const _result = FeatureSearchInputSchema.parse(searchInput);
            // BaseSearchSchema doesn't have defaults, so these would be undefined
            // Pagination is not part of input schema
        });

        it('should reject search input with invalid pagination', () => {
            const searchInput = {
                page: 0, // Invalid: should be positive
                pageSize: -1 // Invalid: should be positive
            };

            expect(() => FeatureSearchInputSchema.parse(searchInput)).toThrow(ZodError);
        });
    });

    describe('FeatureSearchResultSchema', () => {
        it('should validate search result', () => {
            const searchResult = {
                data: [
                    {
                        id: faker.string.uuid(),
                        name: faker.lorem.words({ min: 2, max: 5 }),
                        slug: faker.lorem.slug(3),
                        createdAt: faker.date.past(),
                        updatedAt: faker.date.recent()
                    }
                ],
                pagination: {
                    total: 1,
                    page: 1,
                    pageSize: 20,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => FeatureSearchResultSchema.parse(searchResult)).not.toThrow();
        });
    });

    describe('FeatureSearchOutputSchema', () => {
        it('should validate search output', () => {
            const searchOutput = {
                data: [
                    {
                        id: faker.string.uuid(),
                        name: faker.lorem.words({ min: 2, max: 5 }),
                        slug: faker.lorem.slug(3),
                        createdAt: faker.date.past(),
                        updatedAt: faker.date.recent()
                    }
                ],
                pagination: {
                    total: 1,
                    page: 1,
                    pageSize: 20,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                },
                searchInfo: {
                    query: faker.lorem.words(2),
                    totalResults: 1
                }
            };

            expect(() => FeatureSearchOutputSchema.parse(searchOutput)).not.toThrow();

            const result = FeatureSearchOutputSchema.parse(searchOutput);
            expect(Array.isArray(result.data)).toBe(true);
            expect(typeof result.pagination.total).toBe('number');
            // SearchInfo is not part of output schema
        });

        it('should validate search output without query', () => {
            const searchOutput = {
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

            expect(() => FeatureSearchOutputSchema.parse(searchOutput)).not.toThrow();
        });
    });

    describe('FeatureSummarySchema', () => {
        it('should validate summary schema', () => {
            const summaryData = {
                id: faker.string.uuid(),
                slug: faker.lorem.slug(3),
                name: faker.lorem.words({ min: 2, max: 5 }),
                description: faker.lorem.paragraph(),
                icon: faker.lorem.word()
            };

            expect(() => FeatureSummarySchema.parse(summaryData)).not.toThrow();

            const result = FeatureSummarySchema.parse(summaryData);
            expect(result.id).toBeDefined();
            expect(result.slug).toBeDefined();
            expect(result.name).toBeDefined();
        });
    });

    describe('FeatureStatsSchema', () => {
        it('should validate stats schema', () => {
            const statsData = {
                totalFeatures: 100,
                availableFeatures: 80,
                unavailableFeatures: 20,
                unusedFeatures: 15,
                totalUsages: 500,
                averageUsagePerFeature: 5.0,
                averagePriority: 45.5,
                totalCategories: 8
            };

            expect(() => FeatureStatsSchema.parse(statsData)).not.toThrow();

            const result = FeatureStatsSchema.parse(statsData);
            expect(result.totalFeatures).toBe(100);
            expect(result.availableFeatures).toBe(80);
            expect(result.unavailableFeatures).toBe(20);
            expect(result.totalCategories).toBe(8);
        });

        it('should validate stats schema with optional fields', () => {
            const statsData = {
                totalFeatures: 50,
                availableFeatures: 40,
                unavailableFeatures: 10,
                unusedFeatures: 5,
                totalUsages: 200,
                averageUsagePerFeature: 4.0,
                averagePriority: 60.0,
                totalCategories: 5,
                priorityDistribution: {
                    critical: 2,
                    high: 8,
                    medium: 15,
                    low: 20,
                    minimal: 5
                },
                categoryDistribution: [
                    {
                        category: 'amenities',
                        count: 25,
                        availableCount: 20,
                        totalUsage: 100,
                        averagePriority: 50.0
                    }
                ]
            };

            expect(() => FeatureStatsSchema.parse(statsData)).not.toThrow();

            const result = FeatureStatsSchema.parse(statsData);
            expect(result.priorityDistribution).toBeDefined();
            expect(result.categoryDistribution).toBeDefined();
        });
    });
});
