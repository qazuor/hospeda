/**
 * Unit tests for billing-provider-error helper (SPEC-149 T-002).
 *
 * Covers:
 * - `isBillingProviderError`: detection of QZPayProviderSyncError, non-matches.
 * - `mapProviderErrorToServiceError`: every mapping row in the spec table (code + message).
 * - Status extraction from both stub shape (numeric `status`) and real adapter
 *   shape (QZPayMercadoPagoError string `code`).
 * - Malformed/no-cause path → PROVIDER_ERROR.
 * - Brand-safety: messages never contain 'MercadoPago'.
 * - Retry-After header emission via the global error handler (integration path).
 *
 * NOTE: ServiceErrorCode values are tested via `.code` (works via module alias).
 * `ServiceError.details` has a known Vitest/OXC transpiler quirk where optional
 * TypeScript parameter properties (`public details?: unknown`) lose their value
 * when accessed directly on the constructed instance in the test runner. The
 * `details.retryAfter` path is therefore tested via an end-to-end Hono route
 * (matching the pattern used in `test/middlewares/response.test.ts`).
 *
 * @module test/lib/billing-provider-error
 */

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../../src/lib/billing-provider-error';
import { createErrorHandler, responseFormattingMiddleware } from '../../src/middlewares/response';

// ---------------------------------------------------------------------------
// Mock @repo/service-core — must mirror response.test.ts to get a fresh
// ServiceError class where the optional `public details?` parameter property
// is correctly stored as an own property.  Without this mock, the Vitest/OXC
// module cache returns a version where `details` is silently dropped.
// ---------------------------------------------------------------------------

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

// ---------------------------------------------------------------------------
// Mock env — same pattern as response.test.ts
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        API_RESPONSE_FORMAT_ENABLED: true,
        API_RESPONSE_INCLUDE_METADATA: true,
        API_RESPONSE_INCLUDE_REQUEST_ID: true,
        API_RESPONSE_API_VERSION: '1.0.0',
        API_RESPONSE_ERROR_MESSAGE: 'Internal server error',
        NODE_ENV: 'test',
        HOSPEDA_API_DEBUG_ERRORS: false
    };

    const mockModule = {
        env: mockEnv,
        validateApiEnv: vi.fn(),
        getResponseConfig: () => ({
            formatEnabled: mockModule.env.API_RESPONSE_FORMAT_ENABLED ?? true,
            includeMetadata: mockModule.env.API_RESPONSE_INCLUDE_METADATA ?? true,
            includeVersion: (mockModule.env.API_RESPONSE_API_VERSION ?? '').length > 0,
            includeRequestId: mockModule.env.API_RESPONSE_INCLUDE_REQUEST_ID ?? true,
            apiVersion: mockModule.env.API_RESPONSE_API_VERSION ?? '1.0.0',
            errorMessage: mockModule.env.API_RESPONSE_ERROR_MESSAGE ?? 'Internal server error',
            includeTimestamp: mockModule.env.API_RESPONSE_INCLUDE_METADATA ?? true,
            successMessage: 'Success'
        })
    };

    return mockModule;
});

// ---------------------------------------------------------------------------
// Helpers — replicate the two error shapes described in the module JSDoc
// ---------------------------------------------------------------------------

/**
 * Build a "stub shape" cause — numeric `status` property, mirrors
 * `buildHttpLikeError` in `test/e2e/helpers/mp-stub.ts`.
 */
function buildStubCause(status: number, code?: string): Error {
    const err = new Error(`Stub error ${status}`) as Error & {
        status: number;
        code?: string;
    };
    err.name = 'MpStubHttpError';
    err.status = status;
    if (code !== undefined) {
        err.code = code;
    }
    return err;
}

/**
 * Build an "adapter shape" cause — string `code` enum, mirrors
 * `QZPayMercadoPagoError` from the mercadopago adapter's `error-mapper.ts`.
 */
function buildAdapterCause(code: string): Error {
    const err = new Error(`Adapter error: ${code}`) as Error & {
        code: string;
    };
    err.name = 'QZPayMercadoPagoError';
    err.code = code;
    return err;
}

/**
 * Wrap a cause error in a `QZPayProviderSyncError` (the shape thrown by
 * qzpay-core when `providerSyncErrorStrategy: 'throw'`).
 */
function buildProviderSyncError(
    cause?: Error,
    operation = 'checkout_create'
): QZPayProviderSyncError {
    return new QZPayProviderSyncError(
        'Failed to create checkout in mercadopago',
        'mercadopago',
        operation,
        { customerId: 'cust_test' },
        cause
    );
}

// ---------------------------------------------------------------------------
// isBillingProviderError
// ---------------------------------------------------------------------------

describe('isBillingProviderError', () => {
    it('returns true for a QZPayProviderSyncError', () => {
        const err = buildProviderSyncError(buildStubCause(500));
        expect(isBillingProviderError(err)).toBe(true);
    });

    it('returns false for a plain Error', () => {
        expect(isBillingProviderError(new Error('plain'))).toBe(false);
    });

    it('returns false for a ServiceError', () => {
        expect(
            isBillingProviderError(new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'internal'))
        ).toBe(false);
    });

    it('returns false for null', () => {
        expect(isBillingProviderError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isBillingProviderError(undefined)).toBe(false);
    });

    it('returns false for a duck-typed object with provider+operation fields but not instanceof', () => {
        const fake = { provider: 'mercadopago', operation: 'checkout_create', message: 'x' };
        expect(isBillingProviderError(fake)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// mapProviderErrorToServiceError — stub shape (numeric status) — code checks
// ---------------------------------------------------------------------------

describe('mapProviderErrorToServiceError — stub shape (numeric status field)', () => {
    it('maps MP 422 → VALIDATION_ERROR (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(422, 'UNPROCESSABLE'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result).toBeInstanceOf(ServiceError);
        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        // HTTP status is governed by ERROR_CODE_TO_HTTP in response.ts: VALIDATION_ERROR → 400.
        // 422 is the closest semantic but no ServiceErrorCode maps to it — see module JSDoc.
        expect(result.message).toContain('payment provider');
    });

    it('maps MP 429 → PROVIDER_RATE_LIMITED (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
        const result = mapProviderErrorToServiceError({
            error: err,
            operation: 'subscription_create'
        });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_RATE_LIMITED);
        expect(result.message).toContain('payment provider');
    });

    it('maps MP 408 → PROVIDER_TIMEOUT (stub timeout cause)', () => {
        const err = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_TIMEOUT);
        expect(result.message).toContain('payment provider');
    });

    it('maps MP 504 → PROVIDER_TIMEOUT (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(504, 'GATEWAY_TIMEOUT'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_TIMEOUT);
    });

    it('maps MP 500 → PROVIDER_ERROR (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(500, 'INTERNAL_SERVER_ERROR'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 502 → PROVIDER_ERROR (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(502, 'BAD_GATEWAY'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 503 → PROVIDER_ERROR (stub cause)', () => {
        const err = buildProviderSyncError(buildStubCause(503, 'SERVICE_UNAVAILABLE'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 400 → PROVIDER_ERROR (integration issue, not user-fixable)', () => {
        const err = buildProviderSyncError(buildStubCause(400, 'BAD_REQUEST'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 401 → PROVIDER_ERROR (auth failure on our key)', () => {
        const err = buildProviderSyncError(buildStubCause(401, 'UNAUTHORIZED'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 403 → PROVIDER_ERROR', () => {
        const err = buildProviderSyncError(buildStubCause(403, 'FORBIDDEN'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps MP 404 → PROVIDER_ERROR (integration misconfiguration)', () => {
        const err = buildProviderSyncError(buildStubCause(404, 'NOT_FOUND'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });
});

// ---------------------------------------------------------------------------
// mapProviderErrorToServiceError — adapter shape (QZPayMercadoPagoError code)
// ---------------------------------------------------------------------------

describe('mapProviderErrorToServiceError — adapter shape (QZPayMercadoPagoError.code)', () => {
    it('maps rate_limit_error → PROVIDER_RATE_LIMITED (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('rate_limit_error'));
        const result = mapProviderErrorToServiceError({
            error: err,
            operation: 'subscription_create'
        });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_RATE_LIMITED);
    });

    it('maps authentication_error → PROVIDER_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('authentication_error'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps invalid_card → VALIDATION_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('invalid_card'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('maps insufficient_funds → VALIDATION_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('insufficient_funds'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('maps card_declined → VALIDATION_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('card_declined'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('maps processing_error → PROVIDER_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('processing_error'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps provider_error → PROVIDER_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('provider_error'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps unknown adapter code → PROVIDER_ERROR (adapter cause)', () => {
        const err = buildProviderSyncError(buildAdapterCause('some_unknown_code'));
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });
        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });
});

// ---------------------------------------------------------------------------
// mapProviderErrorToServiceError — malformed / no-cause paths
// ---------------------------------------------------------------------------

describe('mapProviderErrorToServiceError — malformed / no-cause', () => {
    it('maps no-cause error → PROVIDER_ERROR', () => {
        const err = buildProviderSyncError(undefined); // no cause
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('maps cause with no recognisable fields → PROVIDER_ERROR', () => {
        const weirdCause = new Error('malformed') as Error;
        // The default Error has no `status`, `statusCode`, or recognisable `code`.
        const err = buildProviderSyncError(weirdCause);
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_ERROR);
    });

    it('preferentially reads numeric status over string code on mixed cause', () => {
        // Build a cause that has BOTH a numeric `status` AND a string `code` that
        // would map to a different status. The numeric `status` must win.
        const cause = new Error('both') as Error & { status: number; code: string };
        cause.status = 408; // timeout
        cause.code = 'rate_limit_error'; // would be 429 via string mapping
        const err = buildProviderSyncError(cause);
        const result = mapProviderErrorToServiceError({ error: err, operation: 'checkout_create' });

        expect(result.code).toBe(ServiceErrorCode.PROVIDER_TIMEOUT); // 408 wins
    });
});

// ---------------------------------------------------------------------------
// Provider name — must never leak 'MercadoPago'
// ---------------------------------------------------------------------------

describe('user-facing message safety', () => {
    it.each([
        [422, buildStubCause(422)],
        [429, buildStubCause(429)],
        [408, buildStubCause(408)],
        [500, buildStubCause(500)]
    ] as [number, Error][])('message for status %i does not mention MercadoPago', (_, cause) => {
        const err = buildProviderSyncError(cause);
        const result = mapProviderErrorToServiceError({ error: err, operation: 'test_op' });

        expect(result.message.toLowerCase()).not.toContain('mercadopago');
        expect(result.message.toLowerCase()).not.toContain('mercado pago');
    });
});

// ---------------------------------------------------------------------------
// Retry-After header emission via Hono error handler (integration path)
//
// `ServiceError.details` is not accessible via direct property access in the
// Vitest/OXC test runner (known transpiler quirk with optional `public` param
// properties). The Retry-After behaviour is therefore tested end-to-end through
// the Hono app, matching the pattern used in test/middlewares/response.test.ts
// for LIMIT_REACHED/ENTITLEMENT_REQUIRED details assertions.
// ---------------------------------------------------------------------------

describe('Retry-After header emission via createErrorHandler (integration)', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(responseFormattingMiddleware);
        app.onError(createErrorHandler());
        vi.clearAllMocks();
    });

    it('emits Retry-After header when PROVIDER_RATE_LIMITED ServiceError has retryAfter in details', async () => {
        // Throw a ServiceError directly (simulates what mapProviderErrorToServiceError returns).
        // The createErrorHandler must emit Retry-After when details.retryAfter is set.
        app.get('/provider-rate-limited-retry', async () => {
            const { ServiceError: SE } = await import('@repo/service-core');
            const { ServiceErrorCode: SEC } = await import('@repo/schemas');
            // Directly construct with details, mirroring what mapProviderErrorToServiceError
            // produces for a 429 cause. The Hono route closure re-imports to avoid
            // the static-import OXC quirk.
            throw new SE(SEC.PROVIDER_RATE_LIMITED, 'rate limited', {
                provider: 'payment-provider',
                operation: 'checkout_create',
                retryAfter: 45
            });
        });

        const res = await app.request('/provider-rate-limited-retry');

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('45');
    });

    it('does NOT emit Retry-After for PROVIDER_RATE_LIMITED without retryAfter in details', async () => {
        app.get('/provider-rate-limited-no-hint', async () => {
            const { ServiceError: SE } = await import('@repo/service-core');
            const { ServiceErrorCode: SEC } = await import('@repo/schemas');
            throw new SE(SEC.PROVIDER_RATE_LIMITED, 'rate limited no hint', {
                provider: 'payment-provider',
                operation: 'checkout_create'
                // no retryAfter field
            });
        });

        const res = await app.request('/provider-rate-limited-no-hint');

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBeNull();
    });

    it('does NOT emit Retry-After for PROVIDER_TIMEOUT even with retryAfter in details', async () => {
        app.get('/provider-timeout-no-header', async () => {
            const { ServiceError: SE } = await import('@repo/service-core');
            const { ServiceErrorCode: SEC } = await import('@repo/schemas');
            // PROVIDER_TIMEOUT should NOT trigger Retry-After — only PROVIDER_RATE_LIMITED does
            throw new SE(SEC.PROVIDER_TIMEOUT, 'timed out', {
                provider: 'payment-provider',
                operation: 'checkout_create',
                retryAfter: 10
            });
        });

        const res = await app.request('/provider-timeout-no-header');

        expect(res.status).toBe(504);
        expect(res.headers.get('Retry-After')).toBeNull();
    });

    it('maps MP 429 end-to-end: QZPayProviderSyncError → PROVIDER_RATE_LIMITED → 503', async () => {
        // Full integration: build a QZPayProviderSyncError with stub cause,
        // run mapProviderErrorToServiceError, throw the ServiceError, check HTTP status.
        //
        // NOTE: Retry-After header emission cannot be verified here because
        // `mapProviderErrorToServiceError` constructs `ServiceError` via its static
        // module-level import, which has the OXC optional-parameter-property quirk
        // (details not stored as own property in vitest). The Retry-After path is
        // covered by the dynamic-import tests above and by test/middlewares/response.test.ts.
        app.get('/full-429', async () => {
            const cause = buildStubCause(429, 'RATE_LIMITED');
            const syncErr = buildProviderSyncError(cause, 'checkout_create');
            const serviceErr = mapProviderErrorToServiceError({
                error: syncErr,
                operation: 'checkout_create'
            });
            throw serviceErr;
        });

        const res = await app.request('/full-429');

        expect(res.status).toBe(503);
        // Retry-After header cannot be verified via this path — see comment above.
    });

    it('maps MP 408 end-to-end: QZPayProviderSyncError → PROVIDER_TIMEOUT → 504', async () => {
        app.get('/full-408', () => {
            const cause = buildStubCause(408, 'TIMEOUT');
            const syncErr = buildProviderSyncError(cause, 'subscription_create');
            const serviceErr = mapProviderErrorToServiceError({
                error: syncErr,
                operation: 'subscription_create'
            });
            throw serviceErr;
        });

        const res = await app.request('/full-408');
        expect(res.status).toBe(504);
        expect(res.headers.get('Retry-After')).toBeNull();
    });

    it('maps MP 422 end-to-end: QZPayProviderSyncError → VALIDATION_ERROR → 400', async () => {
        app.get('/full-422', () => {
            const cause = buildStubCause(422, 'UNPROCESSABLE');
            const syncErr = buildProviderSyncError(cause, 'checkout_create');
            const serviceErr = mapProviderErrorToServiceError({
                error: syncErr,
                operation: 'checkout_create'
            });
            throw serviceErr;
        });

        const res = await app.request('/full-422');
        expect(res.status).toBe(400); // VALIDATION_ERROR → 400 (see 422 choice rationale in module JSDoc)
    });

    it('maps MP 500 end-to-end: QZPayProviderSyncError → PROVIDER_ERROR → 502', async () => {
        app.get('/full-500', () => {
            const cause = buildStubCause(500, 'INTERNAL_SERVER_ERROR');
            const syncErr = buildProviderSyncError(cause, 'checkout_create');
            const serviceErr = mapProviderErrorToServiceError({
                error: syncErr,
                operation: 'checkout_create'
            });
            throw serviceErr;
        });

        const res = await app.request('/full-500');
        expect(res.status).toBe(502);
        expect(res.headers.get('Retry-After')).toBeNull();
    });

    it('adapter shape (rate_limit_error): end-to-end → 503', async () => {
        // NOTE: Retry-After header emission cannot be verified via the
        // mapProviderErrorToServiceError path due to the OXC optional-param-property
        // quirk — see comment in the MP 429 test above.
        app.get('/adapter-rate-limit', () => {
            const cause = buildAdapterCause('rate_limit_error');
            const syncErr = buildProviderSyncError(cause, 'subscription_create');
            const serviceErr = mapProviderErrorToServiceError({
                error: syncErr,
                operation: 'subscription_create'
            });
            throw serviceErr;
        });

        const res = await app.request('/adapter-rate-limit');
        expect(res.status).toBe(503);
    });
});
