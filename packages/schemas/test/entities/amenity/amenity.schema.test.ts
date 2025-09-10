import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AmenitySchema } from '../../../src/entities/amenity/amenity.schema.js';
import {
    createAmenityEdgeCases,
    createAmenityWithInvalidFields,
    createComplexAmenity,
    createInvalidAmenity,
    createMinimalAmenity,
    createValidAmenity
} from '../../fixtures/amenity.fixtures.js';

describe('AmenitySchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid amenity', () => {
            const validData = createValidAmenity();

            expect(() => AmenitySchema.parse(validData)).not.toThrow();

            const result = AmenitySchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required amenity data', () => {
            const minimalData = createMinimalAmenity();

            expect(() => AmenitySchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested amenity', () => {
            const complexData = createComplexAmenity();

            expect(() => AmenitySchema.parse(complexData)).not.toThrow();

            const result = AmenitySchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.icon).toBeDefined();
            expect(result.isBuiltin).toBeDefined();
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createAmenityEdgeCases();

            for (const [index, edgeCase] of edgeCases.entries()) {
                expect(
                    () => AmenitySchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate all amenity categories', () => {
            const categories = [
                'CLIMATE_CONTROL',
                'CONNECTIVITY',
                'ENTERTAINMENT',
                'KITCHEN',
                'BED_AND_BATH',
                'OUTDOORS',
                'ACCESSIBILITY',
                'SERVICES',
                'SAFETY',
                'FAMILY_FRIENDLY',
                'WORK_FRIENDLY',
                'GENERAL_APPLIANCES'
            ];

            for (const category of categories) {
                const amenityData = {
                    ...createMinimalAmenity(),
                    type: category
                };

                expect(
                    () => AmenitySchema.parse(amenityData),
                    `Category ${category} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate optional fields when present', () => {
            const amenityWithOptionals = {
                ...createMinimalAmenity(),
                description: 'This is a detailed description of the amenity',
                icon: 'wifi-icon',
                isBuiltin: true,
                isFeatured: true
            };

            expect(() => AmenitySchema.parse(amenityWithOptionals)).not.toThrow();

            const result = AmenitySchema.parse(amenityWithOptionals);
            expect(result.description).toBe(amenityWithOptionals.description);
            expect(result.icon).toBe(amenityWithOptionals.icon);
            expect(result.isBuiltin).toBe(amenityWithOptionals.isBuiltin);
            expect(result.isFeatured).toBe(amenityWithOptionals.isFeatured);
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid amenity data', () => {
            const invalidData = createInvalidAmenity();

            expect(() => AmenitySchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject amenity with invalid fields', () => {
            const invalidFields = createAmenityWithInvalidFields();

            invalidFields.forEach((invalidField, index) => {
                expect(
                    () => AmenitySchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                // Missing required fields: id, slug, name, category, lifecycleState, etc.
                description: 'Some description'
            };

            expect(() => AmenitySchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject invalid slug format', () => {
            const invalidSlugCases = [
                { ...createMinimalAmenity(), slug: 'Invalid Slug With Spaces' },
                { ...createMinimalAmenity(), slug: 'invalid_slug_with_underscores' },
                { ...createMinimalAmenity(), slug: 'InvalidSlugWithCaps' },
                { ...createMinimalAmenity(), slug: 'slug-with-special-chars!' },
                { ...createMinimalAmenity(), slug: 'ab' }, // too short
                { ...createMinimalAmenity(), slug: 'a'.repeat(101) } // too long
            ];

            invalidSlugCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid slug case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid name length', () => {
            const invalidNameCases = [
                { ...createMinimalAmenity(), name: '' }, // empty
                { ...createMinimalAmenity(), name: 'A'.repeat(101) } // too long
            ];

            invalidNameCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid name case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid type', () => {
            const invalidType = {
                ...createMinimalAmenity(),
                type: 'INVALID_TYPE'
            };

            expect(() => AmenitySchema.parse(invalidType)).toThrow(ZodError);
        });

        it('should reject invalid lifecycle state', () => {
            const invalidLifecycleState = {
                ...createMinimalAmenity(),
                lifecycleState: 'INVALID_STATE'
            };

            expect(() => AmenitySchema.parse(invalidLifecycleState)).toThrow(ZodError);
        });

        it('should reject invalid boolean fields', () => {
            const invalidBooleanCases = [
                { ...createMinimalAmenity(), isBuiltin: 'not-boolean' },
                { ...createMinimalAmenity(), isBuiltin: 1 },
                { ...createMinimalAmenity(), isBuiltin: 'true' }
            ];

            invalidBooleanCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid boolean case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid boolean fields (isFeatured)', () => {
            const invalidBooleanCases = [
                { ...createMinimalAmenity(), isFeatured: 'not-boolean' },
                { ...createMinimalAmenity(), isFeatured: 1 },
                { ...createMinimalAmenity(), isFeatured: 'true' }
            ];

            invalidBooleanCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid boolean case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid UUID fields', () => {
            const invalidUuidCases = [
                { ...createMinimalAmenity(), id: 'not-uuid' },
                { ...createMinimalAmenity(), createdById: 'invalid-uuid' },
                { ...createMinimalAmenity(), updatedById: '' }
            ];

            invalidUuidCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid date fields', () => {
            const invalidDateCases = [
                { ...createMinimalAmenity(), createdAt: {} },
                { ...createMinimalAmenity(), updatedAt: [] },
                { ...createMinimalAmenity(), createdAt: 'definitely-not-a-date' }
            ];

            invalidDateCases.forEach((testCase, index) => {
                expect(
                    () => AmenitySchema.parse(testCase),
                    `Invalid date case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('Field Validation', () => {
        it('should validate slug pattern correctly', () => {
            const validSlugs = [
                'wifi',
                'air-conditioning',
                'pool-access',
                'gym-24-7',
                'parking-free'
            ];

            for (const slug of validSlugs) {
                const amenityData = {
                    ...createMinimalAmenity(),
                    slug
                };

                expect(
                    () => AmenitySchema.parse(amenityData),
                    `Slug "${slug}" should be valid`
                ).not.toThrow();
            }
        });

        it('should validate description length limits', () => {
            const validDescriptions = [
                undefined, // optional
                'Short description',
                'A'.repeat(500) // max length
            ];

            validDescriptions.forEach((description, index) => {
                const amenityData = {
                    ...createMinimalAmenity(),
                    ...(description !== undefined && { description })
                };

                expect(
                    () => AmenitySchema.parse(amenityData),
                    `Description case ${index} should be valid`
                ).not.toThrow();
            });

            // Test invalid description (too long)
            const tooLongDescription = {
                ...createMinimalAmenity(),
                description: 'A'.repeat(501)
            };

            expect(() => AmenitySchema.parse(tooLongDescription)).toThrow(ZodError);
        });

        it('should validate display order constraints', () => {
            const validDisplayOrders = [
                undefined, // optional
                1,
                50,
                999
            ];

            validDisplayOrders.forEach((displayOrder, index) => {
                const amenityData = {
                    ...createMinimalAmenity(),
                    ...(displayOrder !== undefined && { displayOrder })
                };

                expect(
                    () => AmenitySchema.parse(amenityData),
                    `Display order case ${index} should be valid`
                ).not.toThrow();
            });
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = createValidAmenity();
            const result = AmenitySchema.parse(validData);

            // Type checks
            expect(typeof result.id).toBe('string');
            expect(typeof result.slug).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.lifecycleState).toBe('string');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);

            // Optional fields type checks
            if (result.description) {
                expect(typeof result.description).toBe('string');
            }
            if (result.icon) {
                expect(typeof result.icon).toBe('string');
            }
            if (result.isBuiltin !== undefined) {
                expect(typeof result.isBuiltin).toBe('boolean');
            }
            if (result.isFeatured !== undefined) {
                expect(typeof result.isFeatured).toBe('boolean');
            }
        });
    });
});
