/**
 * Unit tests for `handleRouteError`'s log level (HOS-622).
 *
 * `handleRouteError` (utils/response-helpers.ts) is the catch inside
 * `createCRUDRoute` — the dominant path behind `createPublicRoute` and
 * `createProtectedRoute` — and is also reached from
 * `streaming-route-factory.ts`'s pre-stream error path. Before HOS-622 it
 * unconditionally logged `apiLogger.error({ message: 'Route error', error })`
 * as its very first statement, so a 404/410/422 EXPECTED response was logged
 * identically to a real server fault: `ERROR` + full stack.
 *
 * These tests pin that the fix only changes the LOG LEVEL — the HTTP status
 * and response body returned to the client must be byte-identical to before.
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    },
    validateApiEnv: vi.fn()
}));

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { apiLogger } from '../../src/utils/logger';
import { handleRouteError } from '../../src/utils/response-helpers';

type JsonCall = {
    body: unknown;
    status: number | undefined;
};

const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        req: { method: 'GET', path: '/test' },
        get: (key: string) => (key === 'requestId' ? 'req-test-1' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

describe('handleRouteError log level (HOS-622)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not log a NOT_FOUND ServiceError at error, and logs it at info instead', () => {
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');

        handleRouteError(error, ctx);

        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.info).toHaveBeenCalledTimes(1);
        const infoCall = (apiLogger.info as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        expect(infoCall?.[0]).toEqual({
            message: 'Route error',
            code: ServiceErrorCode.NOT_FOUND,
            status: 404
        });

        // Status/body are unaffected by the log-level fix.
        expect(calls[0]?.status).toBe(404);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('does not log a GONE ServiceError at error, and logs it at info instead', () => {
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.GONE, 'Listing no longer available');

        handleRouteError(error, ctx);

        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.info).toHaveBeenCalledTimes(1);
        const infoCall = (apiLogger.info as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        expect(infoCall?.[0]).toEqual({
            message: 'Route error',
            code: ServiceErrorCode.GONE,
            status: 410
        });

        expect(calls[0]?.status).toBe(410);
    });

    it('does not log a FORBIDDEN ServiceError at error, and logs it at warn instead', () => {
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Insufficient permissions');

        handleRouteError(error, ctx);

        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        const warnCall = (apiLogger.warn as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        expect(warnCall?.[0]).toEqual({
            message: 'Route error',
            code: ServiceErrorCode.FORBIDDEN,
            status: 403
        });

        expect(calls[0]?.status).toBe(403);
    });

    it('logs an INTERNAL_ERROR ServiceError at error, with the full error object (stack included)', () => {
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Something broke');

        handleRouteError(error, ctx);

        expect(apiLogger.info).not.toHaveBeenCalled();
        expect(apiLogger.warn).not.toHaveBeenCalled();
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const errorCall = (apiLogger.error as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        const payload = errorCall?.[0] as { message: string; error: unknown };
        expect(payload.message).toBe('Route error');
        // The full error object (carrying `.stack`) is logged — not a compact projection.
        expect(payload.error).toBe(error);
        expect((payload.error as Error).stack).toBeDefined();

        expect(calls[0]?.status).toBe(500);
    });

    it('logs a DATABASE_ERROR-shaped generic Error at error, with the full object (fail-safe default)', () => {
        const { ctx, calls } = createMockContext();
        const error = new Error('connection refused');

        handleRouteError(error, ctx);

        expect(apiLogger.info).not.toHaveBeenCalled();
        expect(apiLogger.warn).not.toHaveBeenCalled();
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const errorCall = (apiLogger.error as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        const payload = errorCall?.[0] as { message: string; error: unknown };
        expect(payload.message).toBe('Route error');
        expect(payload.error).toBe(error);

        expect(calls[0]?.status).toBe(500);
        const body = calls[0]?.body as { error: { code: string } };
        expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('does not log a raw HTTPException(404) at error, and logs it at info instead', () => {
        const { ctx, calls } = createMockContext();
        const error = new HTTPException(404, { message: 'Not found' });

        handleRouteError(error, ctx);

        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.info).toHaveBeenCalledTimes(1);
        const infoCall = (apiLogger.info as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        expect(infoCall?.[0]).toEqual({ message: 'Route error', status: 404 });

        expect(calls[0]?.status).toBe(404);
    });

    it('does not log a raw HTTPException(403) at error, and logs it at warn instead', () => {
        const { ctx, calls } = createMockContext();
        const error = new HTTPException(403, { message: 'Forbidden' });

        handleRouteError(error, ctx);

        expect(apiLogger.error).not.toHaveBeenCalled();
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        const warnCall = (apiLogger.warn as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        expect(warnCall?.[0]).toEqual({ message: 'Route error', status: 403 });

        expect(calls[0]?.status).toBe(403);
    });

    it('logs an HTTPException(500) at error, with the full error object', () => {
        const { ctx, calls } = createMockContext();
        const error = new HTTPException(500, { message: 'Upstream blew up' });

        handleRouteError(error, ctx);

        expect(apiLogger.info).not.toHaveBeenCalled();
        expect(apiLogger.warn).not.toHaveBeenCalled();
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const errorCall = (apiLogger.error as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0];
        const payload = errorCall?.[0] as { message: string; error: unknown };
        expect(payload.error).toBe(error);

        expect(calls[0]?.status).toBe(500);
    });

    // R4 (error-contract.md): the 422 business-rule rejection (e.g. buying an
    // addon without an active subscription) is a deliberate scope decision,
    // NOT covered by this fix — neither `resolveErrorLogLevel` nor
    // `resolveHttpStatusLogLevel` downgrade 422/PROVIDER_REVOKED today, so it
    // still logs at `error` with a full stack. This test pins that current
    // (unchanged) behavior so a future change to widen the scope is deliberate.
    it('still logs a PROVIDER_REVOKED (422) ServiceError at error (422 left out of scope)', () => {
        const { ctx, calls } = createMockContext();
        const error = new ServiceError(ServiceErrorCode.PROVIDER_REVOKED, 'Provider revoked');

        handleRouteError(error, ctx);

        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        expect(apiLogger.info).not.toHaveBeenCalled();
        expect(apiLogger.warn).not.toHaveBeenCalled();

        expect(calls[0]?.status).toBe(422);
    });
});
