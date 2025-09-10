import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { TagSchema } from '../../../src/entities/tag/tag.schema.js';
import {
    createComplexTag,
    createInvalidTag,
    createMinimalTag,
    createSystemTag,
    createTagEdgeCases,
    createTagWithInvalidFields,
    createValidTag
} from '../../fixtures/tag.fixtures.js';

describe('TagSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid tag', () => {
            const validData = createValidTag();

            expect(() => TagSchema.parse(validData)).not.toThrow();

            const result = TagSchema.parse(validData);
            expect(result).toMatchObject(validData);
        });

        it('should validate minimal required tag data', () => {
            const minimalData = createMinimalTag();

            expect(() => TagSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate complex nested tag', () => {
            const complexData = createComplexTag();

            expect(() => TagSchema.parse(complexData)).not.toThrow();

            const result = TagSchema.parse(complexData);
            expect(result.icon).toBeDefined();
            expect(result.notes).toBeDefined();
        });

        it('should validate system tag', () => {
            const systemTag = createSystemTag();

            expect(() => TagSchema.parse(systemTag)).not.toThrow();

            const result = TagSchema.parse(systemTag);
            expect(result.name).toBeDefined();
            expect(result.color).toBe('GREY');
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = createTagEdgeCases();

            edgeCases.forEach((edgeCase, index) => {
                expect(
                    () => TagSchema.parse(edgeCase),
                    `Edge case ${index} should be valid`
                ).not.toThrow();
            });
        });

        it('should validate all tag colors', () => {
            const colors = [
                'RED',
                'BLUE',
                'GREEN',
                'YELLOW',
                'ORANGE',
                'PURPLE',
                'PINK',
                'BROWN',
                'GREY',
                'WHITE',
                'CYAN',
                'MAGENTA',
                'LIGHT_BLUE',
                'LIGHT_GREEN'
            ];

            for (const color of colors) {
                const tagData = {
                    ...createMinimalTag(),
                    color
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Color ${color} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate optional fields when present', () => {
            const tagWithOptionals = {
                ...createMinimalTag(),
                icon: 'custom-icon',
                notes: 'This is a detailed note about the tag'
            };

            expect(() => TagSchema.parse(tagWithOptionals)).not.toThrow();

            const result = TagSchema.parse(tagWithOptionals);
            expect(result.icon).toBe(tagWithOptionals.icon);
            expect(result.notes).toBe(tagWithOptionals.notes);
        });

        it('should validate icon constraints', () => {
            const validIcons = ['icon1', 'custom-icon', 'a'.repeat(100)];

            for (const icon of validIcons) {
                const tagData = {
                    ...createMinimalTag(),
                    icon
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Icon "${icon}" should be valid`
                ).not.toThrow();
            }
        });
    });

    describe('Invalid Data', () => {
        it('should reject completely invalid tag data', () => {
            const invalidData = createInvalidTag();

            expect(() => TagSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject tag with invalid fields', () => {
            const invalidFields = createTagWithInvalidFields();

            invalidFields.forEach((invalidField, index) => {
                expect(
                    () => TagSchema.parse(invalidField),
                    `Invalid field case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject missing required fields', () => {
            const incompleteData = {
                // Missing required fields: id, slug, name, color, lifecycleState, usageCount, etc.
                description: 'Some description'
            };

            expect(() => TagSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject invalid slug format', () => {
            const invalidSlugCases = [
                { ...createMinimalTag(), slug: '' } // empty (too short)
            ];

            invalidSlugCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid slug case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid name length', () => {
            const invalidNameCases = [
                { ...createMinimalTag(), name: '' }, // empty
                { ...createMinimalTag(), name: 'A' }, // too short (min 2)
                { ...createMinimalTag(), name: 'A'.repeat(51) } // too long
            ];

            invalidNameCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid name case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid color', () => {
            const invalidColor = {
                ...createMinimalTag(),
                color: 'RAINBOW'
            };

            expect(() => TagSchema.parse(invalidColor)).toThrow(ZodError);
        });

        it('should reject invalid lifecycle state', () => {
            const invalidLifecycleState = {
                ...createMinimalTag(),
                lifecycleState: 'INVALID_STATE'
            };

            expect(() => TagSchema.parse(invalidLifecycleState)).toThrow(ZodError);
        });

        it('should reject invalid icon fields', () => {
            const invalidIconCases = [
                { ...createMinimalTag(), icon: 'A' }, // too short (min 2)
                { ...createMinimalTag(), icon: 'a'.repeat(101) }, // too long (max 100)
                { ...createMinimalTag(), icon: 123 } // not string
            ];

            invalidIconCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid icon case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid notes fields', () => {
            const invalidNotesCases = [
                { ...createMinimalTag(), notes: 'AB' }, // too short (min 5)
                { ...createMinimalTag(), notes: 'a'.repeat(301) }, // too long (max 300)
                { ...createMinimalTag(), notes: 123 } // not string
            ];

            invalidNotesCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid notes case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid UUID fields', () => {
            const invalidUuidCases = [
                { ...createMinimalTag(), id: 'not-uuid' },
                { ...createMinimalTag(), createdById: 'invalid-uuid' },
                { ...createMinimalTag(), updatedById: '' }
            ];

            invalidUuidCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid UUID case ${index} should throw`
                ).toThrow(ZodError);
            });
        });

        it('should reject invalid date fields', () => {
            const invalidDateCases = [
                { ...createMinimalTag(), createdAt: 'not-date' },
                { ...createMinimalTag(), updatedAt: 'invalid-date' }
            ];

            invalidDateCases.forEach((testCase, index) => {
                expect(
                    () => TagSchema.parse(testCase),
                    `Invalid date case ${index} should throw`
                ).toThrow(ZodError);
            });
        });
    });

    describe('Field Validation', () => {
        it('should validate slug pattern correctly', () => {
            const validSlugs = ['tag', 'featured-tag', 'popular-item', 'new-2024', 'trending-now'];

            for (const slug of validSlugs) {
                const tagData = {
                    ...createMinimalTag(),
                    slug
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Slug "${slug}" should be valid`
                ).not.toThrow();
            }
        });

        it('should validate notes length limits', () => {
            const validNotes = [
                undefined, // optional
                'Short note',
                'A'.repeat(300) // max length
            ];

            validNotes.forEach((notes, index) => {
                const tagData = {
                    ...createMinimalTag(),
                    ...(notes !== undefined && { notes })
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Notes case ${index} should be valid`
                ).not.toThrow();
            });

            // Test invalid notes (too long)
            const tooLongNotes = {
                ...createMinimalTag(),
                notes: 'A'.repeat(301)
            };

            expect(() => TagSchema.parse(tooLongNotes)).toThrow(ZodError);
        });

        it('should validate icon constraints', () => {
            const validIcons = [
                undefined, // optional
                'icon1',
                'custom-icon',
                'a'.repeat(100) // max length
            ];

            validIcons.forEach((icon, index) => {
                const tagData = {
                    ...createMinimalTag(),
                    ...(icon !== undefined && { icon })
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Icon case ${index} should be valid`
                ).not.toThrow();
            });
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from valid data', () => {
            const validData = createValidTag();
            const result = TagSchema.parse(validData);

            // Type checks
            expect(typeof result.id).toBe('string');
            expect(typeof result.slug).toBe('string');
            expect(typeof result.name).toBe('string');
            expect(typeof result.color).toBe('string');
            expect(typeof result.lifecycleState).toBe('string');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);

            // Optional fields type checks
            if (result.icon) {
                expect(typeof result.icon).toBe('string');
            }
            if (result.notes) {
                expect(typeof result.notes).toBe('string');
            }
        });
    });
});
