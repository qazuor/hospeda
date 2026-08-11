/**
 * Guard: every ServiceErrorCode must resolve to an explicit HTTP status.
 *
 * `handleRouteError` decides the status through two INDEPENDENT paths, and
 * neither is protected by the compiler:
 *
 * 1. a `switch` over `error.code`, for a thrown `ServiceError`, ending in
 *    `default: statusCode = 500`;
 * 2. a `statusCodeMap` lookup, for a plain `Error` whose message carries the
 *    legacy `"CODE: message"` prefix, ending in `?? 500`.
 *
 * Only the third site — `ERROR_CODE_TO_HTTP` in `middlewares/response.ts` — is
 * a total `Record<ServiceErrorCode, number>` that fails the build when a member
 * is added. So a new code mapped only there still answers 500 through both of
 * these, and no type error says so. This guard is what says so.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { NODE_ENV: 'test', HOSPEDA_API_DEBUG_ERRORS: false },
    validateApiEnv: vi.fn()
}));

// MUST come from the `/types` subpath, exactly as `response-helpers.ts` imports
// it. `@repo/service-core` re-exports a SEPARATE class instance, so building the
// probe from the barrel makes every `instanceof ServiceError` check fail and
// every status silently collapse to 500 — which is what this guard would then
// be measuring instead of the mapping.
import { ServiceError } from '@repo/service-core/types';
import { handleRouteError } from '../../src/utils/response-helpers';

type JsonCall = { body: unknown; status: number | undefined };

const createMockContext = (): { ctx: Context; calls: JsonCall[] } => {
    const calls: JsonCall[] = [];
    const ctx = {
        req: { method: 'GET', path: '/test' },
        get: (key: string) => (key === 'requestId' ? 'req-guard-1' : undefined),
        json: (body: unknown, status?: number) => {
            calls.push({ body, status });
            return { body, status } as unknown as Response;
        }
    } as unknown as Context;
    return { ctx, calls };
};

/** Runs a thrown value through handleRouteError and returns the HTTP status. */
function statusFor(error: unknown): number | undefined {
    const { ctx, calls } = createMockContext();
    handleRouteError(error, ctx);
    return calls[0]?.status;
}

/**
 * The HOS-376 domain codes and the statuses spec §7.5 assigns them.
 *
 * These are the reason this guard exists: the spec's acceptance criteria name
 * the CODE in the response (AC-9 "responde 403 DECLARATION_BLOCKED"), so the
 * code has to travel to the client intact AND carry the right status.
 */
const HOS_376_CODES: ReadonlyArray<readonly [ServiceErrorCode, number]> = [
    [ServiceErrorCode.HOST_NOT_FOUND, 404],
    [ServiceErrorCode.USAGE_PENDING_EXISTS, 409],
    [ServiceErrorCode.DECLARATION_BLOCKED, 403],
    [ServiceErrorCode.DECLARATION_SUSPENDED, 403],
    [ServiceErrorCode.NO_CONFIRMED_USAGE, 403],
    [ServiceErrorCode.SELF_REVIEW_FORBIDDEN, 403],
    [ServiceErrorCode.REVIEW_ALREADY_EXISTS, 409],
    [ServiceErrorCode.PROVIDER_REVOKED, 422]
];

describe('ServiceErrorCode → HTTP mapping', () => {
    it.each(
        Object.values(ServiceErrorCode)
    )('%s resolves to a non-default status on the ServiceError path', (code) => {
        const status = statusFor(new ServiceError(code, 'guard probe'));
        // INTERNAL_ERROR and CONFIGURATION_ERROR legitimately ARE 500, so the
        // assertion is "the switch handled it", not "it isn't 500".
        const legitimately500: readonly ServiceErrorCode[] = [
            ServiceErrorCode.INTERNAL_ERROR,
            ServiceErrorCode.CONFIGURATION_ERROR
        ];
        if (legitimately500.includes(code)) {
            expect(status).toBe(500);
        } else {
            expect(status).not.toBe(500);
        }
    });

    /**
     * No exclusion list. The two paths must agree for EVERY code.
     *
     * There used to be one, holding QUOTA_EXCEEDED / LIMIT_REACHED /
     * ENTITLEMENT_REQUIRED, which `statusCodeMap` never mapped — so a plain
     * `Error("LIMIT_REACHED: ...")` answered 500 instead of 403. Closing that
     * hole is what lets this assertion be total, and total is the point: an
     * allowed-exceptions list is a place for the next gap to hide.
     */
    it.each(
        Object.values(ServiceErrorCode)
    )('%s resolves identically on the legacy "CODE: message" path', (code) => {
        const viaServiceError = statusFor(new ServiceError(code, 'guard probe'));
        const viaLegacyString = statusFor(new Error(`${code}: guard probe`));
        expect(viaLegacyString).toBe(viaServiceError);
    });

    it.each(HOS_376_CODES)('%s carries the status spec 7.5 assigns it', (code, expected) => {
        expect(statusFor(new ServiceError(code, 'guard probe'))).toBe(expected);
    });

    /**
     * The three codes whose absence from `statusCodeMap` was the original gap.
     * Named explicitly so a regression reads as "the entitlement refusal became
     * a 500 again" rather than as one anonymous row in a parametrised list.
     */
    it.each([
        [ServiceErrorCode.QUOTA_EXCEEDED, 429],
        [ServiceErrorCode.LIMIT_REACHED, 403],
        [ServiceErrorCode.ENTITLEMENT_REQUIRED, 403]
    ] as ReadonlyArray<
        readonly [ServiceErrorCode, number]
    >)('%s survives the legacy path with its real status, not a 500', (code, expected) => {
        expect(statusFor(new Error(`${code}: guard probe`))).toBe(expected);
    });
});
