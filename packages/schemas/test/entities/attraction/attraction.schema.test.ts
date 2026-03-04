import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AttractionSchema } from '../../../src/entities/attraction/attraction.schema.js';
import {
    createAttractionEdgeCases,
    createAttractionWithInvalidFields,
    createComplexAttraction,
    createInvalidAttraction,
    createMinimalAttraction,
    createValidAttraction
} from '../../fixtures/attraction.fixtures.js';

describe('AttractionSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid attraction', () => {
            const validData = createValidAttraction();

            expect(() => AttractionSchema.parse(validData)).not.toThrow();

            const result = AttractionSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required attraction data', () => {
            const minimalData = createMinimalAttraction();

            expect(() => AttractionSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested attraction', () => {
            const complexData = createComplexAttraction();

            expect(() => AttractionSchema.parse(complexData)).not.toThrow();

            const result = AttractionSchema.parse(complexData);
            expect(result.description).toBeDefined();
            expect(result.icon).toBeDefined();
            expect(result.isBuiltin).toBeDefined();
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createAttractionEdgeCases();

            for (const [index, edgeCase] of edgeCases.entries()) {
                expect(
                    () => AttractionSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            }
        });

        it('should apply default values correctly', () => {
            const minimalData = createMinimalAttraction();
            const result = AttractionSchema.parse(minimalData);

            expect(result.isFeatured).toBe(false);
            expect(result.isBuiltin).toBe(false);
        });

        it('should handle optional destinationId', () => {
            const dataWithoutDestination = {
                ...createMinimalAttraction(),
                destinationId: undefined
            };

            expect(() => AttractionSchema.parse(dataWithoutDestination)).not.toThrow();

            const result = AttractionSchema.parse(dataWithoutDestination);
            expect(result.destinationId).toBeUndefined();
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid attraction data', () => {
            const invalidData = createInvalidAttraction();

            expect(() => AttractionSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject attractions with invalid individual fields', () => {
            const invalidFields = createAttractionWithInvalidFields();

            for (const [index, invalidField] of invalidFields.entries()) {
                expect(
                    () => AttractionSchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            }
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                id: 'valid-uuid-here'
                // Missing name, slug, description, icon
            };

            expect(() => AttractionSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should validate name constraints', () => {
            const baseData = createMinimalAttraction();

            // Too short name
            expect(() => AttractionSchema.parse({ ...baseData, name: 'ab' })).toThrow(ZodError);

            // Too long name
            expect(() => AttractionSchema.parse({ ...baseData, name: 'a'.repeat(101) })).toThrow(
                ZodError
            );

            // Invalid type
            expect(() => AttractionSchema.parse({ ...baseData, name: 123 })).toThrow(ZodError);
        });

        it('should validate slug constraints', () => {
            const baseData = createMinimalAttraction();

            // Too short slug
            expect(() => AttractionSchema.parse({ ...baseData, slug: 'ab' })).toThrow(ZodError);

            // Too long slug
            expect(() => AttractionSchema.parse({ ...baseData, slug: 'a'.repeat(101) })).toThrow(
                ZodError
            );

            // Invalid pattern - spaces
            expect(() => AttractionSchema.parse({ ...baseData, slug: 'invalid slug' })).toThrow(
                ZodError
            );

            // Invalid pattern - underscores
            expect(() => AttractionSchema.parse({ ...baseData, slug: 'invalid_slug' })).toThrow(
                ZodError
            );

            // Invalid pattern - uppercase
            expect(() => AttractionSchema.parse({ ...baseData, slug: 'Invalid-Slug' })).toThrow(
                ZodError
            );
        });

        it('should validate description constraints', () => {
            const baseData = createMinimalAttraction();

            // Too short description
            expect(() => AttractionSchema.parse({ ...baseData, description: 'short' })).toThrow(
                ZodError
            );

            // Too long description
            expect(() =>
                AttractionSchema.parse({ ...baseData, description: 'a'.repeat(501) })
            ).toThrow(ZodError);

            // Invalid type
            expect(() => AttractionSchema.parse({ ...baseData, description: 123 })).toThrow(
                ZodError
            );
        });

        it('should validate icon constraints', () => {
            const baseData = createMinimalAttraction();

            // Empty icon
            expect(() => AttractionSchema.parse({ ...baseData, icon: '' })).toThrow(ZodError);

            // Too long icon
            expect(() => AttractionSchema.parse({ ...baseData, icon: 'a'.repeat(101) })).toThrow(
                ZodError
            );

            // Invalid type
            expect(() => AttractionSchema.parse({ ...baseData, icon: 123 })).toThrow(ZodError);
        });

        it('should validate destinationId format when provided', () => {
            const baseData = createMinimalAttraction();

            // Invalid UUID format
            expect(() =>
                AttractionSchema.parse({ ...baseData, destinationId: 'invalid-uuid' })
            ).toThrow(ZodError);

            // Invalid type
            expect(() => AttractionSchema.parse({ ...baseData, destinationId: 123 })).toThrow(
                ZodError
            );
        });

        it('should validate boolean fields', () => {
            const baseData = createMinimalAttraction();

            // Invalid isFeatured type
            expect(() =>
                AttractionSchema.parse({ ...baseData, isFeatured: 'not-boolean' })
            ).toThrow(ZodError);

            // Invalid isBuiltin type
            expect(() => AttractionSchema.parse({ ...baseData, isBuiltin: 'not-boolean' })).toThrow(
                ZodError
            );
        });
    });

    describe('Field Validation', () => {
        it('should preserve all valid fields in parsed result', () => {
            const validData = createValidAttraction();
            const result = AttractionSchema.parse(validData);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('slug');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('icon');
            expect(result).toHaveProperty('isFeatured');
            expect(result).toHaveProperty('isBuiltin');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');
        });

        it('should handle branded ID types correctly', () => {
            const validData = createValidAttraction();
            const result = AttractionSchema.parse(validData);

            expect(typeof result.id).toBe('string');
            if (result.destinationId) {
                expect(typeof result.destinationId).toBe('string');
            }
        });
    });

    describe('displayWeight validation', () => {
        it('should apply default value of 50 when displayWeight is not provided', () => {
            const data = createMinimalAttraction();
            const result = AttractionSchema.parse(data);

            expect(result.displayWeight).toBe(50);
        });

        it('should accept minimum boundary value of 1', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 1 };

            expect(() => AttractionSchema.parse(data)).not.toThrow();

            const result = AttractionSchema.parse(data);
            expect(result.displayWeight).toBe(1);
        });

        it('should accept maximum boundary value of 100', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 100 };

            expect(() => AttractionSchema.parse(data)).not.toThrow();

            const result = AttractionSchema.parse(data);
            expect(result.displayWeight).toBe(100);
        });

        it('should accept typical middle value of 50', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 50 };

            expect(() => AttractionSchema.parse(data)).not.toThrow();

            const result = AttractionSchema.parse(data);
            expect(result.displayWeight).toBe(50);
        });

        it('should reject value below minimum (0)', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 0 };

            expect(() => AttractionSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject value above maximum (101)', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 101 };

            expect(() => AttractionSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject non-integer values (1.5)', () => {
            const data = { ...createMinimalAttraction(), displayWeight: 1.5 };

            expect(() => AttractionSchema.parse(data)).toThrow(ZodError);
        });

        it('should reject negative values (-1)', () => {
            const data = { ...createMinimalAttraction(), displayWeight: -1 };

            expect(() => AttractionSchema.parse(data)).toThrow(ZodError);
        });
    });

    describe('Schema Composition', () => {
        it('should include all base field schemas', () => {
            const validData = createValidAttraction();
            const result = AttractionSchema.parse(validData);

            // Base ID fields
            expect(result).toHaveProperty('id');

            // Base audit fields
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');

            // Base lifecycle fields
            expect(result).toHaveProperty('lifecycleState');

            // Base admin fields
            expect(result).toHaveProperty('adminInfo');
        });
    });
});
