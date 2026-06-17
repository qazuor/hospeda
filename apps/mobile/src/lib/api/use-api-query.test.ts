/**
 * @file use-api-query.test.ts
 * @description Unit tests for the TanStack Query retry predicate and QueryClient
 * defaults defined in `query-client.ts`.
 *
 * ## Scope
 *
 * These tests cover pure logic only (no React Native runtime required):
 * - `shouldRetry` predicate from `query-client.ts`
 * - `queryClient` default staleTime / gcTime / retry configuration
 *
 * ## Out of scope (T-013)
 *
 * Hook integration tests (`useApiQuery`, `useApiMutation`) require
 * `renderHook` from `@testing-library/react-native` and a complete RN
 * test environment. That setup is deferred to T-013 (RN testing harness).
 * Add those tests in `src/lib/api/use-api-query.integration.test.tsx`
 * once T-013 is complete.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { queryClient, shouldRetry } from './query-client';

// ---------------------------------------------------------------------------
// shouldRetry predicate
// ---------------------------------------------------------------------------

describe('shouldRetry', () => {
    describe('ApiError — client error statuses (no retry)', () => {
        it('does NOT retry ApiError with status 400 (bad request)', () => {
            const error = new ApiError(400, { code: 'VALIDATION_ERROR', message: 'Invalid input' });
            expect(shouldRetry(1, error)).toBe(false);
        });

        it('does NOT retry ApiError with status 401 (unauthorized)', () => {
            const error = new ApiError(401, { code: 'UNAUTHORIZED', message: 'Not authenticated' });
            expect(shouldRetry(1, error)).toBe(false);
        });

        it('does NOT retry ApiError with status 403 (forbidden)', () => {
            const error = new ApiError(403, { code: 'FORBIDDEN', message: 'Access denied' });
            expect(shouldRetry(1, error)).toBe(false);
        });

        it('does NOT retry ApiError with status 404 (not found)', () => {
            const error = new ApiError(404, { code: 'NOT_FOUND', message: 'Resource not found' });
            expect(shouldRetry(1, error)).toBe(false);
        });

        it('does NOT retry ApiError with status 422 (unprocessable entity)', () => {
            const error = new ApiError(422, {
                code: 'UNPROCESSABLE_ENTITY',
                message: 'Semantic error'
            });
            expect(shouldRetry(1, error)).toBe(false);
        });

        it('does not retry regardless of failureCount for 401', () => {
            const error = new ApiError(401, { code: 'UNAUTHORIZED', message: 'Session expired' });
            // Even on the first failure, no retry
            expect(shouldRetry(0, error)).toBe(false);
            expect(shouldRetry(1, error)).toBe(false);
            expect(shouldRetry(2, error)).toBe(false);
        });
    });

    describe('ApiError — server error statuses (retry allowed)', () => {
        it('DOES retry ApiError with status 500 (internal server error)', () => {
            const error = new ApiError(500, { code: 'INTERNAL_ERROR', message: 'Server crashed' });
            expect(shouldRetry(1, error)).toBe(true);
        });

        it('DOES retry ApiError with status 502 (bad gateway)', () => {
            const error = new ApiError(502, { code: 'BAD_GATEWAY', message: 'Upstream error' });
            expect(shouldRetry(1, error)).toBe(true);
        });

        it('DOES retry ApiError with status 503 (service unavailable)', () => {
            const error = new ApiError(503, {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Temporarily unavailable'
            });
            expect(shouldRetry(1, error)).toBe(true);
        });
    });

    describe('generic Error (network failure)', () => {
        it('DOES retry when the error is a generic Error (network failure)', () => {
            const error = new Error('Network request failed');
            expect(shouldRetry(1, error)).toBe(true);
        });

        it('DOES retry when the error is a TypeError (fetch failed)', () => {
            const error = new TypeError('Failed to fetch');
            expect(shouldRetry(1, error)).toBe(true);
        });
    });

    describe('retry attempt cap (max 3)', () => {
        it('returns true on failureCount 1 (first retry attempt allowed)', () => {
            const error = new Error('Network error');
            expect(shouldRetry(1, error)).toBe(true);
        });

        it('returns true on failureCount 2 (second retry attempt allowed)', () => {
            const error = new Error('Network error');
            expect(shouldRetry(2, error)).toBe(true);
        });

        it('returns false on failureCount 3 (third retry exhausted)', () => {
            const error = new Error('Network error');
            // failureCount 3 means we've already tried 3 times — do NOT retry again
            expect(shouldRetry(3, error)).toBe(false);
        });

        it('returns false on failureCount > 3', () => {
            const error = new Error('Network error');
            expect(shouldRetry(4, error)).toBe(false);
            expect(shouldRetry(10, error)).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// queryClient defaults
// ---------------------------------------------------------------------------

describe('queryClient defaults', () => {
    const defaults = queryClient.getDefaultOptions();

    it('has staleTime of 5 minutes', () => {
        expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
    });

    it('has gcTime of 10 minutes', () => {
        expect(defaults.queries?.gcTime).toBe(10 * 60 * 1000);
    });

    it('has refetchOnWindowFocus disabled', () => {
        expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    });

    it('has refetchOnReconnect enabled', () => {
        expect(defaults.queries?.refetchOnReconnect).toBe(true);
    });

    it('uses the shouldRetry predicate for queries', () => {
        // The retry option should be our exported shouldRetry function
        expect(defaults.queries?.retry).toBe(shouldRetry);
    });

    it('disables retry for mutations', () => {
        expect(defaults.mutations?.retry).toBe(false);
    });
});
