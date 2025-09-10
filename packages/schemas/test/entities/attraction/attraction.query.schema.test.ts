import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AttractionCountOutputSchema,
    AttractionFiltersSchema,
    AttractionListInputSchema,
    AttractionListOutputSchema,
    AttractionListWithCountsOutputSchema,
    AttractionSearchInputSchema,
    AttractionSearchOutputSchema,
    AttractionStatsOutputSchema,
    AttractionWithDestinationCountSchema,
    AttractionsByDestinationInputSchema,
    AttractionsByDestinationOutputSchema,
    DestinationsByAttractionInputSchema
} from '../../../src/entities/attraction/attraction.query.schema.js';
import {
    createAttractionWithDestinationCount,
    createValidAttraction
} from '../../fixtures/attraction.fixtures.js';

describe('Attraction Query Schemas', () => {
    describe('AttractionFiltersSchema', () => {
        it('should validate valid filters', () => {
            const validFilters = {
                name: 'Test Attraction',
                slug: 'test-attraction',
                isFeatured: true,
                isBuiltin: false,
                destinationId: faker.string.uuid(),
                lifecycleState: 'ACTIVE',
                q: 'search query'
            };

            expect(() => AttractionFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should allow empty filters', () => {
            const emptyFilters = {};

            expect(() => AttractionFiltersSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should allow partial filters', () => {
            const partialFilters = {
                name: 'Test',
                isFeatured: true
            };

            expect(() => AttractionFiltersSchema.parse(partialFilters)).not.toThrow();
        });

        it('should validate destinationId format', () => {
            const invalidFilters = {
                destinationId: 'invalid-uuid'
            };

            expect(() => AttractionFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });

        it('should validate boolean fields', () => {
            const invalidFilters = {
                isFeatured: 'not-boolean'
            };

            expect(() => AttractionFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });

        it('should validate search query minimum length', () => {
            const invalidFilters = {
                q: '' // Empty string not allowed
            };

            expect(() => AttractionFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });

        it('should allow valid lifecycle states', () => {
            const validStates = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

            for (const state of validStates) {
                const filters = { lifecycleState: state };
                expect(() => AttractionFiltersSchema.parse(filters)).not.toThrow();
            }
        });
    });

    describe('AttractionSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const validInput = {
                filters: {
                    name: 'Test',
                    isFeatured: true
                },
                pagination: {
                    page: 1,
                    pageSize: 20
                },
                sort: [
                    {
                        field: 'name',
                        direction: 'ASC'
                    }
                ]
            };

            expect(() => AttractionSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow search without filters', () => {
            const inputWithoutFilters = {
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => AttractionSearchInputSchema.parse(inputWithoutFilters)).not.toThrow();
        });

        it('should allow search without pagination', () => {
            const inputWithoutPagination = {
                filters: {
                    name: 'Test'
                }
            };

            expect(() => AttractionSearchInputSchema.parse(inputWithoutPagination)).not.toThrow();
        });

        it('should allow empty search input', () => {
            const emptyInput = {};

            expect(() => AttractionSearchInputSchema.parse(emptyInput)).not.toThrow();
        });
    });

    describe('AttractionListInputSchema', () => {
        it('should validate valid list input', () => {
            const validInput = {
                pagination: {
                    page: 1,
                    pageSize: 20
                }
            };

            expect(() => AttractionListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow list without pagination', () => {
            const inputWithoutPagination = {};

            expect(() => AttractionListInputSchema.parse(inputWithoutPagination)).not.toThrow();
        });
    });

    describe('AttractionsByDestinationInputSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                destinationId: faker.string.uuid(),
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => AttractionsByDestinationInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require destinationId', () => {
            const invalidInput = {
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => AttractionsByDestinationInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate destinationId format', () => {
            const invalidInput = {
                destinationId: 'invalid-uuid'
            };

            expect(() => AttractionsByDestinationInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should allow without pagination', () => {
            const validInput = {
                destinationId: faker.string.uuid()
            };

            expect(() => AttractionsByDestinationInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('DestinationsByAttractionInputSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                attractionId: faker.string.uuid(),
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => DestinationsByAttractionInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require attractionId', () => {
            const invalidInput = {
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };

            expect(() => DestinationsByAttractionInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate attractionId format', () => {
            const invalidInput = {
                attractionId: 'invalid-uuid'
            };

            expect(() => DestinationsByAttractionInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('Output Schemas', () => {
        describe('AttractionSearchOutputSchema', () => {
            it('should validate valid search output', () => {
                const validOutput = {
                    items: [createValidAttraction(), createValidAttraction()],
                    total: 2,
                    page: 1,
                    pageSize: 20,
                    totalPages: 1
                };

                expect(() => AttractionSearchOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should require items and total', () => {
                const invalidOutput = {
                    page: 1
                };

                expect(() => AttractionSearchOutputSchema.parse(invalidOutput)).toThrow(ZodError);
            });

            it('should allow optional pagination fields', () => {
                const minimalOutput = {
                    items: [createValidAttraction()],
                    total: 1
                };

                expect(() => AttractionSearchOutputSchema.parse(minimalOutput)).not.toThrow();
            });

            it('should validate total is non-negative', () => {
                const invalidOutput = {
                    items: [],
                    total: -1
                };

                expect(() => AttractionSearchOutputSchema.parse(invalidOutput)).toThrow(ZodError);
            });
        });

        describe('AttractionListOutputSchema', () => {
            it('should validate valid list output', () => {
                const validOutput = {
                    items: [createValidAttraction(), createValidAttraction()],
                    total: 2
                };

                expect(() => AttractionListOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should allow empty items array', () => {
                const emptyOutput = {
                    items: [],
                    total: 0
                };

                expect(() => AttractionListOutputSchema.parse(emptyOutput)).not.toThrow();
            });
        });

        describe('AttractionWithDestinationCountSchema', () => {
            it('should validate attraction with destination count', () => {
                const validData = createAttractionWithDestinationCount();

                expect(() => AttractionWithDestinationCountSchema.parse(validData)).not.toThrow();
            });

            it('should allow optional destination count', () => {
                const dataWithoutCount = {
                    ...createValidAttraction(),
                    destinationCount: undefined
                };

                expect(() =>
                    AttractionWithDestinationCountSchema.parse(dataWithoutCount)
                ).not.toThrow();
            });

            it('should validate destination count is non-negative', () => {
                const invalidData = {
                    ...createValidAttraction(),
                    destinationCount: -1
                };

                expect(() => AttractionWithDestinationCountSchema.parse(invalidData)).toThrow(
                    ZodError
                );
            });
        });

        describe('AttractionListWithCountsOutputSchema', () => {
            it('should validate valid list with counts output', () => {
                const validOutput = {
                    items: [
                        createAttractionWithDestinationCount(),
                        createAttractionWithDestinationCount()
                    ],
                    total: 2
                };

                expect(() => AttractionListWithCountsOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('AttractionsByDestinationOutputSchema', () => {
            it('should validate valid attractions by destination output', () => {
                const validOutput = {
                    attractions: [createValidAttraction(), createValidAttraction()]
                };

                expect(() => AttractionsByDestinationOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should allow empty attractions array', () => {
                const emptyOutput = {
                    attractions: []
                };

                expect(() => AttractionsByDestinationOutputSchema.parse(emptyOutput)).not.toThrow();
            });
        });

        describe('AttractionCountOutputSchema', () => {
            it('should validate valid count output', () => {
                const validOutput = {
                    count: 42
                };

                expect(() => AttractionCountOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should validate count is non-negative', () => {
                const invalidOutput = {
                    count: -1
                };

                expect(() => AttractionCountOutputSchema.parse(invalidOutput)).toThrow(ZodError);
            });

            it('should allow zero count', () => {
                const zeroOutput = {
                    count: 0
                };

                expect(() => AttractionCountOutputSchema.parse(zeroOutput)).not.toThrow();
            });
        });

        describe('AttractionStatsOutputSchema', () => {
            it('should validate valid stats output', () => {
                const validOutput = {
                    stats: {
                        total: 100,
                        featured: 25,
                        builtin: 10,
                        byDestination: {
                            'destination-1': 50,
                            'destination-2': 30
                        }
                    }
                };

                expect(() => AttractionStatsOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should allow null stats', () => {
                const nullOutput = {
                    stats: null
                };

                expect(() => AttractionStatsOutputSchema.parse(nullOutput)).not.toThrow();
            });

            it('should allow stats without byDestination', () => {
                const minimalStats = {
                    stats: {
                        total: 100,
                        featured: 25,
                        builtin: 10
                    }
                };

                expect(() => AttractionStatsOutputSchema.parse(minimalStats)).not.toThrow();
            });

            it('should validate stats numbers are non-negative', () => {
                const invalidStats = {
                    stats: {
                        total: -1,
                        featured: 25,
                        builtin: 10
                    }
                };

                expect(() => AttractionStatsOutputSchema.parse(invalidStats)).toThrow(ZodError);
            });
        });
    });

    describe('Schema Integration', () => {
        it('should work with complete query flow', () => {
            // Search input
            const searchInput = {
                filters: {
                    name: 'Beach',
                    isFeatured: true
                },
                pagination: {
                    page: 1,
                    pageSize: 10
                }
            };
            const parsedSearchInput = AttractionSearchInputSchema.parse(searchInput);
            expect(parsedSearchInput).toBeDefined();

            // Search output
            const searchOutput = {
                items: [createValidAttraction()],
                total: 1,
                page: 1,
                pageSize: 10,
                totalPages: 1
            };
            const parsedSearchOutput = AttractionSearchOutputSchema.parse(searchOutput);
            expect(parsedSearchOutput).toBeDefined();

            // List with counts
            const listWithCounts = {
                items: [createAttractionWithDestinationCount()],
                total: 1
            };
            const parsedListWithCounts = AttractionListWithCountsOutputSchema.parse(listWithCounts);
            expect(parsedListWithCounts).toBeDefined();
        });
    });
});
