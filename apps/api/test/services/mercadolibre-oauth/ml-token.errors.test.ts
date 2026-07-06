/**
 * Tests for the MercadoLibre OAuth token service error type and classifier.
 *
 * Covers HOS-45 T-007:
 *   - `MLTokenRefreshError` construction and property access.
 *   - `classifyMLRefreshFailure` passthrough, terminal classification
 *     (invalid refresh token / ML config problems), and transient
 *     classification (network errors, 5xx, unrecognized shapes).
 */
import { describe, expect, it } from 'vitest';
import {
    classifyMLRefreshFailure,
    MLTokenRefreshError
} from '../../../src/services/mercadolibre-oauth/ml-token.errors';

describe('MLTokenRefreshError', () => {
    it('should expose message, kind, and name when constructed', () => {
        // Arrange
        const message = 'refresh token rejected';

        // Act
        const error = new MLTokenRefreshError(message, 'terminal');

        // Assert
        expect(error.message).toBe(message);
        expect(error.kind).toBe('terminal');
        expect(error.name).toBe('MLTokenRefreshError');
        expect(error).toBeInstanceOf(Error);
    });

    it('should chain the original error as cause when provided', () => {
        // Arrange
        const originalError = new Error('network timeout');

        // Act
        const error = new MLTokenRefreshError('transient failure', 'transient', {
            cause: originalError
        });

        // Assert
        expect(error.cause).toBe(originalError);
    });

    it('should leave cause undefined when no options are provided', () => {
        // Arrange & Act
        const error = new MLTokenRefreshError('no cause here', 'transient');

        // Assert
        expect(error.cause).toBeUndefined();
    });
});

describe('classifyMLRefreshFailure', () => {
    describe('passthrough', () => {
        it('should return the same instance when given an existing MLTokenRefreshError', () => {
            // Arrange
            const original = new MLTokenRefreshError('already classified', 'terminal');

            // Act
            const result = classifyMLRefreshFailure(original);

            // Assert
            expect(result).toBe(original);
        });
    });

    describe('terminal classification', () => {
        it.each([400, 401, 403, 404])('should classify a status %d shape as terminal', (status) => {
            // Arrange
            const fakeHttpError = { status, message: `HTTP ${status}` };

            // Act
            const result = classifyMLRefreshFailure(fakeHttpError);

            // Assert
            expect(result.kind).toBe('terminal');
            expect(result).toBeInstanceOf(MLTokenRefreshError);
            expect(result.cause).toBe(fakeHttpError);
        });

        it('should classify a nested response.status 401 shape as terminal', () => {
            // Arrange
            const fakeHttpError = { response: { status: 401 } };

            // Act
            const result = classifyMLRefreshFailure(fakeHttpError);

            // Assert
            expect(result.kind).toBe('terminal');
        });

        it('should classify an invalid_grant OAuth error body as terminal', () => {
            // Arrange
            const fakeOAuthError = {
                body: { error: 'invalid_grant', error_description: 'refresh_token not found' }
            };

            // Act
            const result = classifyMLRefreshFailure(fakeOAuthError);

            // Assert
            expect(result.kind).toBe('terminal');
            expect(result.message).toContain('invalid_grant');
        });

        it('should classify an invalid_client OAuth error body as terminal', () => {
            // Arrange
            const fakeOAuthError = { data: { error: 'invalid_client' } };

            // Act
            const result = classifyMLRefreshFailure(fakeOAuthError);

            // Assert
            expect(result.kind).toBe('terminal');
        });
    });

    describe('transient classification', () => {
        it('should classify a generic Error as transient', () => {
            // Arrange
            const networkError = new Error('network timeout');

            // Act
            const result = classifyMLRefreshFailure(networkError);

            // Assert
            expect(result.kind).toBe('transient');
            expect(result.message).toContain('network timeout');
            expect(result.cause).toBe(networkError);
        });

        it('should classify a status 500 shape as transient', () => {
            // Arrange
            const fakeHttpError = { status: 500, message: 'Internal Server Error' };

            // Act
            const result = classifyMLRefreshFailure(fakeHttpError);

            // Assert
            expect(result.kind).toBe('transient');
        });

        it('should classify an unrecognized error shape as transient by default', () => {
            // Arrange
            const weirdShape = { foo: 'bar' };

            // Act
            const result = classifyMLRefreshFailure(weirdShape);

            // Assert
            expect(result.kind).toBe('transient');
        });

        it('should classify a primitive non-object value as transient', () => {
            // Arrange
            const primitiveError = 'just a string';

            // Act
            const result = classifyMLRefreshFailure(primitiveError);

            // Assert
            expect(result.kind).toBe('transient');
            expect(result.cause).toBe(primitiveError);
        });
    });
});
