/**
 * Tests for parseApiValidationErrors utility.
 *
 * Verifies that the function correctly parses the standardized API validation
 * error envelope and maps field-level details to translated messages.
 */

import { describe, expect, it } from 'vitest';
import {
    ApiValidationErrorSchema,
    parseApiValidationErrors
} from '../../../src/lib/errors/parse-api-validation-errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Identity translation function: returns the key as-is */
const identityT = (key: string) => key;

/** Translate function that adds a [t] prefix to distinguish translations */
const prefixT = (key: string) => `[t] ${key}`;

/** Build a minimal valid validation error response */
function buildValidationError(details: Array<{ field: string; messageKey: string; code: string }>) {
    return {
        success: false,
        error: {
            code: 'VALIDATION_ERROR',
            messageKey: 'validationError.validation.failed',
            details,
            summary: { totalErrors: details.length, fieldCount: details.length },
            userFriendlyMessage: 'Please fix the validation errors'
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiValidationErrorSchema', () => {
    it('should accept a valid validation error envelope', () => {
        // Arrange
        const input = buildValidationError([
            { field: 'name', messageKey: 'zodError.accommodation.name.min', code: 'TOO_SMALL' }
        ]);

        // Act
        const result = ApiValidationErrorSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should accept an envelope without the `success` flag', () => {
        // Arrange – bare error object (no top-level success)
        const input = {
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'validationError.validation.failed',
                details: [],
                summary: null
            }
        };

        // Act
        const result = ApiValidationErrorSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should default `details` to an empty array when absent', () => {
        // Arrange
        const input = {
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'validationError.validation.failed',
                summary: null
            }
        };

        // Act
        const result = ApiValidationErrorSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.error.details).toEqual([]);
        }
    });

    it('should reject an input missing the `error` key', () => {
        // Arrange
        const input = { success: false, message: 'Something went wrong' };

        // Act
        const result = ApiValidationErrorSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });

    it('should reject a detail entry missing the `field` key', () => {
        // Arrange
        const input = {
            error: {
                code: 'VALIDATION_ERROR',
                messageKey: 'validationError.validation.failed',
                details: [{ messageKey: 'zodError.x.y', code: 'TOO_SMALL' }],
                summary: null
            }
        };

        // Act
        const result = ApiValidationErrorSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('parseApiValidationErrors', () => {
    describe('valid error response', () => {
        it('should return translated messages keyed by field name', () => {
            // Arrange
            const error = buildValidationError([
                { field: 'name', messageKey: 'zodError.accommodation.name.min', code: 'TOO_SMALL' }
            ]);

            // Act
            const result = parseApiValidationErrors({ error, t: prefixT });

            // Assert
            expect(result).toEqual({
                name: '[t] zodError.accommodation.name.min'
            });
        });

        it('should handle multiple field errors', () => {
            // Arrange
            const error = buildValidationError([
                { field: 'name', messageKey: 'zodError.accommodation.name.min', code: 'TOO_SMALL' },
                {
                    field: 'slug',
                    messageKey: 'zodError.accommodation.slug.required',
                    code: 'INVALID_TYPE'
                },
                {
                    field: 'address.city',
                    messageKey: 'zodError.accommodation.address.city.required',
                    code: 'INVALID_TYPE'
                }
            ]);

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert
            expect(result).toEqual({
                name: 'zodError.accommodation.name.min',
                slug: 'zodError.accommodation.slug.required',
                'address.city': 'zodError.accommodation.address.city.required'
            });
        });

        it('should use the raw messageKey as fallback when t returns an empty string', () => {
            // Arrange
            const error = buildValidationError([
                {
                    field: 'email',
                    messageKey: 'zodError.user.email.invalid',
                    code: 'INVALID_STRING'
                }
            ]);
            const emptyT = (_key: string) => '';

            // Act
            const result = parseApiValidationErrors({ error, t: emptyT });

            // Assert
            expect(result.email).toBe('zodError.user.email.invalid');
        });

        it('should keep the last entry when a field has duplicate details', () => {
            // Arrange – two errors for the same field
            const error = buildValidationError([
                { field: 'name', messageKey: 'zodError.accommodation.name.min', code: 'TOO_SMALL' },
                { field: 'name', messageKey: 'zodError.accommodation.name.max', code: 'TOO_BIG' }
            ]);

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert – last entry wins
            expect(result.name).toBe('zodError.accommodation.name.max');
        });
    });

    describe('empty details', () => {
        it('should return an empty object when details is an empty array', () => {
            // Arrange
            const error = buildValidationError([]);

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert
            expect(result).toEqual({});
        });
    });

    describe('malformed or non-validation responses', () => {
        it('should return an empty object for null input', () => {
            // Act
            const result = parseApiValidationErrors({ error: null, t: identityT });

            // Assert
            expect(result).toEqual({});
        });

        it('should return an empty object for undefined input', () => {
            // Act
            const result = parseApiValidationErrors({ error: undefined, t: identityT });

            // Assert
            expect(result).toEqual({});
        });

        it('should return an empty object for a plain string', () => {
            // Act
            const result = parseApiValidationErrors({ error: 'Unexpected error', t: identityT });

            // Assert
            expect(result).toEqual({});
        });

        it('should return an empty object for a non-validation API error (e.g. 404)', () => {
            // Arrange – typical non-validation error shape
            const error = {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Resource not found'
                }
            };

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert
            expect(result).toEqual({});
        });

        it('should return an empty object when the response is a network error (no body)', () => {
            // Arrange
            const error = new TypeError('Failed to fetch');

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert
            expect(result).toEqual({});
        });

        it('should return an empty object when details entries are missing required fields', () => {
            // Arrange – details present but each entry lacks `field`
            const error = {
                error: {
                    code: 'VALIDATION_ERROR',
                    messageKey: 'validationError.validation.failed',
                    details: [{ messageKey: 'zodError.x.y.min', code: 'TOO_SMALL' }],
                    summary: null
                }
            };

            // Act
            const result = parseApiValidationErrors({ error, t: identityT });

            // Assert
            expect(result).toEqual({});
        });
    });
});
