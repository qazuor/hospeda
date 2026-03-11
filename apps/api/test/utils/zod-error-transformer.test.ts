/**
 * Tests for Zod Error Transformer
 * Tests the transformation of Zod errors into client-friendly format
 */

import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { transformZodError } from '../../src/utils/zod-error-transformer';

describe('Zod Error Transformer', () => {
    describe('transformZodError', () => {
        it('should transform too_small error correctly', () => {
            const schema = z.object({
                id: z.string().min(3)
            });

            try {
                schema.parse({ id: '12' });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.code).toBe('VALIDATION_ERROR');
                    expect(result.messageKey).toBe('validationError.validation.failed');
                    expect(result.zodMessage).toBe('Validation failed');
                    expect(result.userFriendlyMessage).toBe(
                        'Please fix the validation error below'
                    );
                    expect(result.summary).toBeDefined();
                    expect(result.summary.totalErrors).toBe(1);
                    expect(result.summary.fieldCount).toBe(1);
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]).toEqual({
                        field: 'id',
                        messageKey: 'validationError.field.tooSmall',
                        zodMessage: 'Too small: expected string to have >=3 characters',
                        userFriendlyMessage: 'Id must be at least 3 characters long',
                        code: 'TOO_SMALL',
                        params: {
                            min: 3,
                            inclusive: true
                        },
                        suggestion: 'Try adding more characters. Minimum required: 3'
                    });
                }
            }
        });

        it('should transform invalid_type error correctly', () => {
            const schema = z.object({
                age: z.number()
            });

            try {
                schema.parse({ age: 'not a number' });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.code).toBe('VALIDATION_ERROR');
                    expect(result.userFriendlyMessage).toBe(
                        'Please fix the validation error below'
                    );
                    expect(result.summary.totalErrors).toBe(1);
                    expect(result.summary.fieldCount).toBe(1);
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]).toEqual({
                        field: 'age',
                        messageKey: 'validationError.field.invalidType',
                        zodMessage: 'Invalid input: expected number, received string',
                        userFriendlyMessage: 'Age must be a number (received string)',
                        code: 'INVALID_TYPE',
                        params: {
                            expected: 'number',
                            received: 'string'
                        },
                        suggestion: 'Remove quotes if this should be a number'
                    });
                }
            }
        });

        it('should transform multiple errors correctly', () => {
            const schema = z.object({
                id: z.string().min(3),
                age: z.number().min(18)
            });

            try {
                schema.parse({ id: '12', age: 15 });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.code).toBe('VALIDATION_ERROR');
                    expect(result.details).toHaveLength(2);

                    // Check first error (id)
                    expect(result.details[0]?.field).toBe('id');
                    expect(result.details[0]?.code).toBe('TOO_SMALL');

                    // Check second error (age)
                    expect(result.details[1]?.field).toBe('age');
                    expect(result.details[1]?.code).toBe('TOO_SMALL');
                }
            }
        });

        it('should handle nested object errors correctly', () => {
            const schema = z.object({
                user: z.object({
                    name: z.string().min(2),
                    email: z.string().email()
                })
            });

            try {
                schema.parse({
                    user: {
                        name: 'A',
                        email: 'invalid-email'
                    }
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.code).toBe('VALIDATION_ERROR');
                    expect(result.details).toHaveLength(2);

                    // Check nested field paths
                    expect(result.details[0]?.field).toBe('user.name');
                    expect(result.details[1]?.field).toBe('user.email');
                }
            }
        });

        it('should handle unknown error codes gracefully', () => {
            const schema = z.object({
                field: z.string().refine(() => false, { message: 'Custom error' })
            });

            try {
                schema.parse({ field: 'test' });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.code).toBe('VALIDATION_ERROR');
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]?.code).toBe('CUSTOM_VALIDATION_ERROR');
                    expect(result.details[0]?.messageKey).toBe('validationError.field.customError');
                }
            }
        });
        it('should provide user-friendly messages and suggestions', () => {
            const schema = z.object({
                firstName: z.string().min(2).max(50),
                email: z.string().email(),
                age: z.number().min(18),
                status: z.enum(['active', 'inactive', 'pending'])
            });

            try {
                schema.parse({
                    firstName: 'A',
                    email: 'invalid-email',
                    age: '16',
                    status: 'unknown'
                });
            } catch (error) {
                if (error instanceof z.ZodError) {
                    const result = transformZodError(error);

                    expect(result.userFriendlyMessage).toBe(
                        'Please fix the 4 validation errors in 4 fields'
                    );
                    expect(result.summary.totalErrors).toBe(4);
                    expect(result.summary.fieldCount).toBe(4);

                    // Check user-friendly messages
                    const firstNameError = result.details.find((e) => e.field === 'firstName');
                    expect(firstNameError?.userFriendlyMessage).toBe(
                        'First name must be at least 2 characters long'
                    );
                    expect(firstNameError?.suggestion).toBe(
                        'Try adding more characters. Minimum required: 2'
                    );

                    const emailError = result.details.find((e) => e.field === 'email');
                    expect(emailError?.userFriendlyMessage).toBe(
                        'Email must be a valid email address'
                    );
                    expect(emailError?.suggestion).toBe('Use format: name@domain.com');

                    const ageError = result.details.find((e) => e.field === 'age');
                    expect(ageError?.userFriendlyMessage).toBe(
                        'Age must be a number (received string)'
                    );
                    expect(ageError?.suggestion).toBe('Remove quotes if this should be a number');

                    const statusError = result.details.find((e) => e.field === 'status');
                    expect(statusError?.userFriendlyMessage).toBe(
                        'Status must be one of: active, inactive, pending'
                    );
                    expect(statusError?.suggestion).toBe(
                        'Try one of these: active, inactive, pending'
                    );
                }
            }
        });
    });

    describe('transformZodError schema key preference', () => {
        it('uses zodError.* message as primary message field when present', () => {
            // Arrange
            const schema = z.object({
                name: z.string().min(2, 'zodError.amenity.name.min')
            });
            const result = schema.safeParse({ name: 'a' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert - the messageKey should be the schema's zodError.* key, not the generic map key
            expect(detail?.messageKey).toBe('zodError.amenity.name.min');
        });

        it('falls back to ZOD_ERROR_MESSAGE_MAP generic key when no zodError.* prefix', () => {
            // Arrange
            const schema = z.object({
                name: z.string().min(2, 'Name must be at least 2 chars')
            });
            const result = schema.safeParse({ name: 'a' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert - non-zodError.* custom messages fall back to the generic translation key
            expect(detail?.messageKey).toBe('validationError.field.tooSmall');
        });

        it('falls back to generic key when no custom message at all', () => {
            // Arrange
            const schema = z.object({
                name: z.string().min(2)
            });
            const result = schema.safeParse({ name: 'a' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert - absence of custom message yields the generic translation key
            expect(detail?.messageKey).toBe('validationError.field.tooSmall');
        });
    });

    describe('Zod v4 new error codes (GAP-027)', () => {
        it('should transform invalid_union error correctly', () => {
            // Arrange
            const schema = z.object({
                value: z.union([z.string(), z.number()])
            });
            const result = schema.safeParse({ value: true });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail).toBeDefined();
            expect(detail?.code).toBe('INVALID_UNION');
            expect(detail?.messageKey).toBe('validationError.field.invalidUnion');
            expect(detail?.userFriendlyMessage).toContain('did not match any of the');
            expect(detail?.suggestion).toBe(
                'Check the API documentation for the accepted formats and provide a valid value'
            );
        });

        it('should transform invalid_key error correctly', () => {
            // Arrange — z.record with key validation triggers invalid_key in Zod v4
            const schema = z.record(z.string().min(2), z.number());
            const result = schema.safeParse({ a: 1 }); // key 'a' is too short

            // If Zod v4 emits invalid_key we verify the mapping; otherwise verify graceful fallback
            if (!result.success) {
                // Act
                const transformed = transformZodError(result.error);
                const detail = transformed.details[0];

                // Assert — code must be either INVALID_KEY (v4) or TOO_SMALL (v3 fallback)
                expect(detail).toBeDefined();
                expect(['INVALID_KEY', 'TOO_SMALL']).toContain(detail?.code);
                if (detail?.code === 'INVALID_KEY') {
                    expect(detail?.messageKey).toBe('validationError.field.invalidKey');
                    expect(detail?.userFriendlyMessage).toContain('invalid key');
                    expect(detail?.suggestion).toBe(
                        'Use only the keys defined in the schema for this object'
                    );
                }
            }
        });

        it('should transform invalid_element error correctly', () => {
            // Arrange — tuple with wrong element type triggers invalid_element in Zod v4
            const schema = z.tuple([z.string(), z.number()]);
            const result = schema.safeParse(['hello', 'not-a-number']);

            if (!result.success) {
                // Act
                const transformed = transformZodError(result.error);
                const detail = transformed.details.find(
                    (d) => d.code === 'INVALID_ELEMENT' || d.code === 'INVALID_TYPE'
                );

                // Assert — either INVALID_ELEMENT (v4) or INVALID_TYPE (v3 fallback)
                expect(detail).toBeDefined();
                if (detail?.code === 'INVALID_ELEMENT') {
                    expect(detail?.messageKey).toBe('validationError.field.invalidElement');
                    expect(detail?.userFriendlyMessage).toContain('invalid element');
                    expect(detail?.suggestion).toBe(
                        'Ensure each element in the list matches the expected type or format'
                    );
                }
            }
        });
    });

    describe('error code coverage batch 1 (GAP-003/016, T-012)', () => {
        it('should map missing required field (invalid_type received undefined) correctly', () => {
            // Arrange
            const schema = z.object({ name: z.string() });
            const result = schema.safeParse({});
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('INVALID_TYPE');
            expect(detail?.messageKey).toBe('validationError.field.invalidType');
            expect(detail?.params?.received).toBeDefined();
        });

        it('should map too_small for number type correctly', () => {
            // Arrange
            const schema = z.object({ age: z.number().min(18) });
            const result = schema.safeParse({ age: 5 });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('TOO_SMALL');
            expect(detail?.params?.min).toBe(18);
            expect(detail?.userFriendlyMessage).toContain('at least 18');
            expect(detail?.suggestion).toContain('18 or higher');
        });

        it('should map too_big for string type correctly', () => {
            // Arrange
            const schema = z.object({ bio: z.string().max(10) });
            const result = schema.safeParse({
                bio: 'This is a very long bio that exceeds the limit'
            });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('TOO_BIG');
            expect(detail?.params?.max).toBe(10);
            expect(detail?.userFriendlyMessage).toContain('cannot exceed 10 characters');
            expect(detail?.suggestion).toContain('Maximum allowed: 10');
        });

        it('should map too_big for number type correctly', () => {
            // Arrange
            const schema = z.object({ score: z.number().max(100) });
            const result = schema.safeParse({ score: 150 });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('TOO_BIG');
            expect(detail?.params?.max).toBe(100);
            expect(detail?.userFriendlyMessage).toContain('greater than 100');
            expect(detail?.suggestion).toContain('100 or lower');
        });

        it('should map invalid_string with regex validation correctly', () => {
            // Arrange
            const schema = z.object({ code: z.string().regex(/^\d{5}$/) });
            const result = schema.safeParse({ code: 'abc' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(['INVALID_STRING', 'INVALID_FORMAT']).toContain(detail?.code);
            expect(detail?.userFriendlyMessage).toContain('format is invalid');
        });

        it('should map invalid_format or invalid_string for URL validation', () => {
            // Arrange
            const schema = z.object({ website: z.string().url() });
            const result = schema.safeParse({ website: 'not-a-url' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert — Zod v3 uses invalid_string, Zod v4 uses invalid_format
            expect(['INVALID_STRING', 'INVALID_FORMAT']).toContain(detail?.code);
            expect(detail?.userFriendlyMessage).toContain('valid web address');
        });

        it('should map invalid_enum_value correctly', () => {
            // Arrange
            const schema = z.object({ status: z.enum(['active', 'inactive', 'pending']) });
            const result = schema.safeParse({ status: 'unknown' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(['INVALID_ENUM_VALUE', 'INVALID_VALUE']).toContain(detail?.code);
            expect(detail?.userFriendlyMessage).toContain('one of:');
        });

        it('should map too_small for array type correctly', () => {
            // Arrange
            const schema = z.object({ items: z.array(z.string()).min(2) });
            const result = schema.safeParse({ items: ['only-one'] });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('TOO_SMALL');
            expect(detail?.params?.min).toBe(2);
            // Note: array type detection depends on Zod runtime attaching `origin: 'array'`
            // the userFriendlyMessage varies but must exist
            expect(detail?.userFriendlyMessage).toBeDefined();
        });
    });

    describe('error code coverage batch 2 (GAP-003/016, T-013)', () => {
        it('should map invalid_format or invalid_string for email validation', () => {
            // Arrange
            const schema = z.object({ email: z.string().email() });
            const result = schema.safeParse({ email: 'not-an-email' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert — Zod v3 → INVALID_STRING, Zod v4 → INVALID_FORMAT
            expect(['INVALID_STRING', 'INVALID_FORMAT']).toContain(detail?.code);
            expect(detail?.userFriendlyMessage).toContain('valid email address');
            expect(detail?.suggestion).toBe('Use format: name@domain.com');
        });

        it('should map invalid_format or invalid_string for UUID validation', () => {
            // Arrange
            const schema = z.object({ id: z.string().uuid() });
            const result = schema.safeParse({ id: 'not-a-uuid' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(['INVALID_STRING', 'INVALID_FORMAT', 'INVALID_UUID']).toContain(detail?.code);
            expect(detail?.userFriendlyMessage).toContain('valid UUID');
        });

        it('should produce correct messageKey for too_big number', () => {
            // Arrange — verify translation key (separate from code coverage)
            const schema = z.object({ count: z.number().max(5) });
            const result = schema.safeParse({ count: 10 });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.messageKey).toBe('validationError.field.tooBig');
        });

        it('should handle invalid_type for boolean expected', () => {
            // Arrange
            const schema = z.object({ active: z.boolean() });
            const result = schema.safeParse({ active: 'yes' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('INVALID_TYPE');
            expect(detail?.userFriendlyMessage).toContain('true or false');
            expect(detail?.suggestion).toContain('true or false');
        });

        it('should handle invalid_type for array expected', () => {
            // Arrange
            const schema = z.object({ tags: z.array(z.string()) });
            const result = schema.safeParse({ tags: 'not-an-array' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('INVALID_TYPE');
            expect(detail?.userFriendlyMessage).toContain('must be a list');
            expect(detail?.suggestion).toContain('square brackets');
        });

        it('should handle custom validation error (refine) with messageKey set to customError', () => {
            // Arrange — custom refine error without zodError.* prefix
            const schema = z.object({
                password: z.string().refine((val) => val.length >= 8, {
                    message: 'Password is too short'
                })
            });
            const result = schema.safeParse({ password: 'short' });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);
            const detail = transformed.details[0];

            // Assert
            expect(detail?.code).toBe('CUSTOM_VALIDATION_ERROR');
            expect(detail?.messageKey).toBe('validationError.field.customError');
            // The zodMessage should be the custom message provided to refine
            expect(detail?.zodMessage).toBe('Password is too short');
        });

        it('should include summary with correct fieldCount across multiple fields', () => {
            // Arrange
            const schema = z.object({
                name: z.string().min(2),
                email: z.string().email(),
                age: z.number().min(18)
            });
            const result = schema.safeParse({ name: 'A', email: 'bad', age: 5 });
            if (result.success) throw new Error('Expected failure');

            // Act
            const transformed = transformZodError(result.error);

            // Assert
            expect(transformed.summary.totalErrors).toBe(3);
            expect(transformed.summary.fieldCount).toBe(3);
            expect(transformed.summary.mostCommonError).toBeDefined();
            expect(typeof transformed.summary.errorsByField).toBe('object');
        });
    });

    describe('generateOverallMessage edge cases (GAP-024)', () => {
        it('returns "No validation errors found" when ZodError has empty issues array', () => {
            // Arrange: ZodError with zero issues (edge case guard added in T-009)
            const emptyError = new ZodError([]);

            // Act
            const result = transformZodError(emptyError);

            // Assert
            expect(result.summary.totalErrors).toBe(0);
            expect(result.userFriendlyMessage).toBe('No validation errors found');
        });
    });
});
