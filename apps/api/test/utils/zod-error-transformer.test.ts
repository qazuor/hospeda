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
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]).toEqual({
                        field: 'id',
                        message: 'validationError.field.tooSmall',
                        translatedMessage: 'Too small: expected string to have >=3 characters',
                        code: 'TOO_SMALL',
                        params: {
                            min: 3,
                            inclusive: true
                        }
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
                    expect(result.details).toHaveLength(1);
                    expect(result.details[0]).toEqual({
                        field: 'age',
                        message: 'validationError.field.invalidType',
                        translatedMessage: 'Invalid input: expected number, received string',
                        code: 'INVALID_TYPE',
                        params: {
                            expected: 'number'
                        }
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
    });
});
