import { resolveValidationMessage } from '@repo/i18n';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    validateFieldWithZod,
    validateFormWithZod
} from '../../../src/lib/validation/validate-form';

// ---------------------------------------------------------------------------
// Test schema — mirrors the real entity schema patterns used across the app
// ---------------------------------------------------------------------------

const TestEntityCreateSchema = z.object({
    name: z
        .string({ message: 'zodError.entity.name.invalidType' })
        .min(2, 'zodError.entity.name.min')
        .max(100, 'zodError.entity.name.max'),
    slug: z
        .string({ message: 'zodError.entity.slug.invalidType' })
        .min(1, 'zodError.entity.slug.required'),
    description: z.string().optional(),
    status: z.enum(['active', 'draft', 'archived'], {
        message: 'zodError.entity.status.enum'
    })
});

const TestEntityUpdateSchema = TestEntityCreateSchema.partial();

// ---------------------------------------------------------------------------
// Mock translation function
//
// Simulates the real useTranslations() behaviour:
// - Keys starting with "validation." are considered "found" → "Translated: <key>"
// - All other keys return the "[MISSING: <key>]" sentinel so
//   resolveValidationMessage falls back to the original key.
// ---------------------------------------------------------------------------

const mockT = vi.fn((key: string, _params?: Record<string, unknown>): string => {
    if (key.startsWith('validation.')) {
        return `Translated: ${key}`;
    }
    return `[MISSING: ${key}]`;
});

// ---------------------------------------------------------------------------

describe('Zod validation integration', () => {
    describe('form submit validation with zodSchema', () => {
        it('blocks submission when form has validation errors', () => {
            // Arrange
            const invalidData = { name: '', slug: '', status: 'invalid' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data: invalidData,
                t: mockT
            });

            // Assert — at least name / slug / status must have errors
            expect(Object.keys(errors).length).toBeGreaterThan(0);
            expect(errors.name).toBeDefined();
        });

        it('reports an error for a field that violates the minimum-length rule', () => {
            // Arrange — name is 1 char (min is 2)
            const data = { name: 'x', slug: 'ok', status: 'active' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data,
                t: mockT
            });

            // Assert
            expect(errors.name).toBeDefined();
            expect(errors.slug).toBeUndefined();
            expect(errors.status).toBeUndefined();
        });

        it('allows submission when all required fields are valid', () => {
            // Arrange
            const validData = { name: 'Test Entity', slug: 'test-entity', status: 'active' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data: validData,
                t: mockT
            });

            // Assert
            expect(Object.keys(errors)).toHaveLength(0);
        });

        it('allows optional fields to be absent', () => {
            // Arrange — description is optional, should not trigger an error
            const data = { name: 'Test Entity', slug: 'test-entity', status: 'draft' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data,
                t: mockT
            });

            // Assert
            expect(errors.description).toBeUndefined();
        });

        it('only keeps the first error per field', () => {
            // Arrange — empty name triggers both invalidType and min errors; we
            // expect exactly one error message for the name field.
            const data = { name: '', slug: 'ok', status: 'active' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data,
                t: mockT
            });

            // Assert — errors[name] is a single string, not an array
            expect(typeof errors.name).toBe('string');
        });
    });

    // -------------------------------------------------------------------------

    describe('backward compatibility without zodSchema (partial / update schema)', () => {
        it('update schema allows empty data (all fields are optional via .partial())', () => {
            // Arrange
            const emptyData = {};

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityUpdateSchema,
                data: emptyData,
                t: mockT
            });

            // Assert
            expect(Object.keys(errors)).toHaveLength(0);
        });

        it('update schema still validates fields that ARE provided', () => {
            // Arrange — name is provided but too short
            const data = { name: 'x' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityUpdateSchema,
                data,
                t: mockT
            });

            // Assert
            expect(errors.name).toBeDefined();
        });
    });

    // -------------------------------------------------------------------------

    describe('blur validation (validateFieldWithZod)', () => {
        it('returns an error for an invalid field', () => {
            // Arrange — name is 1 char, min is 2
            const data = { name: 'x', slug: 'ok', status: 'active' };

            // Act
            const error = validateFieldWithZod({
                schema: TestEntityCreateSchema,
                data,
                fieldId: 'name',
                t: mockT
            });

            // Assert
            expect(error).toBeDefined();
        });

        it('returns undefined for a valid field', () => {
            // Arrange
            const data = { name: 'Valid Name', slug: 'ok', status: 'active' };

            // Act
            const error = validateFieldWithZod({
                schema: TestEntityCreateSchema,
                data,
                fieldId: 'name',
                t: mockT
            });

            // Assert
            expect(error).toBeUndefined();
        });

        it('returns undefined for a field that is not part of the schema errors', () => {
            // Arrange — all fields valid; no error for slug
            const data = { name: 'Valid Name', slug: 'ok', status: 'active' };

            // Act
            const error = validateFieldWithZod({
                schema: TestEntityCreateSchema,
                data,
                fieldId: 'slug',
                t: mockT
            });

            // Assert
            expect(error).toBeUndefined();
        });

        it('returns undefined for a field that is not in the schema', () => {
            // Arrange — unknown field, schema has no path for it
            const data = { name: 'x', slug: 'ok', status: 'active' };

            // Act
            const error = validateFieldWithZod({
                schema: TestEntityCreateSchema,
                data,
                fieldId: 'nonexistentField',
                t: mockT
            });

            // Assert
            expect(error).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------

    describe('translated error messages (not raw zodError.* keys)', () => {
        it('error messages from validateFormWithZod are never raw zodError.* keys', () => {
            // Arrange
            const invalidData = { name: '', slug: '', status: 'active' };

            // Act
            const errors = validateFormWithZod({
                schema: TestEntityCreateSchema,
                data: invalidData,
                t: mockT
            });

            // Assert — none of the values should start with "zodError."
            for (const message of Object.values(errors)) {
                expect(message).not.toMatch(/^zodError\./);
            }
        });

        it('error messages from validateFieldWithZod are never raw zodError.* keys', () => {
            // Arrange
            const data = { name: 'x', slug: 'ok', status: 'active' };

            // Act
            const error = validateFieldWithZod({
                schema: TestEntityCreateSchema,
                data,
                fieldId: 'name',
                t: mockT
            });

            // Assert
            expect(error).not.toMatch(/^zodError\./);
        });

        it('resolveValidationMessage maps zodError.* prefix to validation.* before calling t', () => {
            // Act — call resolveValidationMessage directly with a zodError key
            const result = resolveValidationMessage({
                key: 'zodError.entity.name.required',
                t: mockT
            });

            // Assert — the function should have translated the remapped key
            expect(result).toBe('Translated: validation.entity.name.required');
        });

        it('resolveValidationMessage maps validationError.* prefix to validation.* before calling t', () => {
            // Act
            const result = resolveValidationMessage({
                key: 'validationError.field.tooSmall',
                t: mockT
            });

            // Assert
            expect(result).toBe('Translated: validation.field.tooSmall');
        });

        it('resolveValidationMessage falls back to the original key when translation is missing', () => {
            // Arrange — mock t returns [MISSING: ...] for this unknown key
            const unknownKey = 'some.completely.unknown.key';

            // Act
            const result = resolveValidationMessage({
                key: unknownKey,
                t: mockT
            });

            // Assert — should return the original key unchanged (not [MISSING:...])
            expect(result).toBe(unknownKey);
        });

        it('resolveValidationMessage returns empty string for an empty key', () => {
            // Act
            const result = resolveValidationMessage({ key: '', t: mockT });

            // Assert
            expect(result).toBe('');
        });
    });
});
