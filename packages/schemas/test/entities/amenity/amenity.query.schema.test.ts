import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AmenityAccommodationsOutputSchema,
    AmenityArrayOutputSchema,
    AmenityFiltersSchema,
    AmenityGetAccommodationsInputSchema,
    AmenityGetForAccommodationInputSchema,
    AmenityListInputSchema,
    AmenityListWithUsageCountSchema,
    AmenitySearchForListOutputSchema,
    AmenitySearchInputSchema
} from '../../../src/entities/amenity/amenity.query.schema.js';
import { createValidAmenity } from '../../fixtures/amenity.fixtures.js';

describe('Amenity Query Schemas', () => {
    describe('AmenityGetAccommodationsInputSchema', () => {
        it('should validate valid amenity ID input', () => {
            const validInput = {
                amenityId: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => AmenityGetAccommodationsInputSchema.parse(validInput)).not.toThrow();
            const result = AmenityGetAccommodationsInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should reject invalid UUID', () => {
            const invalidInput = {
                amenityId: 'invalid-uuid'
            };

            expect(() => AmenityGetAccommodationsInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject missing amenityId', () => {
            const emptyInput = {};

            expect(() => AmenityGetAccommodationsInputSchema.parse(emptyInput)).toThrow(ZodError);
        });
    });

    describe('AmenityGetForAccommodationInputSchema', () => {
        it('should validate valid accommodation ID input', () => {
            const validInput = {
                accommodationId: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => AmenityGetForAccommodationInputSchema.parse(validInput)).not.toThrow();
            const result = AmenityGetForAccommodationInputSchema.parse(validInput);
            expect(result).toMatchObject(validInput);
        });

        it('should reject invalid UUID', () => {
            const invalidInput = {
                accommodationId: 'invalid-uuid'
            };

            expect(() => AmenityGetForAccommodationInputSchema.parse(invalidInput)).toThrow(
                ZodError
            );
        });

        it('should reject missing accommodationId', () => {
            const emptyInput = {};

            expect(() => AmenityGetForAccommodationInputSchema.parse(emptyInput)).toThrow(ZodError);
        });
    });

    describe('AmenityListWithUsageCountSchema', () => {
        it('should validate amenity with usage count', () => {
            const amenityWithCount = {
                ...createValidAmenity(),
                accommodationCount: 15
            };

            expect(() => AmenityListWithUsageCountSchema.parse(amenityWithCount)).not.toThrow();
            const result = AmenityListWithUsageCountSchema.parse(amenityWithCount);
            expect(result.accommodationCount).toBe(15);
        });

        it('should validate amenity without usage count', () => {
            const amenityWithoutCount = createValidAmenity();

            expect(() => AmenityListWithUsageCountSchema.parse(amenityWithoutCount)).not.toThrow();
        });

        it('should reject negative accommodation count', () => {
            const invalidAmenity = {
                ...createValidAmenity(),
                accommodationCount: -5
            };

            expect(() => AmenityListWithUsageCountSchema.parse(invalidAmenity)).toThrow(ZodError);
        });

        it('should reject non-integer accommodation count', () => {
            const invalidAmenity = {
                ...createValidAmenity(),
                accommodationCount: 15.5
            };

            expect(() => AmenityListWithUsageCountSchema.parse(invalidAmenity)).toThrow(ZodError);
        });
    });

    describe('AmenitySearchForListOutputSchema', () => {
        it('should validate valid search output', () => {
            const validOutput = {
                items: [
                    {
                        ...createValidAmenity(),
                        accommodationCount: 10
                    },
                    {
                        ...createValidAmenity(),
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        accommodationCount: 5
                    }
                ],
                total: 2
            };

            expect(() => AmenitySearchForListOutputSchema.parse(validOutput)).not.toThrow();
            const result = AmenitySearchForListOutputSchema.parse(validOutput);
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should validate empty search output', () => {
            const emptyOutput = {
                items: [],
                total: 0
            };

            expect(() => AmenitySearchForListOutputSchema.parse(emptyOutput)).not.toThrow();
        });

        it('should reject negative total', () => {
            const invalidOutput = {
                items: [],
                total: -1
            };

            expect(() => AmenitySearchForListOutputSchema.parse(invalidOutput)).toThrow(ZodError);
        });

        it('should reject non-integer total', () => {
            const invalidOutput = {
                items: [],
                total: 5.5
            };

            expect(() => AmenitySearchForListOutputSchema.parse(invalidOutput)).toThrow(ZodError);
        });
    });

    describe('AmenityAccommodationsOutputSchema', () => {
        it('should validate accommodations output', () => {
            const validOutput = {
                accommodations: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        slug: 'hotel-a',
                        name: 'Hotel A',
                        summary: 'A great hotel',
                        type: 'HOTEL',
                        isFeatured: false,
                        lifecycleState: 'ACTIVE',
                        visibility: 'PUBLIC',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '550e8400-e29b-41d4-a716-446655440002',
                        updatedById: '550e8400-e29b-41d4-a716-446655440002'
                    }
                ]
            };

            expect(() => AmenityAccommodationsOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate empty accommodations output', () => {
            const emptyOutput = {
                accommodations: []
            };

            expect(() => AmenityAccommodationsOutputSchema.parse(emptyOutput)).not.toThrow();
        });
    });

    describe('AmenityArrayOutputSchema', () => {
        it('should validate amenities array output', () => {
            const validOutput = {
                amenities: [
                    createValidAmenity(),
                    {
                        ...createValidAmenity(),
                        id: '550e8400-e29b-41d4-a716-446655440001'
                    }
                ]
            };

            expect(() => AmenityArrayOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate empty amenities output', () => {
            const emptyOutput = {
                amenities: []
            };

            expect(() => AmenityArrayOutputSchema.parse(emptyOutput)).not.toThrow();
        });
    });

    describe('AmenitySearchInputSchema', () => {
        it('should validate search input with all parameters', () => {
            const validInput = {
                pagination: {
                    page: 1,
                    pageSize: 20
                },
                filters: {
                    category: 'CONNECTIVITY',
                    hasIcon: true,
                    minUsageCount: 5
                },
                query: 'wifi',
                searchInDescription: true,
                fuzzySearch: false
            };

            expect(() => AmenitySearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate minimal search input', () => {
            const minimalInput = {};

            expect(() => AmenitySearchInputSchema.parse(minimalInput)).not.toThrow();
        });

        it('should apply default values', () => {
            const input = {
                query: 'wifi'
            };

            const result = AmenitySearchInputSchema.parse(input);
            expect(result.searchInDescription).toBe(true);
            expect(result.fuzzySearch).toBe(true);
        });
    });

    describe('AmenityListInputSchema', () => {
        it('should validate list input with all parameters', () => {
            const validInput = {
                page: 1,
                pageSize: 50,
                filters: {
                    category: 'OUTDOORS',
                    isPopular: true
                },
                sortBy: 'name',
                sortOrder: 'asc',
                groupByCategory: true
            };

            expect(() => AmenityListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should apply default values', () => {
            const input = {};

            const result = AmenityListInputSchema.parse(input);
            expect(result.sortBy).toBe('name');
            expect(result.sortOrder).toBe('asc');
            expect(result.groupByCategory).toBe(false);
        });

        it('should reject invalid sort parameters', () => {
            const invalidInputs = [{ sortBy: 'invalid-field' }, { sortOrder: 'invalid-order' }];

            invalidInputs.forEach((input, index) => {
                expect(
                    () => AmenityListInputSchema.parse(input),
                    `Invalid sort case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('AmenityFiltersSchema', () => {
        it('should validate all filter types', () => {
            const validFilters = {
                category: 'CONNECTIVITY',
                categories: ['CONNECTIVITY', 'ENTERTAINMENT'],
                icon: 'wifi-icon',
                hasIcon: true,
                minUsageCount: 5,
                maxUsageCount: 100,
                isUnused: false,
                createdAfter: new Date('2024-01-01'),
                createdBefore: new Date('2024-12-31'),
                nameStartsWith: 'wifi',
                nameEndsWith: 'access',
                nameContains: 'internet',
                hasDescription: true,
                descriptionContains: 'high-speed',
                isPopular: true,
                popularityThreshold: 10
            };

            expect(() => AmenityFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should validate empty filters', () => {
            const emptyFilters = {};

            expect(() => AmenityFiltersSchema.parse(emptyFilters)).not.toThrow();
        });

        it('should reject invalid usage count ranges', () => {
            const invalidFilters = [
                { minUsageCount: -1 },
                { maxUsageCount: -5 },
                { popularityThreshold: 0 }
            ];

            invalidFilters.forEach((filter, index) => {
                expect(
                    () => AmenityFiltersSchema.parse(filter),
                    `Invalid filter case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid string lengths', () => {
            const invalidFilters = [
                { category: '' }, // too short
                { nameStartsWith: 'a'.repeat(51) }, // too long
                { descriptionContains: 'a'.repeat(101) } // too long
            ];

            invalidFilters.forEach((filter, index) => {
                expect(
                    () => AmenityFiltersSchema.parse(filter),
                    `Invalid string length case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });
});
