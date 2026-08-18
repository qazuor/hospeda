/**
 * Guard: an `HTTPException` must reach the client carrying an error code that
 * matches its status — and no 4xx may ever be labelled `INTERNAL_ERROR`.
 *
 * H-105 measured one instance: `GET .../downgrade-preview?targetPlan=no-existe`
 * answers `HTTP 422` (correct) with `"code": "INTERNAL_ERROR"` (wrong). A
 * consumer branching on `error.code` — which this API's contract invites — then
 * cannot tell "you sent a plan that does not exist" from "the server broke".
 * One is the caller's fault and is fixed by changing a parameter; the other
 * fires alerts and retries.
 *
 * It was never one route. Both formatters translate status → code through a
 * lookup that only knew 400/401/402/403/404/409, so EVERY 410, 422 and 429
 * thrown as an `HTTPException` collapsed to `INTERNAL_ERROR`. `plan-change.ts`
 * alone throws 422 six times.
 *
 * The two formatters are twins by design and by comment:
 *   - `handleRouteError` (utils/response-helpers.ts) catches inside the route
 *     factory — every factory-built route lands there;
 *   - `createErrorHandler` (middlewares/response.ts) is `app.onError` — anything
 *     thrown from middleware or a hand-rolled route lands there instead.
 * A status handled by only one of them yields a different body depending on
 * where in the stack the throw happened, which is exactly the class of bug that
 * produced HOS-283. So parity is asserted here, not assumed.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
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

import { createErrorHandler } from '../../src/middlewares/response';
import { handleRouteError } from '../../src/utils/response-helpers';

type Captured = { code: string; status: number | undefined };

const createMockContext = (): { ctx: Context; calls: Captured[] } => {
    const calls: Captured[] = [];
    const ctx = {
        req: { method: 'GET', path: '/test' },
        res: { headers: { get: () => null } },
        get: (key: string) => (key === 'requestId' ? 'req-guard-1' : undefined),
        json: (body: unknown, status?: number) => {
            const typed = body as { error?: { code?: string } };
            calls.push({ code: typed.error?.code ?? '<none>', status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

/** Runs an HTTPException through the route-factory formatter. */
const viaRouteFactory = (status: number): Captured => {
    const { ctx, calls } = createMockContext();
    handleRouteError(new HTTPException(status as 400, { message: 'guard probe' }), ctx);
    const first = calls[0];
    if (!first) {
        throw new Error('handleRouteError produced no response');
    }
    return first;
};

/** Runs the same exception through the global `app.onError` formatter. */
const viaGlobalHandler = (status: number): Captured => {
    const { ctx, calls } = createMockContext();
    createErrorHandler()(new HTTPException(status as 400, { message: 'guard probe' }), ctx);
    const first = calls[0];
    if (!first) {
        throw new Error('createErrorHandler produced no response');
    }
    return first;
};

/**
 * Every status this codebase actually throws as an `HTTPException`, and the
 * code the contract assigns it.
 *
 * Sourced by sweeping `new HTTPException(` across `src/routes` and
 * `src/middlewares` — not invented. 410 and 429 are included because the
 * ServiceError table already maps codes onto them, so a route-level throw is a
 * matter of time; naming them now costs nothing and closes the hole in advance.
 */
const STATUS_TO_CODE: ReadonlyArray<readonly [number, ServiceErrorCode]> = [
    [400, ServiceErrorCode.VALIDATION_ERROR],
    [401, ServiceErrorCode.UNAUTHORIZED],
    [402, ServiceErrorCode.ENTITLEMENT_REQUIRED],
    [403, ServiceErrorCode.FORBIDDEN],
    [404, ServiceErrorCode.NOT_FOUND],
    [409, ServiceErrorCode.ALREADY_EXISTS],
    [410, ServiceErrorCode.GONE],
    [422, ServiceErrorCode.VALIDATION_ERROR],
    [429, ServiceErrorCode.QUOTA_EXCEEDED],
    [500, ServiceErrorCode.INTERNAL_ERROR],
    [502, ServiceErrorCode.PROVIDER_ERROR],
    [503, ServiceErrorCode.SERVICE_UNAVAILABLE],
    [504, ServiceErrorCode.PROVIDER_TIMEOUT]
];

describe('HTTPException status → error code', () => {
    it.each(STATUS_TO_CODE)('%i carries %s through the route-factory formatter', (status, code) => {
        expect(viaRouteFactory(status).code).toBe(code);
    });

    it.each(STATUS_TO_CODE)('%i carries %s through the global error handler', (status, code) => {
        expect(viaGlobalHandler(status).code).toBe(code);
    });

    /**
     * The rule the whole contract rests on, asserted independently of the table
     * above so that adding a row cannot weaken it: a 4xx is the caller's
     * problem, and `INTERNAL_ERROR` says it is ours.
     */
    it.each(
        STATUS_TO_CODE.filter(([status]) => status < 500)
    )('%i is never labelled INTERNAL_ERROR', (status) => {
        expect(viaRouteFactory(status).code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(viaGlobalHandler(status).code).not.toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it.each(STATUS_TO_CODE)('%i formats identically on both twin paths', (status) => {
        expect(viaGlobalHandler(status).code).toBe(viaRouteFactory(status).code);
    });

    it.each(STATUS_TO_CODE)('%i preserves the status itself', (status) => {
        expect(viaRouteFactory(status).status).toBe(status);
        expect(viaGlobalHandler(status).status).toBe(status);
    });

    /**
     * The exact case H-105 measured, spelled out so a regression reads as the
     * finding rather than as one anonymous row in a parametrised list.
     */
    it('labels the downgrade-preview 422 as a validation error, not a server fault', () => {
        expect(viaRouteFactory(422).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(viaGlobalHandler(422).code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
