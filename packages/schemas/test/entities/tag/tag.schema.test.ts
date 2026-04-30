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
            expect(result).toMatchObject({
                id: validData.id,
                name: validData.name,
                color: validData.color,
                type: validData.type
            });
        });

        it('should validate minimal required tag data (SYSTEM type)', () => {
            const minimalData = createMinimalTag();

            expect(() => TagSchema.parse(minimalData)).not.toThrow();

            const result = TagSchema.parse(minimalData);
            expect(result.type).toBe('SYSTEM');
            expect(result.ownerId).toBeNull();
        });

        it('should validate complex nested tag', () => {
            const complexData = createComplexTag();

            expect(() => TagSchema.parse(complexData)).not.toThrow();

            const result = TagSchema.parse(complexData);
            expect(result.icon).toBeDefined();
            expect(result.description).toBeDefined();
        });

        it('should validate system tag', () => {
            const systemTag = createSystemTag();

            expect(() => TagSchema.parse(systemTag)).not.toThrow();

            const result = TagSchema.parse(systemTag);
            expect(result.type).toBe('SYSTEM');
            expect(result.ownerId).toBeNull();
            expect(result.color).toBe('GREY');
        });

        it('should validate USER tag with ownerId', () => {
            const userTag = {
                ...createMinimalTag(),
                type: 'USER' as const,
                ownerId: '550e8400-e29b-41d4-a716-446655440000'
            };

            expect(() => TagSchema.parse(userTag)).not.toThrow();

            const result = TagSchema.parse(userTag);
            expect(result.type).toBe('USER');
            expect(result.ownerId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should validate INTERNAL tag with null ownerId', () => {
            const internalTag = {
                ...createMinimalTag(),
                type: 'INTERNAL' as const,
                ownerId: null
            };

            expect(() => TagSchema.parse(internalTag)).not.toThrow();

            const result = TagSchema.parse(internalTag);
            expect(result.type).toBe('INTERNAL');
            expect(result.ownerId).toBeNull();
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

        it('should validate all tag types', () => {
            const types = ['INTERNAL', 'SYSTEM', 'USER'] as const;

            for (const type of types) {
                const tagData = {
                    ...createMinimalTag(),
                    type,
                    ownerId: type === 'USER' ? '550e8400-e29b-41d4-a716-446655440000' : null
                };

                expect(
                    () => TagSchema.parse(tagData),
                    `Type ${type} should be valid`
                ).not.toThrow();
            }
        });

        it('should validate optional fields when present', () => {
            const tagWithOptionals = {
                ...createMinimalTag(),
                icon: 'custom-icon-ok',
                description: 'This is a description for the tag'
            };

            expect(() => TagSchema.parse(tagWithOptionals)).not.toThrow();

            const result = TagSchema.parse(tagWithOptionals);
            expect(result.icon).toBe(tagWithOptionals.icon);
            expect(result.description).toBe(tagWithOptionals.description);
        });

        it('should accept null for createdById and updatedById (nullable audit fields)', () => {
            const tagWithNullAuditUsers = {
                ...createMinimalTag(),
                createdById: null,
                updatedById: null
            };

            expect(() => TagSchema.parse(tagWithNullAuditUsers)).not.toThrow();

            const result = TagSchema.parse(tagWithNullAuditUsers);
            expect(result.createdById).toBeNull();
            expect(result.updatedById).toBeNull();
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
                // Missing required fields: id, type, name, color, lifecycleState
                description: 'Some description'
            };

            expect(() => TagSchema.parse(incompleteData)).toThrow(ZodError);
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

        it('should reject invalid type', () => {
            const invalidType = {
                ...createMinimalTag(),
                type: 'INVALID_TYPE'
            };

            expect(() => TagSchema.parse(invalidType)).toThrow(ZodError);
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

        it('should reject invalid UUID fields', () => {
            const invalidUuidCases = [
                { ...createMinimalTag(), id: 'not-uuid' },
                { ...createMinimalTag(), createdById: 'invalid-uuid' },
                { ...createMinimalTag(), updatedById: '' },
                { ...createMinimalTag(), type: 'USER', ownerId: 'not-a-uuid' }
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

        it('should NOT have a slug field (removed per D-002)', () => {
            // Parsing with slug should succeed (extra fields are stripped by default)
            // but the result must not contain slug
            const tagWithSlug = {
                ...createMinimalTag(),
                slug: 'some-slug'
            };

            // Zod strips unknown fields by default — slug must NOT appear in output
            const result = TagSchema.parse(tagWithSlug);
            expect(Object.keys(result)).not.toContain('slug');
        });

        it('should NOT have a notes field (replaced by description per D-018)', () => {
            const tagWithNotes = {
                ...createMinimalTag(),
                notes: 'some notes'
            };

            const result = TagSchema.parse(tagWithNotes);
            expect(Object.keys(result)).not.toContain('notes');
        });
    });

    describe('Field Validation', () => {
        it('should validate name length limits', () => {
            const validNames = [
                'AB', // minimum 2 chars
                'A'.repeat(50) // maximum 50 chars
            ];

            validNames.forEach((name, index) => {
                const tagData = { ...createMinimalTag(), name };

                expect(
                    () => TagSchema.parse(tagData),
                    `Valid name case ${index} should not throw`
                ).not.toThrow();
            });

            // Test invalid name (too long)
            expect(() => TagSchema.parse({ ...createMinimalTag(), name: 'A'.repeat(51) })).toThrow(
                ZodError
            );
        });

        it('should validate icon constraints', () => {
            const validIcons = [
                undefined, // optional
                null, // nullable
                'ic',
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

        it('should validate description is optional and nullable', () => {
            const cases = [
                { ...createMinimalTag() }, // absent
                { ...createMinimalTag(), description: null }, // null
                { ...createMinimalTag(), description: 'Some description text' } // present
            ];

            cases.forEach((tagData, index) => {
                expect(
                    () => TagSchema.parse(tagData),
                    `Description case ${index} should be valid`
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
            expect(typeof result.name).toBe('string');
            expect(typeof result.color).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.lifecycleState).toBe('string');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);

            // Optional fields type checks
            if (result.icon !== null && result.icon !== undefined) {
                expect(typeof result.icon).toBe('string');
            }
            if (result.description !== null && result.description !== undefined) {
                expect(typeof result.description).toBe('string');
            }
        });
    });
});
