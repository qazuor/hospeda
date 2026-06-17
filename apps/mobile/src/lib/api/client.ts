/**
 * @file client.ts
 * @description Typed fetch wrapper for the Hospeda Hono API (mobile).
 *
 * ## Design
 *
 * This module is the ONLY place in the mobile app that calls the Hospeda API.
 * It enforces three invariants on every request:
 *
 * 1. **Tier guard** — paths starting with `/api/v1/admin/` are rejected at
 *    runtime. The mobile app is restricted to `/api/v1/public/*` and
 *    `/api/v1/protected/*`.
 *
 * 2. **Auth injection** — the Better Auth session cookie is read from
 *    SecureStore via `getCookie()` (exported by `@/lib/auth-client`) and
 *    attached as a `Cookie` header. No separate token store is needed.
 *
 * 3. **Schema validation** — every success response is parsed with the
 *    caller-supplied Zod schema. A mismatch (contract drift) throws
 *    `ApiSchemaError` immediately rather than letting the app silently render
 *    wrong data.
 *
 * ## Return style: throw on failure
 *
 * The client throws typed errors instead of returning a `Result<T, E>` union.
 * Rationale: The primary consumers of this client will be TanStack Query hooks
 * (T-010), which natively expect thrown errors and surface them via `error`
 * state. A Result union would require every query function to manually unwrap
 * it — adding boilerplate with no safety benefit since TanStack Query already
 * separates loading, error, and success states.
 *
 * Errors thrown:
 * - `ApiError` — non-2xx status or `success: false` envelope from the server.
 * - `ApiSchemaError` — 2xx success but Zod schema validation failed (drift).
 * - Native `Error` / `DOMException` — network failure or request abort.
 *
 * @module api/client
 *
 * @example Fetch a public accommodation list
 * ```ts
 * import { z } from 'zod';
 * import { AccommodationPublicSchema } from '@repo/schemas';
 * import { apiFetch } from '@/lib/api/client';
 *
 * // The caller supplies the schema for the `data` payload (not the envelope).
 * const { data } = await apiFetch({
 *   path: '/api/v1/public/accommodations',
 *   query: { page: 1, pageSize: 12 },
 *   schema: z.object({
 *     items: z.array(AccommodationPublicSchema),
 *     pagination: z.object({ total: z.number(), page: z.number() }).passthrough(),
 *   }),
 * });
 * // data.items is typed as AccommodationPublic[]
 * ```
 *
 * @example Post to a protected endpoint
 * ```ts
 * import { BookmarkSchema } from '@repo/schemas';
 * import { apiFetch } from '@/lib/api/client';
 *
 * const { data } = await apiFetch({
 *   path: '/api/v1/protected/bookmarks',
 *   method: 'POST',
 *   body: { accommodationId: 'abc-123' },
 *   schema: BookmarkSchema,
 * });
 * ```
 *
 * @example Error handling
 * ```ts
 * import { ApiError, ApiSchemaError } from '@/lib/api/errors';
 * import { apiFetch } from '@/lib/api/client';
 *
 * try {
 *   const { data } = await apiFetch({ path: '/api/v1/public/…', schema: MySchema });
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     // HTTP/API failure: err.status, err.apiCode, err.apiMessage
 *   } else if (err instanceof ApiSchemaError) {
 *     // Contract drift: err.zodError.issues
 *   } else {
 *     // Network error or abort
 *   }
 * }
 * ```
 */

import type { ZodTypeAny } from 'zod';
import { getCookie } from '../auth-client';
import { API_BASE_URL } from '../env';
import { ApiError, ApiSchemaError } from './errors';
import type { ApiErrorEnvelope, ApiFetchInput, ApiFetchOutput, ApiSuccessEnvelope } from './types';

// Base URL is resolved + validated centrally in `../env` so the auth client and
// the data client always target the same server.

// ---------------------------------------------------------------------------
// Admin-tier guard
// ---------------------------------------------------------------------------

/** Prefix that the mobile client must NEVER call. */
const ADMIN_PATH_PREFIX = '/api/v1/admin';

/**
 * Throws if `path` targets the admin tier. Mobile clients are restricted to
 * `/api/v1/public/*` and `/api/v1/protected/*`.
 *
 * @throws Error when `path` starts with `/api/v1/admin`
 */
const assertNotAdminPath = (path: string): void => {
    if (path.startsWith(ADMIN_PATH_PREFIX)) {
        throw new Error(
            `Mobile API client may not call admin endpoints. Received path "${path}" starts with "${ADMIN_PATH_PREFIX}". Use /api/v1/public/* or /api/v1/protected/* instead.`
        );
    }
};

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the full request URL from a relative path and optional query params.
 * Values that are `undefined`, `null`, or empty string are omitted.
 *
 * @param path - Relative path (must start with `/`)
 * @param query - Optional query parameters
 * @returns Full URL string
 */
const buildUrl = (
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>
): string => {
    const normalised = path.startsWith('/') ? path : `/${path}`;
    const base = `${API_BASE_URL}${normalised}`;

    if (!query) {
        return base;
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
};

// ---------------------------------------------------------------------------
// Envelope parsers
// ---------------------------------------------------------------------------

/**
 * Determines whether the raw JSON body is a Hospeda success envelope.
 */
const isSuccessEnvelope = (body: unknown): body is ApiSuccessEnvelope =>
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success: unknown }).success === true;

/**
 * Determines whether the raw JSON body is a Hospeda error envelope.
 */
const isErrorEnvelope = (body: unknown): body is ApiErrorEnvelope =>
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    (body as { success: unknown }).success === false &&
    'error' in body;

// ---------------------------------------------------------------------------
// Main export: apiFetch
// ---------------------------------------------------------------------------

/**
 * Typed fetch wrapper for the Hospeda API.
 *
 * Enforces:
 * - Tier guard: rejects `/api/v1/admin/*` paths.
 * - Auth injection: attaches `Cookie` header from `getCookie()` when a
 *   session exists.
 * - Schema validation: parses the `data` payload with the caller's Zod
 *   schema; throws `ApiSchemaError` on drift.
 *
 * @template S - Zod schema type for the `data` payload.
 * @param input - Request configuration (path, method, query, body, schema, signal).
 * @returns Promise resolving to `{ data: S['_output'] }` on success.
 *
 * @throws {Error} When `path` starts with `/api/v1/admin`.
 * @throws {ApiError} When the server returns non-2xx or `success: false`.
 * @throws {ApiSchemaError} When the response data fails Zod validation.
 * @throws {DOMException} When the request is aborted via `signal`.
 * @throws {Error} On network failure or JSON parse error.
 *
 * @example
 * ```ts
 * import { DestinationPublicSchema } from '@repo/schemas';
 * const { data } = await apiFetch({
 *   path: '/api/v1/public/destinations/buenos-aires',
 *   schema: DestinationPublicSchema,
 * });
 * ```
 */
export const apiFetch = async <S extends ZodTypeAny>({
    path,
    method = 'GET',
    query,
    body,
    schema,
    signal
}: ApiFetchInput<S>): Promise<ApiFetchOutput<S['_output']>> => {
    // 1. Tier guard — must run before any network call
    assertNotAdminPath(path);

    // 2. Build URL
    const url = buildUrl(path, query);

    // 3. Build headers
    const headers: Record<string, string> = {};

    // Attach session cookie from SecureStore (via Better Auth expoClient).
    // getCookie() is typed as () => string by better-auth; it returns an empty
    // string '' when no session is present (SecureStore has no stored cookie),
    // so we guard with a truthiness check to avoid sending `Cookie: `.
    const cookie = getCookie();
    if (cookie) {
        headers.Cookie = cookie;
    }

    // Content-Type for JSON bodies
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    // 4. Execute fetch
    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal
    });

    // 5. Parse response body as JSON
    let rawBody: unknown;
    try {
        rawBody = await response.json();
    } catch {
        // Non-JSON body on a failed response — surface as ApiError
        throw new ApiError(response.status, {
            code: 'PARSE_ERROR',
            message: `Failed to parse response as JSON (HTTP ${response.status})`
        });
    }

    // 6. Handle non-2xx HTTP status
    if (!response.ok) {
        if (isErrorEnvelope(rawBody)) {
            throw new ApiError(response.status, {
                code: rawBody.error.code,
                message: rawBody.error.message,
                reason: rawBody.error.reason
            });
        }
        // Non-structured error body (e.g. plain-text 500 from a proxy)
        throw new ApiError(response.status, {
            code: 'HTTP_ERROR',
            message: `Request failed with HTTP ${response.status}`
        });
    }

    // 7. Handle success: false in a 2xx body (should not happen in practice,
    //    but the API contract allows it when the envelope explicitly says false)
    if (isErrorEnvelope(rawBody)) {
        throw new ApiError(response.status, {
            code: rawBody.error.code,
            message: rawBody.error.message,
            reason: rawBody.error.reason
        });
    }

    // 8. Verify the envelope is a success envelope
    if (!isSuccessEnvelope(rawBody)) {
        throw new ApiError(response.status, {
            code: 'UNEXPECTED_SHAPE',
            message: 'API response does not match the expected { success, data } envelope'
        });
    }

    // 9. Zod-parse the `data` payload (fail-fast on contract drift)
    const parsed = schema.safeParse(rawBody.data);
    if (!parsed.success) {
        throw new ApiSchemaError(parsed.error, rawBody.data);
    }

    return { data: parsed.data as S['_output'] };
};
