/**
 * @file types.ts
 * @description Shared type definitions for the Hospeda mobile API client.
 *
 * These types model the Hospeda API wire format confirmed from:
 * - `apps/api/src/utils/response-helpers.ts` — `ApiResponse` / `ErrorResponse`
 * - `apps/api/src/schemas/response-schemas.ts` — Zod schemas + TS types
 *
 * The API envelope ALWAYS wraps responses in:
 * ```
 * // Success
 * { success: true, data: T, metadata?: { timestamp, requestId, … } }
 *
 * // Error
 * { success: false, error: { code, message, reason? }, metadata?: { … } }
 * ```
 *
 * Paginated list endpoints wrap `data` in:
 * ```
 * { success: true, data: { items: T[], pagination: PaginationMetadata } }
 * ```
 *
 * @module api/types
 */

import type { ZodTypeAny } from 'zod';

// ---------------------------------------------------------------------------
// API envelope shapes (wire format)
// ---------------------------------------------------------------------------

/**
 * Pagination metadata returned by list endpoints.
 * Matches `paginationMetadataSchema` in `apps/api/src/schemas/response-schemas.ts`.
 */
export interface PaginationMetadata {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
}

/**
 * Successful API response envelope (wire format).
 * The `data` field contains the actual payload for the caller's schema to validate.
 */
export interface ApiSuccessEnvelope<T = unknown> {
    readonly success: true;
    readonly data: T;
    readonly metadata?: {
        readonly timestamp?: string;
        readonly requestId?: string;
    };
}

/**
 * Error API response envelope (wire format).
 * Returned by the server on non-2xx status codes or logical failures.
 */
export interface ApiErrorEnvelope {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
        readonly reason?: string;
    };
    readonly metadata?: {
        readonly timestamp?: string;
        readonly requestId?: string;
    };
}

/**
 * Paginated list envelope (the `data` field of a paginated success response).
 * Used when the endpoint wraps items in `{ items, pagination }`.
 */
export interface PaginatedData<T> {
    readonly items: readonly T[];
    readonly pagination: PaginationMetadata;
}

// ---------------------------------------------------------------------------
// apiFetch input / output
// ---------------------------------------------------------------------------

/**
 * HTTP method union for API requests.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Input parameters for {@link apiFetch}.
 *
 * @template T - TypeScript type of the validated `data` payload (inferred from `schema`).
 *
 * @example Fetching a public list
 * ```ts
 * import { AccommodationPublicSchema } from '@repo/schemas';
 * const { data } = await apiFetch({
 *   path: '/api/v1/public/accommodations',
 *   schema: z.array(AccommodationPublicSchema),
 * });
 * ```
 *
 * @example Posting to a protected endpoint
 * ```ts
 * const { data } = await apiFetch({
 *   path: '/api/v1/protected/bookmarks',
 *   method: 'POST',
 *   body: { accommodationId: '…' },
 *   schema: BookmarkSchema,
 * });
 * ```
 */
export interface ApiFetchInput<S extends ZodTypeAny> {
    /**
     * API path, relative to the API base URL. MUST start with `/api/v1/public/`
     * or `/api/v1/protected/`. Paths starting with `/api/v1/admin/` are
     * rejected at runtime (mobile clients must NEVER call admin endpoints).
     */
    readonly path: string;

    /** HTTP method. Defaults to `'GET'`. */
    readonly method?: HttpMethod;

    /**
     * Query parameters serialized into the URL. Values are coerced to strings;
     * `undefined` and `null` values are omitted.
     */
    readonly query?: Record<string, string | number | boolean | null | undefined>;

    /**
     * Request body. Serialized as JSON. Setting this automatically adds
     * `Content-Type: application/json`.
     */
    readonly body?: unknown;

    /**
     * Zod schema for the **`data` payload** inside the success envelope.
     * The client calls `schema.parse(envelope.data)` after confirming
     * `success === true`. A parse failure throws `ApiSchemaError`.
     */
    readonly schema: S;

    /**
     * Optional AbortSignal for request cancellation (e.g. from React `useEffect`
     * cleanup or TanStack Query's signal).
     */
    readonly signal?: AbortSignal;
}

/**
 * Successful output of {@link apiFetch}.
 * The `data` field is typed as `S['_output']` (Zod inferred output type).
 */
export interface ApiFetchOutput<T> {
    /** The validated and typed payload from the API `data` field. */
    readonly data: T;
}
