/**
 * @file change-password.test.ts
 * @description Regression test for HOS-612 — a wrong current password on
 * `POST /api/v1/protected/auth/change-password` answered a raw `HTTPException`
 * carrying only `message: 'Current password is incorrect'`, with no
 * `error.code`. `ChangePasswordForm.client.tsx` already branches on
 * `body.error?.code === 'PASSWORD_INCORRECT'` to show a localized, field-level
 * message — but the code never matched because the route never sent it, so
 * the raw English string leaked through the generic error banner instead.
 *
 * This pins two things:
 * 1. The route itself now throws `ServiceError(ServiceErrorCode.PASSWORD_INCORRECT)`
 *    instead of a bare `HTTPException`.
 * 2. Both wire-format twins (`handleRouteError`, `createErrorHandler`) turn that
 *    `ServiceError` into an HTTP 400 body carrying `error.code === 'PASSWORD_INCORRECT'`
 *    — the exact shape the frontend already expects.
 *
 * @module test/routes/auth/change-password
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports that depend on them).
// ---------------------------------------------------------------------------

// The global test setup (`test/setup.ts`) replaces `@repo/service-core`'s
// top-level export with a mock module whose `ServiceError` is a DIFFERENT
// class than the real one `response-helpers.ts` imports from the
// `@repo/service-core/types` subpath (which stays unmocked). In production
// both paths re-export the identical class, so `instanceof` agrees; under the
// global mock they diverge, and `handleRouteError`'s `instanceof ServiceError`
// check silently falls through to the generic-Error branch (500). Restoring
// the real module here keeps every `ServiceError` reference in this file — the
// route's own throw, and both twin formatters — pointing at the same class.
vi.mock('@repo/service-core', async (importOriginal) => {
    return importOriginal<typeof import('@repo/service-core')>();
});

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    AuditEventType: { AUTH_PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED' },
    auditLog: vi.fn()
}));

const { ACCOUNT_ROW } = vi.hoisted(() => ({
    ACCOUNT_ROW: { id: 'account-1', password: 'hashed-current-password' }
}));

vi.mock('@repo/db', () => {
    const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([ACCOUNT_ROW])
    };
    return {
        getDb: vi.fn(() => ({
            select: vi.fn(() => selectChain)
        })),
        accounts: { id: 'id', userId: 'user_id', providerId: 'provider_id', password: 'password' },
        users: { id: 'id', mustChangePassword: 'must_change_password' }
    };
});

vi.mock('bcryptjs', () => ({
    compare: vi.fn().mockResolvedValue(false),
    hash: vi.fn().mockResolvedValue('new-hashed-password')
}));

vi.mock('../../../src/utils/env', () => ({
    env: { NODE_ENV: 'test', HOSPEDA_API_DEBUG_ERRORS: false },
    validateApiEnv: vi.fn(),
    getResponseConfig: () => ({
        formatEnabled: true,
        includeMetadata: false,
        includeVersion: false,
        includeRequestId: false,
        apiVersion: 'v1',
        errorMessage: 'An unexpected error occurred'
    })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createErrorHandler } from '../../../src/middlewares/response';
import { changePasswordRoute } from '../../../src/routes/auth/change-password';
import { handleRouteError } from '../../../src/utils/response-helpers';

// `createSimpleRoute` is mocked to hand back the handler itself.
const handler = changePasswordRoute as unknown as (c: Context) => Promise<unknown>;

/** Builds a minimal Hono `Context` stub carrying an authenticated actor + body. */
function makeContext(body: unknown): Context {
    return {
        get: vi.fn((key: string) => (key === 'user' ? { id: 'user-1' } : undefined)),
        req: {
            json: vi.fn().mockResolvedValue(body),
            header: vi.fn().mockReturnValue(undefined)
        }
    } as unknown as Context;
}

type Captured = { code: string; status: number | undefined };

/** Minimal response-formatter context capturing the JSON body + status. */
function makeResponseContext(): { ctx: Context; calls: Captured[] } {
    const calls: Captured[] = [];
    const ctx = {
        req: { method: 'POST', path: '/change-password' },
        res: { headers: { get: () => null } },
        get: (key: string) => (key === 'requestId' ? 'req-hos612-1' : undefined),
        json: (jsonBody: unknown, status?: number) => {
            const typed = jsonBody as { error?: { code?: string } };
            calls.push({ code: typed.error?.code ?? '<none>', status });
            return { body: jsonBody, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
}

describe('POST /protected/auth/change-password — PASSWORD_INCORRECT (HOS-612)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws a ServiceError carrying ServiceErrorCode.PASSWORD_INCORRECT, not a bare HTTPException', async () => {
        // Arrange
        const ctx = makeContext({ currentPassword: 'WrongPass1!', newPassword: 'NewPass123!' });

        // Act
        const err = await handler(ctx).catch((caught: unknown) => caught);

        // Assert
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.PASSWORD_INCORRECT);
        expect((err as ServiceError).message).toBe('Current password is incorrect');
    });

    it('formats to HTTP 400 with error.code PASSWORD_INCORRECT through the route-factory formatter', () => {
        // Arrange
        const error = new ServiceError(
            ServiceErrorCode.PASSWORD_INCORRECT,
            'Current password is incorrect'
        );
        const { ctx, calls } = makeResponseContext();

        // Act
        handleRouteError(error, ctx);

        // Assert — this is exactly what ChangePasswordForm.client.tsx branches on
        expect(calls[0]?.status).toBe(400);
        expect(calls[0]?.code).toBe('PASSWORD_INCORRECT');
    });

    it('formats to HTTP 400 with error.code PASSWORD_INCORRECT through the global error handler', () => {
        // Arrange — the twin formatter (app.onError) must agree with the one above
        const error = new ServiceError(
            ServiceErrorCode.PASSWORD_INCORRECT,
            'Current password is incorrect'
        );
        const { ctx, calls } = makeResponseContext();

        // Act
        createErrorHandler()(error, ctx);

        // Assert
        expect(calls[0]?.status).toBe(400);
        expect(calls[0]?.code).toBe('PASSWORD_INCORRECT');
    });
});
