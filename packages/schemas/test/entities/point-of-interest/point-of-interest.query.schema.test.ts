import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DestinationIdsByPointOfInterestSlugsSchema,
    DestinationsByPointOfInterestInputSchema,
    HttpPointOfInterestSearchSchema,
    PointOfInterestCountOutputSchema,
    PointOfInterestFiltersSchema,
    PointOfInterestListInputSchema,
    PointOfInterestListOutputSchema,
    PointOfInterestListWithCountsOutputSchema,
    PointOfInterestSearchInputSchema,
    PointOfInterestSearchOutputSchema,
    PointOfInterestStatsOutputSchema,
    PointOfInterestWithDestinationCountSchema,
    PointsOfInterestByDestinationInputSchema
} from '../../../src/entities/point-of-interest/point-of-interest.query.schema.js';
import { PointOfInterestTypeEnum } from '../../../src/enums/point-of-interest-type.enum.js';
import {
    createPointOfInterestWithDestinationCount,
    createValidPointOfInterest
} from '../../fixtures/point-of-interest.fixtures.js';
import { createPaginatedResponse } from '../../helpers/pagination.helpers.js';

describe('Point Of Interest Query Schemas', () => {
    describe('PointOfInterestFiltersSchema', () => {
        it('should validate valid filters', () => {
            const validFilters = {
                slug: 'test-poi',
                type: PointOfInterestTypeEnum.BEACH,
                isFeatured: true,
                isBuiltin: false,
                destinationId: faker.string.uuid(),
                lifecycleState: 'ACTIVE',
                q: 'search query'
            };

            expect(() => PointOfInterestFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should allow empty filters', () => {
            expect(() => PointOfInterestFiltersSchema.parse({})).not.toThrow();
        });

        it('should validate destinationId format', () => {
            const invalidFilters = { destinationId: 'invalid-uuid' };

            expect(() => PointOfInterestFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });

        it('should reject an invalid type value', () => {
            const invalidFilters = { type: 'WATERFALL' };

            expect(() => PointOfInterestFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });

        it('should validate boolean fields', () => {
            const invalidFilters = { isFeatured: 'not-boolean' };

            expect(() => PointOfInterestFiltersSchema.parse(invalidFilters)).toThrow(ZodError);
        });
    });

    describe('PointOfInterestSearchInputSchema', () => {
        it('should validate valid search input', () => {
            const validInput = {
                page: 1,
                pageSize: 20,
                type: PointOfInterestTypeEnum.MUSEUM,
                isFeatured: true
            };

            expect(() => PointOfInterestSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow empty search input (defaults apply)', () => {
            const result = PointOfInterestSearchInputSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);
        });
    });

    describe('PointOfInterestListInputSchema', () => {
        it('should validate valid list input', () => {
            const validInput = { page: 1, pageSize: 20 };

            expect(() => PointOfInterestListInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('PointsOfInterestByDestinationInputSchema', () => {
        it('should validate valid input', () => {
            const validInput = {
                destinationId: faker.string.uuid(),
                page: 1,
                pageSize: 10
            };

            expect(() => PointsOfInterestByDestinationInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require destinationId', () => {
            expect(() =>
                PointsOfInterestByDestinationInputSchema.parse({ page: 1, pageSize: 10 })
            ).toThrow(ZodError);
        });

        it('should validate destinationId format', () => {
            expect(() =>
                PointsOfInterestByDestinationInputSchema.parse({ destinationId: 'invalid-uuid' })
            ).toThrow(ZodError);
        });
    });

    describe('DestinationsByPointOfInterestInputSchema', () => {
        it('should validate valid input', () => {
            const validInput = { pointOfInterestId: faker.string.uuid(), page: 1, pageSize: 10 };

            expect(() => DestinationsByPointOfInterestInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require pointOfInterestId', () => {
            expect(() =>
                DestinationsByPointOfInterestInputSchema.parse({ page: 1, pageSize: 10 })
            ).toThrow(ZodError);
        });
    });

    describe('DestinationIdsByPointOfInterestSlugsSchema', () => {
        it('should validate a valid slugs array', () => {
            const validInput = { slugs: ['autodromo-ciudad', 'playa-banco-pelay'] };

            expect(() =>
                DestinationIdsByPointOfInterestSlugsSchema.parse(validInput)
            ).not.toThrow();
        });

        it('should reject an empty slugs array (min length 1)', () => {
            expect(() => DestinationIdsByPointOfInterestSlugsSchema.parse({ slugs: [] })).toThrow(
                ZodError
            );
        });

        it('should require the slugs field', () => {
            expect(() => DestinationIdsByPointOfInterestSlugsSchema.parse({})).toThrow(ZodError);
        });

        it('should accept a single-slug array', () => {
            const result = DestinationIdsByPointOfInterestSlugsSchema.parse({
                slugs: ['autodromo-ciudad']
            });
            expect(result.slugs).toEqual(['autodromo-ciudad']);
        });
    });

    describe('Output Schemas', () => {
        describe('PointOfInterestSearchOutputSchema', () => {
            it('should validate valid search output', () => {
                const validOutput = createPaginatedResponse([
                    createValidPointOfInterest(),
                    createValidPointOfInterest()
                ]);

                expect(() => PointOfInterestSearchOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('PointOfInterestListOutputSchema', () => {
            it('should allow empty items array', () => {
                const emptyOutput = createPaginatedResponse([]);

                expect(() => PointOfInterestListOutputSchema.parse(emptyOutput)).not.toThrow();
            });
        });

        describe('PointOfInterestWithDestinationCountSchema', () => {
            it('should validate point of interest with destination count', () => {
                const validData = createPointOfInterestWithDestinationCount();

                expect(() =>
                    PointOfInterestWithDestinationCountSchema.parse(validData)
                ).not.toThrow();
            });

            it('should validate destination count is non-negative', () => {
                const invalidData = { ...createValidPointOfInterest(), destinationCount: -1 };

                expect(() => PointOfInterestWithDestinationCountSchema.parse(invalidData)).toThrow(
                    ZodError
                );
            });
        });

        describe('PointOfInterestListWithCountsOutputSchema', () => {
            it('should validate valid list with counts output', () => {
                const validOutput = createPaginatedResponse([
                    createPointOfInterestWithDestinationCount()
                ]);

                expect(() =>
                    PointOfInterestListWithCountsOutputSchema.parse(validOutput)
                ).not.toThrow();
            });
        });

        describe('PointOfInterestCountOutputSchema', () => {
            it('should validate valid count output', () => {
                expect(() => PointOfInterestCountOutputSchema.parse({ count: 42 })).not.toThrow();
            });

            it('should validate count is non-negative', () => {
                expect(() => PointOfInterestCountOutputSchema.parse({ count: -1 })).toThrow(
                    ZodError
                );
            });
        });

        describe('PointOfInterestStatsOutputSchema', () => {
            it('should validate valid stats output', () => {
                const validOutput = {
                    stats: {
                        total: 12,
                        featured: 3,
                        builtin: 12,
                        byType: { BEACH: 2, STADIUM: 1 }
                    }
                };

                expect(() => PointOfInterestStatsOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should allow null stats', () => {
                expect(() => PointOfInterestStatsOutputSchema.parse({ stats: null })).not.toThrow();
            });
        });
    });

    describe('HttpPointOfInterestSearchSchema', () => {
        it('should accept an empty object with defaults', () => {
            const result = HttpPointOfInterestSearchSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should coerce isFeatured from string "true" to boolean', () => {
            const result = HttpPointOfInterestSearchSchema.safeParse({ isFeatured: 'true' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isFeatured).toBe(true);
            }
        });

        it('should accept a valid type filter', () => {
            const result = HttpPointOfInterestSearchSchema.safeParse({ type: 'MUSEUM' });
            expect(result.success).toBe(true);
        });

        it('should reject an invalid type filter', () => {
            const result = HttpPointOfInterestSearchSchema.safeParse({ type: 'NOT_A_TYPE' });
            expect(result.success).toBe(false);
        });
    });
});
