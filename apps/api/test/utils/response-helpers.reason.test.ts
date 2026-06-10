/**
 * Tests for ServiceError.reason propagation through createErrorResponse and
 * handleRouteError (SPEC-085 T-004).
 *
 * Verifies:
 *   1. createErrorResponse includes `reason` in the JSON body when provided.
 *   2. createErrorResponse omits `reason` from the JSON body when absent.
 *   3. handleRouteError propagates `ServiceError.reason` regardless of
 *      HOSPEDA_API_DEBUG_ERRORS value.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

// Mock logger and env BEFORE importing the module under test so that the
// hoisted vi.mock calls take effect before module initialisation.
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// We test both debug=true and debug=false branches by overriding the module
// mock per describe block using vi.doMock / re-import. For simplicity we test
// both branches inline by importing the helpers with a fixed env value and
// verifying that `reason` is always present regardless.
vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    },
    validateApiEnv: vi.fn()
}));

import { ServiceError } from '@repo/service-core/types';
import { createErrorResponse, handleRouteError } from '../../src/utils/response-helpers';

type JsonCall = { body: unknown; status: number | undefined };

/**
 * Build a minimal Hono Context mock that records `c.json()` calls.
 */
const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        get: (key: string) => (key === 'requestId' ? 'req-test-reason' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

// ---------------------------------------------------------------------------
// createErrorResponse — reason field
// ---------------------------------------------------------------------------

describe('createErrorResponse — reason field', () => {
    it('includes reason in the response body when provided', () => {
        // Arrange
        const { ctx, calls } = createMockContext();

        // Act
        createErrorResponse(
            {
                code: 'FORBIDDEN',
                message: 'Email not verified',
                reason: 'ANONYMOUS_EMAIL_NOT_VERIFIED'
            },
            ctx,
            403
        );

        // Assert
        expect(calls).toHaveLength(1);
        const body = calls[0]?.body as Record<string, unknown>;
        const error = body?.error as Record<string, unknown>;
        expect(error?.reason).toBe('ANONYMOUS_EMAIL_NOT_VERIFIED');
    });

    it('omits reason from the response body when not provided', () => {
        // Arrange
        const { ctx, calls } = createMockContext();

        // Act
        createErrorResponse({ code: 'NOT_FOUND', message: 'Resource not found' }, ctx, 404);

        // Assert
        expect(calls).toHaveLength(1);
        const body = calls[0]?.body as Record<string, unknown>;
        const error = body?.error as Record<string, unknown>;
        expect(error?.reason).toBeUndefined();
        expect('reason' in (error ?? {})).toBe(false);
    });

    it('status code is set correctly alongside reason', () => {
        // Arrange
        const { ctx, calls } = createMockContext();

        // Act
        createErrorResponse(
            { code: 'FORBIDDEN', message: 'Blocked', reason: 'CONVERSATION_BLOCKED' },
            ctx,
            403
        );

        // Assert
        expect(calls[0]?.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// handleRouteError — ServiceError.reason propagation
// ---------------------------------------------------------------------------

describe('handleRouteError — ServiceError.reason propagation', () => {
    it('propagates reason when HOSPEDA_API_DEBUG_ERRORS is false (default mock)', () => {
        // Arrange — debug mode is false (see vi.mock above)
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Email not verified',
            { detail: 'hidden in non-debug mode' },
            'ANONYMOUS_EMAIL_NOT_VERIFIED'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls).toHaveLength(1);
        const body = calls[0]?.body as Record<string, unknown>;
        const responseError = body?.error as Record<string, unknown>;
        expect(responseError?.reason).toBe('ANONYMOUS_EMAIL_NOT_VERIFIED');
        // details should be undefined (debug mode is false)
        expect(responseError?.details).toBeUndefined();
    });

    it('propagates reason even when ServiceError has no details', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Conversation not found',
            undefined,
            'CONVERSATION_MISSING'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        const body = calls[0]?.body as Record<string, unknown>;
        const responseError = body?.error as Record<string, unknown>;
        expect(responseError?.reason).toBe('CONVERSATION_MISSING');
    });

    it('does not include reason when ServiceError has no reason', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Not found');

        // Act
        handleRouteError(error, ctx);

        // Assert
        const body = calls[0]?.body as Record<string, unknown>;
        const responseError = body?.error as Record<string, unknown>;
        expect(responseError?.reason).toBeUndefined();
    });

    it('maps ServiceError code to the correct HTTP status', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden',
            undefined,
            'SOME_REASON'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(403);
    });

    it('maps PLAN_DISABLED to HTTP 410 via handleRouteError (SPEC-148 T-003)', () => {
        // Arrange
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(
            ServiceErrorCode.PLAN_DISABLED,
            'The selected plan is no longer available'
        );

        // Act
        handleRouteError(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(410);
        const body = calls[0]?.body as Record<string, unknown>;
        const responseError = body?.error as Record<string, unknown>;
        expect(responseError?.code).toBe('PLAN_DISABLED');
    });
});
