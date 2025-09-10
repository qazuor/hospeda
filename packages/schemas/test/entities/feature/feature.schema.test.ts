import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { FeatureSchema } from '../../../src/entities/feature/feature.schema.js';
import {
    createComplexFeature,
    createFeatureEdgeCases,
    createFeatureWithInvalidFields,
    createInvalidFeature,
    createMinimalFeature,
    createValidFeature
} from '../../fixtures/feature.fixtures.js';

describe('FeatureSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid feature', () => {
            const validData = createValidFeature();

            expect(() => FeatureSchema.parse(validData)).not.toThrow();

            const result = FeatureSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required feature data', () => {
            const minimalData = createMinimalFeature();

            expect(() => FeatureSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested feature', () => {
            const complexData = createComplexFeature();

            expect(() => FeatureSchema.parse(complexData)).not.toThrow();

            const result = FeatureSchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.icon).toBeDefined();
            expect(result.isBuiltin).toBeDefined();
            expect(result.isFeatured).toBeDefined();
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createFeatureEdgeCases();

            edgeCases.forEach((edgeCase, index) => {
                expect(
                    () => FeatureSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate all feature boolean fields', () => {
            const booleanValues = [true, false];

            for (const isBuiltin of booleanValues) {
                const featureData = {
                    ...createMinimalFeature(),
                    isBuiltin
                };

                expect(
                    () => FeatureSchema.parse(featureData),
                    `isBuiltin ${isBuiltin} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate optional fields when present', () => {
            const featureWithOptionals = {
                ...createMinimalFeature(),
                description: 'This is a detailed description of the feature',
                icon: 'feature-icon',
                isBuiltin: true,
                isFeatured: true
            };

            expect(() => FeatureSchema.parse(featureWithOptionals)).not.toThrow();

            const result = FeatureSchema.parse(featureWithOptionals);
            expect(result.description).toBe(featureWithOptionals.description);
            expect(result.icon).toBe(featureWithOptionals.icon);
            expect(result.isBuiltin).toBe(featureWithOptionals.isBuiltin);
            expect(result.isFeatured).toBe(featureWithOptionals.isFeatured);
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid feature data', () => {
            const invalidData = createInvalidFeature();

            expect(() => FeatureSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject feature with invalid fields', () => {
            const invalidFields = createFeatureWithInvalidFields();

            invalidFields.forEach((invalidField, index) => {
                expect(
                    () => FeatureSchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                // Missing required fields: id, slug, name, lifecycleState, etc.
                description: 'Some description'
            };

            expect(() => FeatureSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject invalid slug format', () => {
            const invalidSlugCases = [
                { ...createMinimalFeature(), slug: 'Invalid Slug With Spaces' },
                { ...createMinimalFeature(), slug: 'invalid_slug_with_underscores' },
                { ...createMinimalFeature(), slug: 'InvalidSlugWithCaps' },
                { ...createMinimalFeature(), slug: 'slug-with-special-chars!' },
                { ...createMinimalFeature(), slug: 'ab' }, // too short
                { ...createMinimalFeature(), slug: 'a'.repeat(101) } // too long
            ];

            invalidSlugCases.forEach((testCase, index) => {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid slug case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid name length', () => {
            const invalidNameCases = [
                { ...createMinimalFeature(), name: '' }, // empty
                { ...createMinimalFeature(), name: 'A'.repeat(101) } // too long
            ];

            invalidNameCases.forEach((testCase, index) => {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid name case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid boolean fields', () => {
            const invalidBoolean = {
                ...createMinimalFeature(),
                isBuiltin: 'not-boolean'
            };

            expect(() => FeatureSchema.parse(invalidBoolean)).toThrow(ZodError);
        });

        it('should reject invalid lifecycle state', () => {
            const invalidLifecycleState = {
                ...createMinimalFeature(),
                lifecycleState: 'INVALID_STATE'
            };

            expect(() => FeatureSchema.parse(invalidLifecycleState)).toThrow(ZodError);
        });

        it('should reject invalid boolean fields', () => {
            const invalidBooleanCases = [
                { ...createMinimalFeature(), isBuiltin: 'not-boolean' },
                { ...createMinimalFeature(), isBuiltin: 1 },
                { ...createMinimalFeature(), isBuiltin: 'true' }
            ];

            for (const [index, testCase] of invalidBooleanCases.entries()) {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid boolean case ${index} should throw`
                ).toThrow(ZodError);
            }
        });

        it('should reject invalid string fields', () => {
            const invalidStringCases = [
                { ...createMinimalFeature(), name: 123 }, // number instead of string
                { ...createMinimalFeature(), slug: 456 }, // number instead of string
                { ...createMinimalFeature(), description: true } // boolean instead of string
            ];

            for (const [index, testCase] of invalidStringCases.entries()) {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid string case ${index} should throw`
                ).toThrow(ZodError);
            }
        });

        it('should reject invalid UUID fields', () => {
            const invalidUuidCases = [
                { ...createMinimalFeature(), id: 'not-uuid' },
                { ...createMinimalFeature(), createdById: 'invalid-uuid' },
                { ...createMinimalFeature(), updatedById: '' }
            ];

            invalidUuidCases.forEach((testCase, index) => {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid date fields', () => {
            const invalidDateCases = [
                { ...createMinimalFeature(), createdAt: 'not-date' },
                { ...createMinimalFeature(), updatedAt: 'invalid-date' },
                { ...createMinimalFeature(), createdAt: {} } // empty object that can't be coerced
            ];

            for (const [index, testCase] of invalidDateCases.entries()) {
                expect(
                    () => FeatureSchema.parse(testCase),
                    `Invalid date case ${index} should throw`
                ).toThrow(ZodError);
            }
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
                const featureData = {
                    ...createMinimalFeature(),
                    slug
                };

                expect(
                    () => FeatureSchema.parse(featureData),
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
                const featureData = {
                    ...createMinimalFeature(),
                    ...(description !== undefined && { description })
                };

                expect(
                    () => FeatureSchema.parse(featureData),
                    `Description case ${index} should be valid`
                ).not.toThrow();
            });

            // Test invalid description (too long)
            const tooLongDescription = {
                ...createMinimalFeature(),
                description: 'A'.repeat(501)
            };

            expect(() => FeatureSchema.parse(tooLongDescription)).toThrow(ZodError);
        });

        it('should validate display order constraints', () => {
            const validDisplayOrders = [
                undefined, // optional
                1,
                50,
                999
            ];

            validDisplayOrders.forEach((displayOrder, index) => {
                const featureData = {
                    ...createMinimalFeature(),
                    ...(displayOrder !== undefined && { displayOrder })
                };

                expect(
                    () => FeatureSchema.parse(featureData),
                    `Display order case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate boolean field values', () => {
            const validBooleans = [true, false];

            for (const isFeatured of validBooleans) {
                const featureData = {
                    ...createMinimalFeature(),
                    isFeatured
                };

                expect(
                    () => FeatureSchema.parse(featureData),
                    `isFeatured "${isFeatured}" should be valid`
                ).not.toThrow();
            }
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = createValidFeature();
            const result = FeatureSchema.parse(validData);

            // Type checks
            expect(typeof result.id).toBe('string');
            expect(typeof result.slug).toBe('string');
            expect(typeof result.name).toBe('string');
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
