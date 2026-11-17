/**
 * HOS-2296: the API never echoes an internal error message on a 5xx response.
 *
 * Both error formatters are covered because a route lands in one or the other
 * depending on where the throw is caught (`handleRouteError` inside the route
 * factory, `createErrorHandler` as the global `onError`):
 *
 * - a response whose HTTP status is >= 500 carries the generic message, no
 *   `details` and no `reason` (the `code` is kept);
 * - a response below 500 keeps its own message and details unchanged (HOS-700:
 *   the web app reads `details.limitKey` off `LIMIT_REACHED`);
 * - `HOSPEDA_API_DEBUG_ERRORS` lifts the masking.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError as GlobalHandlerServiceError } from '@repo/service-core';
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { Hono } from 'hono';
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

vi.mock('../../src/utils/env', () => {
    const mockEnv: Record<string, unknown> = {
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    };
    return {
        env: mockEnv,
        validateApiEnv: vi.fn(),
        getResponseConfig: () => ({
            formatEnabled: true,
            includeMetadata: true,
            includeVersion: true,
            includeRequestId: true,
            apiVersion: '1.0.0',
            errorMessage: 'An unexpected error occurred',
            includeTimestamp: true,
            successMessage: 'Success'
        })
    };
});

import { createErrorHandler } from '../../src/middlewares/response';
import { env } from '../../src/utils/env';
import { apiLogger } from '../../src/utils/logger';
import { handleRouteError } from '../../src/utils/response-helpers';

const GENERIC = 'An unexpected error occurred';
const INTERNAL_MESSAGE = 'connect ECONNREFUSED 10.0.3.7:5432 (HOSPEDA_DATABASE_URL)';
const INTERNAL_DETAILS = { sql: 'select * from users', host: '10.0.3.7' };

type JsonCall = { body: Record<string, unknown>; status: number | undefined };

const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        req: { method: 'GET', path: '/test' },
        get: (key: string) => (key === 'requestId' ? 'req-test-1' : undefined),
        json: (body: Record<string, unknown>, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

/** Runs `error` through `handleRouteError` and returns the JSON the client would get. */
const viaHandleRouteError = (error: unknown) => {
    const { ctx, calls } = createMockContext();
    handleRouteError(error, ctx);
    const call = calls[0];
    return {
        status: call?.status,
        error: (call?.body.error ?? {}) as Record<string, unknown>
    };
};

/** Runs `error` through the global `onError` and returns the JSON the client gets. */
const viaGlobalHandler = async (error: unknown) => {
    const app = new Hono();
    app.onError(createErrorHandler());
    app.get('/boom', () => {
        throw error;
    });
    const res = await app.request('/boom');
    const body = (await res.json()) as { error: Record<string, unknown> };
    return { status: res.status, error: body.error };
};

/**
 * Under vitest `ServiceError` from `@repo/service-core` and from
 * `@repo/service-core/types` are two different classes (see the note in
 * `test/middlewares/response.test.ts`). `handleRouteError` checks the `/types`
 * one and `createErrorHandler` the root one, so each formatter is fed an error
 * built from the class it actually tests `instanceof` against.
 */
const formatters = [
    ['handleRouteError', async (e: unknown) => viaHandleRouteError(e), ServiceError],
    ['createErrorHandler', viaGlobalHandler, GlobalHandlerServiceError]
] as const;

describe.each(
    formatters
)('%s: 5xx never echoes internals (HOS-2296)', (_name, run, ServiceError) => {
    beforeEach(() => {
        vi.clearAllMocks();
        env.HOSPEDA_API_DEBUG_ERRORS = false;
        env.NODE_ENV = 'test';
    });

    it.each([
        [ServiceErrorCode.INTERNAL_ERROR, 500],
        [ServiceErrorCode.CONFIGURATION_ERROR, 500],
        [ServiceErrorCode.SERVICE_UNAVAILABLE, 503],
        [ServiceErrorCode.PROVIDER_ERROR, 502],
        [ServiceErrorCode.PROVIDER_TIMEOUT, 504],
        [ServiceErrorCode.NOT_IMPLEMENTED, 501]
    ])('%s (%i) answers the generic message with no details or reason', async (code, status) => {
        const error = new ServiceError(code, INTERNAL_MESSAGE, INTERNAL_DETAILS, 'SECRET_REASON');

        const result = await run(error);

        expect(result.status).toBe(status);
        expect(result.error.code).toBe(code);
        expect(result.error.message).toBe(GENERIC);
        expect(result.error.details).toBeUndefined();
        expect(result.error.reason).toBeUndefined();
        expect(JSON.stringify(result.error)).not.toContain('ECONNREFUSED');
    });

    it('answers the generic message for a ServiceError code with no mapping (defaults to 500)', async () => {
        const error = new ServiceError(
            'SOMETHING_NEW' as ServiceErrorCode,
            INTERNAL_MESSAGE,
            INTERNAL_DETAILS
        );

        const result = await run(error);

        expect(result.status).toBe(500);
        expect(result.error.message).toBe(GENERIC);
        expect(result.error.details).toBeUndefined();
    });

    it('masks an HTTPException(503) message', async () => {
        const result = await run(new HTTPException(503, { message: INTERNAL_MESSAGE }));

        expect(result.status).toBe(503);
        expect(result.error.message).toBe(GENERIC);
    });

    it('masks a plain Error', async () => {
        const result = await run(new Error(INTERNAL_MESSAGE));

        expect(result.status).toBe(500);
        expect(result.error.message).toBe(GENERIC);
        expect(result.error.details).toBeUndefined();
    });

    it('keeps the real message when HOSPEDA_API_DEBUG_ERRORS is on', async () => {
        env.HOSPEDA_API_DEBUG_ERRORS = true;
        const error = new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            INTERNAL_MESSAGE,
            INTERNAL_DETAILS
        );

        const result = await run(error);

        expect(result.error.message).toBe(INTERNAL_MESSAGE);
        expect(result.error.details).toEqual(INTERNAL_DETAILS);
    });

    it('keeps the message and public details of a 4xx unchanged', async () => {
        const limit = await run(
            new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'You reached your limit', {
                limitKey: 'max_accommodations'
            })
        );
        expect(limit.status).toBe(403);
        expect(limit.error.message).toBe('You reached your limit');
        expect(limit.error.details).toEqual({ limitKey: 'max_accommodations' });

        const notFound = await run(new ServiceError(ServiceErrorCode.NOT_FOUND, 'Venue not found'));
        expect(notFound.status).toBe(404);
        expect(notFound.error.message).toBe('Venue not found');

        const validation = await run(
            new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Name is required')
        );
        expect(validation.status).toBe(400);
        expect(validation.error.message).toBe('Name is required');
    });
});

describe('handleRouteError: the real message stays in the log (HOS-2296)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        env.HOSPEDA_API_DEBUG_ERRORS = false;
    });

    it('logs the full ServiceError even though the client gets the generic text', () => {
        const error = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, INTERNAL_MESSAGE);

        const { error: body } = viaHandleRouteError(error);

        expect(body.message).toBe(GENERIC);
        expect(apiLogger.error).toHaveBeenCalledTimes(1);
        const logged = (apiLogger.error as unknown as { mock: { calls: unknown[][] } }).mock
            .calls[0]?.[0] as { error: ServiceError };
        expect(logged.error.message).toBe(INTERNAL_MESSAGE);
    });

    it('masks the message of a legacy "CODE: message" error that maps to 500', () => {
        const result = viaHandleRouteError(
            new Error(`${ServiceErrorCode.INTERNAL_ERROR}: ${INTERNAL_MESSAGE}`)
        );

        expect(result.status).toBe(500);
        expect(result.error.message).toBe(GENERIC);
    });
});
