/**
 * Google Calendar OAuth Token Error Classification Tests (HOS-157 Phase 2 — Layer 2)
 *
 * Unit tests for `classifyGoogleRefreshFailure` and the `GoogleTokenRefreshError`
 * class. Verifies terminal-vs-transient classification from HTTP status codes and
 * nested OAuth error codes, and the safe default (transient) for unrecognized
 * shapes.
 *
 * @module test/services/google-calendar/google-token.errors
 */

import { describe, expect, it } from 'vitest';
import {
    classifyGoogleRefreshFailure,
    GoogleTokenRefreshError
} from '../../../src/services/google-calendar/google-token.errors.js';

describe('google-token.errors', () => {
    describe('GoogleTokenRefreshError', () => {
        it('should carry the kind and chain the cause', () => {
            // Arrange
            const cause = new Error('root cause');

            // Act
            const error = new GoogleTokenRefreshError('boom', 'terminal', { cause });

            // Assert
            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe('GoogleTokenRefreshError');
            expect(error.kind).toBe('terminal');
            expect(error.message).toBe('boom');
            expect(error.cause).toBe(cause);
        });
    });

    describe('classifyGoogleRefreshFailure', () => {
        it('should return the same error unchanged when already a GoogleTokenRefreshError', () => {
            // Arrange
            const original = new GoogleTokenRefreshError('already classified', 'transient');

            // Act
            const result = classifyGoogleRefreshFailure(original);

            // Assert
            expect(result).toBe(original);
        });

        it.each([400, 401, 403, 404])('should classify HTTP %s as terminal', (status) => {
            // Arrange
            const error = Object.assign(new Error('http error'), { status });

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('terminal');
            expect(result.cause).toBe(error);
        });

        it.each([500, 502, 503, 504])('should classify HTTP %s as transient', (status) => {
            // Arrange
            const error = Object.assign(new Error('server error'), { status });

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('transient');
        });

        it.each([
            'invalid_grant',
            'invalid_client'
        ])('should classify OAuth error code "%s" (nested under body) as terminal', (oauthError) => {
            // Arrange
            const error = { body: { error: oauthError } };

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('terminal');
            expect(result.message).toContain(oauthError);
        });

        it('should read an OAuth error code nested under a data field', () => {
            // Arrange
            const error = { data: { error: 'invalid_grant' } };

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('terminal');
        });

        it('should classify a status-only 429 as transient (rate limit is retryable)', () => {
            // Arrange
            const error = Object.assign(new Error('rate limited'), { status: 429 });

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('transient');
        });

        it('should default to transient for an unrecognized error shape', () => {
            // Arrange
            const error = new Error('network timeout');

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('transient');
            expect(result.message).toContain('network timeout');
            expect(result.cause).toBe(error);
        });

        it('should read an HTTP status nested under response.status', () => {
            // Arrange
            const error = { response: { status: 401 } };

            // Act
            const result = classifyGoogleRefreshFailure(error);

            // Assert
            expect(result.kind).toBe('terminal');
        });
    });
});
