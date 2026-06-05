/**
 * Billing provider error detection and mapping helper (SPEC-149 Part B).
 *
 * Detects `QZPayProviderSyncError` thrown by qzpay-core's `throw` strategy and
 * maps the underlying MP status code to a typed `ServiceError` with the
 * appropriate `ServiceErrorCode` so the global error handler returns the correct
 * HTTP status (502/503/504/400) instead of the generic 500.
 *
 * ### Error shape verified at implementation time (SPEC-149, 2026-06-05)
 *
 * Two distinct shapes flow through the `cause` chain:
 *
 * **Stub (mp-stub.ts `buildHttpLikeError`)**
 * ```ts
 * {
 *   name: 'MpStubHttpError',
 *   message: '...',
 *   status: number,   // ← numeric HTTP status, e.g. 429
 *   code?: string,    // ← optional string code, e.g. 'RATE_LIMITED'
 * }
 * ```
 *
 * **Real adapter (`QZPayMercadoPagoError` from error-mapper.ts)**
 * ```ts
 * {
 *   name: 'QZPayMercadoPagoError',
 *   message: '...',
 *   code: QZPayErrorCode,   // ← string enum, e.g. 'rate_limit_error'
 *   originalError?: unknown, // ← raw MP SDK response (may carry `.status` number
 *                             //   from the axios response, but undocumented)
 * }
 * ```
 *
 * Status extraction therefore duck-types the `cause` for a `.status` numeric
 * field first (covers both the stub and some MP SDK paths), then falls back to
 * mapping `QZPayMercadoPagoError.code` strings to synthetic numeric statuses so
 * the same mapping table applies uniformly.
 *
 * ### 422 code choice (documented)
 *
 * `ERROR_CODE_TO_HTTP` has NO existing `ServiceErrorCode` that maps to 422.
 * The closest semantic for "MP rejected the request as a business rule
 * violation (user-fixable)" is `ServiceErrorCode.VALIDATION_ERROR` → HTTP 400.
 * We use 400 rather than invent a new code, which would require a schemas-package
 * change outside T-002 scope. The distinction between 400 and 422 is cosmetic
 * for clients that branch on the `code` field rather than the status. If a
 * dedicated `UNPROCESSABLE_ENTITY` code is added later, swap it here.
 *
 * ### No server-side retries (SPEC-149 Part D, descoped)
 *
 * Server-side automatic retries are OUT OF SCOPE: the idempotency middleware
 * caches only completed 2xx responses with no in-flight/pending marker, so
 * retrying would fire concurrent duplicate adapter calls. Clients should honour
 * the `Retry-After` header emitted on 503 responses and back off themselves.
 *
 * @module lib/billing-provider-error
 */

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';

// ---------------------------------------------------------------------------
// Detail shape emitted in ServiceError.details for provider errors.
// Never includes raw bodies or PII — provider is always 'payment-provider'.
// ---------------------------------------------------------------------------

/**
 * Safe details attached to provider-error `ServiceError` instances.
 * All fields are provider-neutral. The `provider` field is always the
 * literal string `'payment-provider'` — it must never name the upstream
 * brand (e.g. 'MercadoPago') to keep the integration opaque to clients.
 */
export interface ProviderErrorDetails {
    /** Fixed sentinel — always 'payment-provider' (never 'MercadoPago'). */
    readonly provider: 'payment-provider';
    /** The qzpay-core operation string, e.g. 'checkout_create'. */
    readonly operation: string;
    /** Extracted numeric HTTP status from the upstream error, if available. */
    readonly providerStatus?: number | undefined;
    /**
     * Seconds the client should wait before retrying. Present only for
     * `PROVIDER_RATE_LIMITED` (MP 429) responses.
     */
    readonly retryAfter?: number | undefined;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `err` is an instance of `QZPayProviderSyncError` as
 * exported from `@qazuor/qzpay-core`.
 *
 * `QZPayProviderSyncError` is verified to be exported from the package root
 * (`@qazuor/qzpay-core/src/errors/index.ts` → re-exported by `index.ts`).
 *
 * @param err - The value caught from a try/catch block.
 * @returns Type predicate narrowing `err` to `QZPayProviderSyncError`.
 */
export function isBillingProviderError(err: unknown): err is QZPayProviderSyncError {
    return err instanceof QZPayProviderSyncError;
}

// ---------------------------------------------------------------------------
// Status extraction — handles both stub shape and real adapter shape
// ---------------------------------------------------------------------------

/**
 * The `QZPayMercadoPagoError.code` string values that the adapter throws.
 * These are the same strings as `QZPayErrorCode` in the mercadopago adapter's
 * `error-mapper.ts` (copied here to avoid importing from the adapter package
 * directly, which is an internal dependency of `@repo/billing`).
 */
const MP_ERROR_CODE_TO_STATUS: Readonly<Record<string, number>> = {
    rate_limit_error: 429,
    authentication_error: 401,
    invalid_request: 400,
    resource_not_found: 404,
    invalid_card: 422,
    insufficient_funds: 422,
    card_declined: 422,
    duplicate_transaction: 409,
    processing_error: 500,
    provider_error: 500
};

/**
 * Extracts the numeric HTTP status from the `cause` of a
 * `QZPayProviderSyncError`. Returns `undefined` when no status can be
 * determined (malformed / unexpected cause shape).
 *
 * Priority:
 * 1. `cause.status` — numeric (stub shape + some MP SDK paths).
 * 2. `cause.statusCode` — numeric (alternative SDK field name).
 * 3. `cause.code` — maps `QZPayMercadoPagoError` string codes to synthetic
 *    numeric statuses via {@link MP_ERROR_CODE_TO_STATUS}.
 *
 * @param err - A detected `QZPayProviderSyncError`.
 * @returns Numeric HTTP status or `undefined`.
 */
function extractProviderStatus(err: QZPayProviderSyncError): number | undefined {
    const cause = err.cause;
    if (!cause) {
        return undefined;
    }

    if (typeof cause === 'object' && cause !== null) {
        // Shape 1: stub / direct numeric status field
        if ('status' in cause && typeof (cause as Record<string, unknown>).status === 'number') {
            return (cause as Record<string, unknown>).status as number;
        }

        // Shape 2: alternative field name used by some HTTP clients
        if (
            'statusCode' in cause &&
            typeof (cause as Record<string, unknown>).statusCode === 'number'
        ) {
            return (cause as Record<string, unknown>).statusCode as number;
        }

        // Shape 3: QZPayMercadoPagoError.code string → synthetic status
        if ('code' in cause && typeof (cause as Record<string, unknown>).code === 'string') {
            const codeStr = (cause as Record<string, unknown>).code as string;
            const mapped = MP_ERROR_CODE_TO_STATUS[codeStr];
            if (mapped !== undefined) {
                return mapped;
            }
        }
    }

    return undefined;
}

// ---------------------------------------------------------------------------
// Mapping input type
// ---------------------------------------------------------------------------

/**
 * Input for {@link mapProviderErrorToServiceError}.
 */
export interface MapProviderErrorInput {
    /** The detected `QZPayProviderSyncError`. */
    readonly error: QZPayProviderSyncError;
    /** The qzpay-core operation string (e.g. 'checkout_create', 'subscription_create'). */
    readonly operation: string;
    /**
     * Optional `Retry-After` seconds hint extracted from the upstream response
     * headers. When present and the error maps to `PROVIDER_RATE_LIMITED`,
     * this value is forwarded in `details.retryAfter`. Defaults to 30 seconds.
     */
    readonly retryAfterSeconds?: number | undefined;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Maps a `QZPayProviderSyncError` to a `ServiceError` with the correct
 * `ServiceErrorCode` and safe `ProviderErrorDetails`.
 *
 * Mapping table (status → code → HTTP):
 * | Extracted status      | ServiceErrorCode        | HTTP |
 * |-----------------------|-------------------------|------|
 * | 422                   | VALIDATION_ERROR        |  400 |
 * | 429                   | PROVIDER_RATE_LIMITED   |  503 |
 * | 408 / 504             | PROVIDER_TIMEOUT        |  504 |
 * | 5xx / other 4xx       | PROVIDER_ERROR          |  502 |
 * | undefined (malformed) | PROVIDER_ERROR          |  502 |
 *
 * **422 note**: `ServiceErrorCode.VALIDATION_ERROR` maps to HTTP 400 (there is
 * no 422-mapped code in `ERROR_CODE_TO_HTTP`). The distinction is cosmetic for
 * clients that branch on `code` rather than HTTP status. See module-level
 * JSDoc for the full rationale.
 *
 * **User-facing messages** always say "payment provider", never "MercadoPago".
 *
 * **Retry-After**: the returned `details.retryAfter` is consumed by
 * `createErrorHandler` in `middlewares/response.ts` to set the `Retry-After`
 * response header for `PROVIDER_RATE_LIMITED` responses.
 *
 * @param input - Mapping input (error + operation + optional retryAfterSeconds).
 * @returns A `ServiceError` ready to throw or pass to `captureBillingError`.
 */
export function mapProviderErrorToServiceError({
    error,
    operation,
    retryAfterSeconds
}: MapProviderErrorInput): ServiceError {
    const providerStatus = extractProviderStatus(error);

    const baseDetails = {
        provider: 'payment-provider' as const,
        operation,
        providerStatus
    };

    // MP 422 — user-fixable business rule violation.
    // Maps to VALIDATION_ERROR (→400). See module JSDoc for 422 choice rationale.
    if (providerStatus === 422) {
        return new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The payment provider rejected the request. Please check your payment details and try again.',
            baseDetails
        );
    }

    // MP 429 — rate limit hit on our side against the provider.
    // Maps to PROVIDER_RATE_LIMITED (→503) + Retry-After.
    if (providerStatus === 429) {
        const retryAfter = retryAfterSeconds ?? 30;
        return new ServiceError(
            ServiceErrorCode.PROVIDER_RATE_LIMITED,
            'The payment provider is temporarily unavailable. Please try again shortly.',
            { ...baseDetails, retryAfter }
        );
    }

    // MP 408 or 504 — upstream timeout.
    // Maps to PROVIDER_TIMEOUT (→504).
    if (providerStatus === 408 || providerStatus === 504) {
        return new ServiceError(
            ServiceErrorCode.PROVIDER_TIMEOUT,
            'The payment provider did not respond in time. Please try again.',
            baseDetails
        );
    }

    // All other cases: 5xx, unrecognised 4xx, undefined (malformed / no-status).
    // Maps to PROVIDER_ERROR (→502).
    return new ServiceError(
        ServiceErrorCode.PROVIDER_ERROR,
        'An unexpected error occurred with the payment provider. Please try again later.',
        baseDetails
    );
}
