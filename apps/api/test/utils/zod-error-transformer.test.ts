/**
 * Tests for Zod Error Transformer
 * Tests the transformation of Zod errors into client-friendly format
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
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
                    expect(result.message).toBe('validationError.validation.failed');
                    expect(result.translatedMessage).toBe('Validation failed');
                    expect(result.userFriendlyMessage).toBe(
                        'Please fix the validation error below'
                    );
                    expect(result.summary).toBeDefined();
                    expect(result.summary.totalErrors).toBe(1);
                    expect(result.summary.fieldCount).toBe(1);
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]).toEqual({
                        field: 'id',
                        message: 'validationError.field.tooSmall',
                        translatedMessage: 'Too small: expected string to have >=3 characters',
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
                        message: 'validationError.field.invalidType',
                        translatedMessage: 'Invalid input: expected number, received string',
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
                    expect(result.details[0]?.message).toBe('validationError.field.customError');
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
});
