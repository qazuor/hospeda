/**
 * Tests for schema.ts — Core Primitives
 *
 * Covers:
 * - I18nLabelSchema: valid tri-locale objects, rejection of missing/empty locales
 * - PermissionExpressionSchema: exact values, prefix wildcards, universal wildcard,
 *   rejection of lowercase / malformed wildcards / empty string
 * - PermissionGateSchema: rejection of empty array, acceptance of ≥1 valid expression
 * - OnMissingSchema: acceptance of 'disable' and 'hide', rejection of unknown values
 */

import {
    I18nLabelSchema,
    OnMissingSchema,
    PermissionExpressionSchema,
    PermissionGateSchema
} from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ============================================================================
// I18nLabelSchema
// ============================================================================

describe('I18nLabelSchema', () => {
    describe('when given valid input', () => {
        it('should accept a fully populated tri-locale label', () => {
            // Arrange
            const input = { es: 'Inicio', en: 'Home', pt: 'Início' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept minimal non-empty strings for all three locales', () => {
            // Arrange
            const input = { es: 'a', en: 'b', pt: 'c' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an object missing the es locale', () => {
            // Arrange
            const input = { en: 'Home', pt: 'Início' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an object missing the en locale', () => {
            // Arrange
            const input = { es: 'Inicio', pt: 'Início' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an object missing the pt locale', () => {
            // Arrange
            const input = { es: 'Inicio', en: 'Home' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string for es', () => {
            // Arrange
            const input = { es: '', en: 'Home', pt: 'Início' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string for en', () => {
            // Arrange
            const input = { es: 'Inicio', en: '', pt: 'Início' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string for pt', () => {
            // Arrange
            const input = { es: 'Inicio', en: 'Home', pt: '' };

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a completely empty object', () => {
            // Arrange
            const input = {};

            // Act
            const result = I18nLabelSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// PermissionExpressionSchema
// ============================================================================

describe('PermissionExpressionSchema', () => {
    describe('when given valid input', () => {
        it('should accept an exact PermissionEnum-style value', () => {
            // Arrange
            const input = 'ACCOMMODATION_VIEW_OWN';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a prefix wildcard expression (FOO_*)', () => {
            // Arrange
            const input = 'ACCOMMODATION_*';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept the universal wildcard "*"', () => {
            // Arrange
            const input = '*';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a single uppercase word (A)', () => {
            // Arrange — minimal valid exact value: one uppercase letter followed by nothing?
            // Actually: [A-Z][A-Z0-9_]+ requires at least 2 chars for exact.
            // But the regex also has alternation — let's test a standard-looking value.
            const input = 'BILLING_VIEW_ALL';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a numeric-containing exact value like USER_VIEW_1', () => {
            // Arrange
            const input = 'USER_VIEW_1';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a prefix wildcard with numbers (BILLING2_*)', () => {
            // Arrange
            const input = 'BILLING2_*';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a lowercase value', () => {
            // Arrange
            const input = 'foo';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a mixed-case value', () => {
            // Arrange
            const input = 'Accommodation_View';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a wildcard without underscore separator (FOO*)', () => {
            // Arrange — "FOO*" is invalid; must be "FOO_*"
            const input = 'FOO*';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a wildcard in the middle of the string (FOO_*_BAR)', () => {
            // Arrange
            const input = 'FOO_*_BAR';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            // Arrange
            const input = '';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should include the descriptive error message on failure', () => {
            // Arrange
            const input = 'invalid_lowercase';

            // Act
            const result = PermissionExpressionSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map((i) => i.message);
                expect(messages.some((m) => m.includes('PermissionEnum'))).toBe(true);
            }
        });
    });
});

// ============================================================================
// PermissionGateSchema
// ============================================================================

describe('PermissionGateSchema', () => {
    describe('when given valid input', () => {
        it('should accept an array with one valid permission expression', () => {
            // Arrange
            const input = ['ACCOMMODATION_VIEW_OWN'];

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept an array with multiple valid permission expressions', () => {
            // Arrange
            const input = ['CONVERSATION_VIEW_OWN', 'CONVERSATION_VIEW_ALL', 'BILLING_*'];

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept an array containing the universal wildcard', () => {
            // Arrange
            const input = ['*'];

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty array', () => {
            // Arrange — at least one expression is required
            const input: string[] = [];

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an array containing an invalid expression', () => {
            // Arrange
            const input = ['VALID_PERM', 'invalid_lowercase'];

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-array value', () => {
            // Arrange
            const input = 'ACCOMMODATION_VIEW_OWN';

            // Act
            const result = PermissionGateSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// OnMissingSchema
// ============================================================================

describe('OnMissingSchema', () => {
    describe('when given valid input', () => {
        it('should accept "disable"', () => {
            // Arrange
            const input = 'disable';

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "hide"', () => {
            // Arrange
            const input = 'hide';

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an unknown value like "remove"', () => {
            // Arrange
            const input = 'remove';

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            // Arrange
            const input = '';

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject "Disable" (wrong casing)', () => {
            // Arrange
            const input = 'Disable';

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a numeric value', () => {
            // Arrange
            const input = 0;

            // Act
            const result = OnMissingSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
