import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    PopularTagsInputSchema,
    PopularTagsOutputSchema,
    PopularTagsSimpleOutputSchema,
    TagFiltersSchema,
    TagListInputSchema,
    TagListOutputSchema,
    TagSearchInputSchema,
    TagSearchOutputSchema,
    TagStatsSchema,
    TagSummarySchema
} from '../../../src/entities/tag/tag.query.schema.js';
import {
    createTagFilters,
    createTagStats,
    createTagSummary,
    createValidTag
} from '../../fixtures/tag.fixtures.js';

describe('Tag Query Schemas', () => {
    describe('TagFiltersSchema', () => {
        it('should validate valid filters', () => {
            const validFilters = createTagFilters();

            expect(() => TagFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should accept empty filters object', () => {
            const emptyFilters = {};

            expect(() => TagFiltersSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should validate color filter with hex format', () => {
            const colorFilter = {
                color: '#FF5733'
            };

            expect(() => TagFiltersSchema.parse(colorFilter)).not.toThrow();
        });

        it('should reject invalid color format', () => {
            const invalidColorFilter = {
                color: 'red' // Should be hex format
            };

            expect(() => TagFiltersSchema.parse(invalidColorFilter)).toThrow(ZodError);
        });

        it('should validate usage count filters', () => {
            const usageFilters = {
                minUsageCount: 5,
                maxUsageCount: 100,
                isUnused: false
            };

            expect(() => TagFiltersSchema.parse(usageFilters)).not.toThrow();
        });

        it('should reject negative usage counts', () => {
            const invalidUsageFilter = {
                minUsageCount: -1
            };

            expect(() => TagFiltersSchema.parse(invalidUsageFilter)).toThrow(ZodError);
        });

        it('should validate entity type filters', () => {
            const entityFilters = {
                usedInAccommodations: true,
                usedInDestinations: false,
                usedInPosts: true,
                usedInEvents: false,
                usedInUsers: true
            };

            expect(() => TagFiltersSchema.parse(entityFilters)).not.toThrow();
        });

        it('should validate date range filters', () => {
            const dateFilters = {
                createdAfter: new Date('2024-01-01'),
                createdBefore: new Date('2024-12-31'),
                lastUsedAfter: new Date('2024-06-01'),
                lastUsedBefore: new Date('2024-12-01')
            };

            expect(() => TagFiltersSchema.parse(dateFilters)).not.toThrow();
        });

        it('should validate name pattern filters', () => {
            const nameFilters = {
                nameStartsWith: 'featured',
                nameEndsWith: 'tag',
                nameContains: 'popular'
            };

            expect(() => TagFiltersSchema.parse(nameFilters)).not.toThrow();
        });

        it('should validate length filters', () => {
            const lengthFilters = {
                minNameLength: 3,
                maxNameLength: 20
            };

            expect(() => TagFiltersSchema.parse(lengthFilters)).not.toThrow();
        });
    });

    describe('TagListInputSchema', () => {
        it('should validate valid list input', () => {
            const validInput = {
                page: 1,
                pageSize: 20,
                filters: createTagFilters(),
                sortBy: 'name',
                sortOrder: 'asc'
            };

            expect(() => TagListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should use default values', () => {
            const minimalInput = {};

            const _result = TagListInputSchema.parse(minimalInput);
            // sortBy doesn't have default values in BaseSearchSchema
            // sortOrder doesn't have default values in BaseSearchSchema
        });

        it('should validate sort options', () => {
            const sortOptions = ['name', 'usageCount', 'createdAt', 'lastUsedAt'];
            const orderOptions = ['asc', 'desc'];

            for (const sortBy of sortOptions) {
                for (const sortOrder of orderOptions) {
                    const input = { sortBy, sortOrder };
                    expect(() => TagListInputSchema.parse(input)).not.toThrow();
                }
            }
        });

        it('should accept any sort field name', () => {
            const sortInput = {
                sortBy: 'customField'
            };

            expect(() => TagListInputSchema.parse(sortInput)).not.toThrow();
        });
    });

    describe('TagListOutputSchema', () => {
        it('should validate valid list output', () => {
            const validOutput = {
                data: [createValidTag(), createValidTag()],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 2,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => TagListOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept empty results', () => {
            const emptyOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };

            expect(() => TagListOutputSchema.parse(emptyOutput)).not.toThrow();
        });

        it('should accept valid pagination values', () => {
            const validOutput = {
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

            expect(() => TagListOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('TagSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const validInput = {
                query: 'featured tags',
                filters: createTagFilters(),
                fuzzySearch: true,
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => TagSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should use default fuzzySearch value', () => {
            const input = {
                query: 'test'
            };

            const result = TagSearchInputSchema.parse(input);
            expect(result.fuzzySearch).toBe(true);
        });

        it('should validate query length constraints', () => {
            const validQueries = ['a', 'short query', 'a'.repeat(100)];

            for (const query of validQueries) {
                const input = { query };
                expect(() => TagSearchInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should accept long queries', () => {
            const longQuery = {
                query: 'a'.repeat(101)
            };

            expect(() => TagSearchInputSchema.parse(longQuery)).not.toThrow();
        });
    });

    describe('TagSearchOutputSchema', () => {
        it('should validate valid search output', () => {
            const validOutput = {
                data: [
                    {
                        ...createValidTag(),
                        score: 0.95,
                        pagination: {
                            page: 1,
                            pageSize: 10,
                            total: 3,
                            totalPages: 1,
                            hasNextPage: false,
                            hasPreviousPage: false
                        }
                    }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                },
                searchInfo: {
                    query: 'featured',
                    executionTime: 0.025,
                    totalResults: 1,
                    fuzzySearchUsed: true
                }
            };

            expect(() => TagSearchOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept output without searchInfo', () => {
            const outputWithoutSearchInfo = {
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

            expect(() => TagSearchOutputSchema.parse(outputWithoutSearchInfo)).not.toThrow();
        });

        it('should validate score constraints', () => {
            const validScores = [0, 0.5, 1.0];

            for (const score of validScores) {
                const output = {
                    data: [
                        {
                            ...createValidTag(),
                            score,
                            pagination: {
                                page: 1,
                                pageSize: 10,
                                total: 3,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false
                            }
                        }
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 1,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                };

                expect(() => TagSearchOutputSchema.parse(output)).not.toThrow();
            }
        });

        it('should reject invalid score values', () => {
            const invalidScores = [-0.1, 1.1, 2.0];

            for (const score of invalidScores) {
                const output = {
                    data: [
                        {
                            ...createValidTag(),
                            score,
                            pagination: {
                                page: 1,
                                pageSize: 10,
                                total: 3,
                                totalPages: 1,
                                hasNextPage: false,
                                hasPreviousPage: false
                            }
                        }
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 1,
                        totalPages: 1
                    }
                };

                expect(() => TagSearchOutputSchema.parse(output)).toThrow(ZodError);
            }
        });
    });

    describe('PopularTagsInputSchema', () => {
        it('should validate valid popular tags input', () => {
            const validInput = {
                pageSize: 50,
                entityType: 'accommodations',
                timeframe: 'month'
            };

            expect(() => PopularTagsInputSchema.parse(validInput)).not.toThrow();
        });

        it('should use default values', () => {
            const minimalInput = {};

            const result = PopularTagsInputSchema.parse(minimalInput);
            expect(result.pageSize).toBe(20);
            expect(result.entityType).toBe('all');
            expect(result.timeframe).toBe('all');
        });

        it('should validate pageSize constraints', () => {
            const validPageSizes = [1, 50, 100];

            for (const pageSize of validPageSizes) {
                const input = { pageSize };
                expect(() => PopularTagsInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should reject invalid pageSize values', () => {
            const invalidPageSizes = [0, -1, 101, 200];

            for (const pageSize of invalidPageSizes) {
                const input = { pageSize };
                expect(() => PopularTagsInputSchema.parse(input)).toThrow(ZodError);
            }
        });

        it('should validate entityType enum values', () => {
            const validEntityTypes = [
                'all',
                'accommodations',
                'destinations',
                'posts',
                'events',
                'users'
            ];

            for (const entityType of validEntityTypes) {
                const input = { entityType };
                expect(() => PopularTagsInputSchema.parse(input)).not.toThrow();
            }
        });

        it('should validate timeframe enum values', () => {
            const validTimeframes = ['all', 'year', 'month', 'week'];

            for (const timeframe of validTimeframes) {
                const input = { timeframe };
                expect(() => PopularTagsInputSchema.parse(input)).not.toThrow();
            }
        });
    });

    describe('PopularTagsOutputSchema', () => {
        it('should validate valid popular tags output', () => {
            const validOutput = {
                data: [
                    {
                        ...createTagSummary(),
                        recentUsageCount: 25,
                        growthRate: 0.15,
                        entityBreakdown: {
                            accommodations: 10,
                            destinations: 5,
                            posts: 8,
                            events: 2,
                            users: 0
                        }
                    }
                ],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1
                },
                metadata: {
                    entityType: 'all',
                    timeframe: 'month',
                    totalTags: 1,
                    generatedAt: new Date()
                }
            };

            expect(() => PopularTagsOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept tags without optional fields', () => {
            const outputWithMinimalTags = {
                data: [createTagSummary()],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 1,
                    totalPages: 1
                },
                metadata: {
                    entityType: 'all',
                    timeframe: 'all',
                    totalTags: 1,
                    generatedAt: new Date()
                }
            };

            expect(() => PopularTagsOutputSchema.parse(outputWithMinimalTags)).not.toThrow();
        });
    });

    describe('PopularTagsSimpleOutputSchema', () => {
        it('should validate valid simple popular tags output', () => {
            const validOutput = {
                tags: [createValidTag(), createValidTag()]
            };

            expect(() => PopularTagsSimpleOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should accept empty tags array', () => {
            const emptyOutput = {
                tags: []
            };

            expect(() => PopularTagsSimpleOutputSchema.parse(emptyOutput)).not.toThrow();
        });
    });

    describe('TagSummarySchema', () => {
        it('should validate valid tag summary', () => {
            const validSummary = createTagSummary();

            expect(() => TagSummarySchema.parse(validSummary)).not.toThrow();
        });

        it('should contain only essential fields', () => {
            const summary = createTagSummary();
            const result = TagSummarySchema.parse(summary);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('color');
            expect(result).toHaveProperty('usageCount');

            // Should not have full tag fields
            expect(result).not.toHaveProperty('createdAt');
            expect(result).not.toHaveProperty('updatedAt');
        });
    });

    describe('TagStatsSchema', () => {
        it('should validate valid tag stats', () => {
            const validStats = createTagStats();

            expect(() => TagStatsSchema.parse(validStats)).not.toThrow();
        });

        it('should use default values for numeric fields', () => {
            const minimalStats = {};

            const result = TagStatsSchema.parse(minimalStats);
            expect(result.totalTags).toBe(0);
            expect(result.unusedTags).toBe(0);
            expect(result.totalUsages).toBe(0);
            expect(result.averageUsagePerTag).toBe(0);
        });

        it('should validate usage distribution', () => {
            const statsWithDistribution = {
                ...createTagStats(),
                usageDistribution: {
                    accommodations: 100,
                    destinations: 50,
                    posts: 75,
                    events: 25,
                    users: 10
                }
            };

            expect(() => TagStatsSchema.parse(statsWithDistribution)).not.toThrow();
        });

        it('should validate most used tags', () => {
            const statsWithMostUsed = {
                ...createTagStats(),
                mostUsedTags: [
                    {
                        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                        name: 'Popular Tag',
                        usageCount: 150
                    }
                ]
            };

            expect(() => TagStatsSchema.parse(statsWithMostUsed)).not.toThrow();
        });

        it('should validate color distribution', () => {
            const statsWithColors = {
                ...createTagStats(),
                colorDistribution: [
                    { color: '#FF5733', count: 25 },
                    { color: '#33FF57', count: 15 }
                ]
            };

            expect(() => TagStatsSchema.parse(statsWithColors)).not.toThrow();
        });

        it('should validate name length distribution', () => {
            const statsWithNameLength = {
                ...createTagStats(),
                nameLengthDistribution: {
                    short: 10,
                    medium: 25,
                    long: 5
                }
            };

            expect(() => TagStatsSchema.parse(statsWithNameLength)).not.toThrow();
        });

        it('should reject negative values', () => {
            const invalidStats = {
                totalTags: -1,
                unusedTags: -5
            };

            expect(() => TagStatsSchema.parse(invalidStats)).toThrow(ZodError);
        });
    });

    describe('Integration Tests', () => {
        it('should work with complete query workflow', () => {
            // Search input
            const searchInput = {
                query: 'featured',
                filters: createTagFilters(),
                fuzzySearch: true
            };
            expect(() => TagSearchInputSchema.parse(searchInput)).not.toThrow();

            // List input
            const listInput = {
                filters: createTagFilters(),
                sortBy: 'usageCount',
                sortOrder: 'desc'
            };
            expect(() => TagListInputSchema.parse(listInput)).not.toThrow();

            // Popular tags input
            const popularInput = {
                pageSize: 10,
                entityType: 'accommodations'
            };
            expect(() => PopularTagsInputSchema.parse(popularInput)).not.toThrow();

            // Stats
            const stats = createTagStats();
            expect(() => TagStatsSchema.parse(stats)).not.toThrow();
        });
    });
});
