/**
 * @file errors.ts
 * @description Typed error classes for the Hospeda mobile API client.
 *
 * Two distinct failure modes exist:
 *
 * 1. `ApiError` — the server responded with a non-2xx status code, OR the
 *    JSON envelope carried `success: false`. Carries the HTTP status, the
 *    API error `code` string (e.g. `NOT_FOUND`, `UNAUTHORIZED`), and the
 *    human-readable `message` from the server.
 *
 * 2. `ApiSchemaError` — the server returned HTTP 2xx with `success: true`,
 *    but the `data` field did not satisfy the caller-supplied Zod schema.
 *    This indicates contract drift between the API and the mobile client.
 *    Fail-fast behaviour is intentional: a silent cast would hide the drift.
 *
 * @module api/errors
 */

import type { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

/**
 * Details extracted from a Hospeda API error envelope:
 * ```json
 * { "success": false, "error": { "code": "…", "message": "…" } }
 * ```
 */
export interface ApiErrorDetail {
    /** Machine-readable error code from the server (e.g. `NOT_FOUND`). */
    readonly code: string;
    /** Human-readable error message from the server. */
    readonly message: string;
    /** Optional machine-readable reason (emitted unconditionally when present). */
    readonly reason?: string;
}

/**
 * Thrown when the API returns a non-2xx HTTP status, or when the JSON envelope
 * contains `success: false`.
 *
 * @example
 * ```ts
 * try {
 *   const { data } = await apiFetch({ path: '/api/v1/public/…', schema: MySchema });
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     console.error(`HTTP ${err.status} — [${err.apiCode}] ${err.apiMessage}`);
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
    /** HTTP status code of the failed response (e.g. 401, 404, 500). */
    readonly status: number;

    /**
     * Machine-readable error code from the API envelope, or `'UNKNOWN'` when
     * the server did not return a structured error body.
     */
    readonly apiCode: string;

    /**
     * Human-readable error message from the API envelope, or the HTTP status
     * text when no structured body is available.
     */
    readonly apiMessage: string;

    /**
     * Optional machine-readable reason (forwarded from the API `reason` field).
     * Clients may branch on this value without requiring debug mode.
     */
    readonly reason: string | undefined;

    /**
     * @param status - HTTP status code
     * @param detail - Parsed error detail from the API envelope
     */
    constructor(status: number, detail: ApiErrorDetail) {
        super(`[${detail.code}] ${detail.message} (HTTP ${status})`);
        this.name = 'ApiError';
        this.status = status;
        this.apiCode = detail.code;
        this.apiMessage = detail.message;
        this.reason = detail.reason;
        // Maintain proper prototype chain across TypeScript downlevelling
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

// ---------------------------------------------------------------------------
// ApiSchemaError
// ---------------------------------------------------------------------------

/**
 * Thrown when the API returned a successful response (`success: true`, 2xx),
 * but the `data` payload failed Zod validation against the caller-supplied
 * schema.
 *
 * This is a contract-drift failure — the API changed a shape that the mobile
 * client has not been updated to handle. It should be treated as an unrecoverable
 * client-update signal, not retried.
 *
 * @example
 * ```ts
 * try {
 *   const { data } = await apiFetch({ path: '/api/v1/public/…', schema: MySchema });
 * } catch (err) {
 *   if (err instanceof ApiSchemaError) {
 *     console.error('Contract drift detected:', err.zodError.issues);
 *   }
 * }
 * ```
 */
export class ApiSchemaError extends Error {
    /**
     * The raw Zod validation error. Inspect `.zodError.issues` for a structured
     * description of each failing field.
     */
    readonly zodError: ZodError;

    /**
     * The raw data that failed validation. Useful for diagnostics/logging.
     * Type is `unknown` because the server payload did not match the schema.
     */
    readonly receivedData: unknown;

    /**
     * @param zodError - The Zod parse failure from `schema.safeParse(data)`
     * @param receivedData - The raw server payload that failed validation
     */
    constructor(zodError: ZodError, receivedData: unknown) {
        super(
            `API schema drift: response data did not match expected schema — ${zodError.message}`
        );
        this.name = 'ApiSchemaError';
        this.zodError = zodError;
        this.receivedData = receivedData;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
