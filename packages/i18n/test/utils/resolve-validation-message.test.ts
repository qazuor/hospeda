/**
 * Unit tests for resolveValidationMessage utility.
 *
 * Verifies the prefix-stripping logic, passthrough behaviour,
 * params forwarding, missing-translation fallback, and edge cases.
 */

import { describe, expect, it, vi } from 'vitest';
import { resolveValidationMessage } from '../../src/utils/resolve-validation-message';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock translation function that returns `translated:<key>` so that
 * the mapped i18n key is directly visible in assertions.
 */
const createMockT = () => {
    return vi.fn((key: string, _params?: Record<string, unknown>) => {
        return `translated:${key}`;
    });
};

/**
 * Creates a mock translation function that always returns a `[MISSING: ...]`
 * string, simulating a key that has no translation entry.
 */
const createMissingT = (key: string) => {
    return vi.fn((_k: string, _params?: Record<string, unknown>) => {
        return `[MISSING: ${key}]`;
    });
};

// ---------------------------------------------------------------------------
// resolveValidationMessage
// ---------------------------------------------------------------------------

describe('resolveValidationMessage', () => {
    describe('when key has the zodError prefix', () => {
        it('should strip prefix and call t with validation. namespace', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'zodError.amenity.name.min';

            // Act
            const result = resolveValidationMessage({ key, t: mockT });

            // Assert
            expect(mockT).toHaveBeenCalledWith('validation.amenity.name.min', undefined);
            expect(result).toBe('translated:validation.amenity.name.min');
        });

        it('should handle underscore naming inside the key', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'zodError.common.id.invalid_uuid';

            // Act
            const result = resolveValidationMessage({ key, t: mockT });

            // Assert
            expect(mockT).toHaveBeenCalledWith('validation.common.id.invalid_uuid', undefined);
            expect(result).toBe('translated:validation.common.id.invalid_uuid');
        });

        it('should forward params to t when prefix is zodError', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'zodError.accommodation.name.min';
            const params = { min: 3 };

            // Act
            const result = resolveValidationMessage({ key, t: mockT, params });

            // Assert
            expect(mockT).toHaveBeenCalledWith('validation.accommodation.name.min', params);
            expect(result).toBe('translated:validation.accommodation.name.min');
        });
    });

    describe('when key has the validationError prefix', () => {
        it('should strip prefix and call t with validation. namespace', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'validationError.field.tooSmall';

            // Act
            const result = resolveValidationMessage({ key, t: mockT });

            // Assert
            expect(mockT).toHaveBeenCalledWith('validation.field.tooSmall', undefined);
            expect(result).toBe('translated:validation.field.tooSmall');
        });

        it('should forward params to t when prefix is validationError', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'validationError.email.invalid';
            const params = { field: 'email' };

            // Act
            const result = resolveValidationMessage({ key, t: mockT, params });

            // Assert
            expect(mockT).toHaveBeenCalledWith('validation.email.invalid', params);
            expect(result).toBe('translated:validation.email.invalid');
        });
    });

    describe('when key has no recognised prefix', () => {
        it('should pass the key to t as-is', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'some.arbitrary.key';

            // Act
            const result = resolveValidationMessage({ key, t: mockT });

            // Assert
            expect(mockT).toHaveBeenCalledWith('some.arbitrary.key', undefined);
            expect(result).toBe('translated:some.arbitrary.key');
        });

        it('should forward params to t for arbitrary keys', () => {
            // Arrange
            const mockT = createMockT();
            const key = 'errors.generic';
            const params = { code: 42 };

            // Act
            const result = resolveValidationMessage({ key, t: mockT, params });

            // Assert
            expect(mockT).toHaveBeenCalledWith('errors.generic', params);
            expect(result).toBe('translated:errors.generic');
        });
    });

    describe('when translation is missing', () => {
        it('should return the original key when t returns a [MISSING: ...] string for zodError', () => {
            // Arrange
            const originalKey = 'zodError.foo.bar';
            const missingT = createMissingT('validation.foo.bar');

            // Act
            const result = resolveValidationMessage({ key: originalKey, t: missingT });

            // Assert
            expect(result).toBe(originalKey);
        });

        it('should return the original key when t returns [MISSING: ...] for validationError', () => {
            // Arrange
            const originalKey = 'validationError.baz.qux';
            const missingT = createMissingT('validation.baz.qux');

            // Act
            const result = resolveValidationMessage({ key: originalKey, t: missingT });

            // Assert
            expect(result).toBe(originalKey);
        });

        it('should return the original key when t returns [MISSING: ...] for a passthrough key', () => {
            // Arrange
            const originalKey = 'some.unknown.key';
            const missingT = createMissingT('some.unknown.key');

            // Act
            const result = resolveValidationMessage({ key: originalKey, t: missingT });

            // Assert
            expect(result).toBe(originalKey);
        });
    });

    describe('when key is empty', () => {
        it('should return an empty string without calling t', () => {
            // Arrange
            const mockT = createMockT();

            // Act
            const result = resolveValidationMessage({ key: '', t: mockT });

            // Assert
            expect(result).toBe('');
            expect(mockT).not.toHaveBeenCalled();
        });
    });
});
