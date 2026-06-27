/**
 * @file query-client.ts
 * @description Configured TanStack Query `QueryClient` singleton for the Hospeda
 * mobile app.
 *
 * ## Singleton rationale
 *
 * React Native has no SSR. Unlike TanStack Start (admin app), where a per-request
 * `QueryClient` is needed for cache isolation between server renders, in RN there
 * is exactly one JS runtime per app process. A module-level singleton is therefore
 * the correct pattern — every call to `import { queryClient }` resolves the same
 * object, which means the cache is shared across the entire app lifetime.
 *
 * The admin app's `__root.tsx` CLAUDE.md note about "per-request QueryClient in
 * useState" does NOT apply here. Do not move this into a `useState` initializer.
 *
 * ## Retry strategy
 *
 * TanStack Query retries failed queries up to 3 times by default. Our retry
 * predicate filters out client errors (4xx) that will never succeed on retry:
 *
 * - **No retry**: `ApiError` with status 400, 401, 403, 404, 422 — these are
 *   deterministic failures; retrying wastes bandwidth and delays the error UI.
 * - **Retry (up to 3 times)**: network errors, `DOMException` (abort is caught
 *   by TanStack Query before the predicate), and 5xx server errors — these are
 *   transient and may succeed after a brief delay.
 *
 * `ApiSchemaError` (contract drift) is NOT in the no-retry list because it
 * extends `Error` and we want it retried — it could theoretically be a transient
 * proxy issue, though in practice it signals a client update is needed.
 *
 * @module api/query-client
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

// ---------------------------------------------------------------------------
// Retry predicate
// ---------------------------------------------------------------------------

/**
 * HTTP status codes that represent deterministic client errors.
 * Requests failing with these statuses will NOT be retried.
 */
const CLIENT_ERROR_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 422]);

/**
 * Determines whether TanStack Query should retry a failed query.
 *
 * Returns `false` (no retry) when:
 * - The error is an `ApiError` whose status is in {@link CLIENT_ERROR_STATUSES}.
 *   These are deterministic failures (bad request, unauthorized, forbidden,
 *   not found, unprocessable entity) that will not change on retry.
 *
 * Returns `true` (retry allowed) for all other errors:
 * - `ApiError` with 5xx status (server error, likely transient).
 * - `ApiError` with status outside the client-error set (e.g. 429 rate limit).
 * - Native `Error` / `TypeError` (network failure — no connectivity, DNS).
 * - `DOMException` with name `AbortError` (already caught by TQ before this).
 * - `ApiSchemaError` (fail-fast contract drift, but allow TQ to manage count).
 *
 * @param failureCount - Number of attempts made so far (1-based on first call)
 * @param error - The thrown error from the query function
 * @returns `true` to allow a retry, `false` to surface the error immediately
 */
export const shouldRetry = (failureCount: number, error: unknown): boolean => {
    if (error instanceof ApiError && CLIENT_ERROR_STATUSES.has(error.status)) {
        return false;
    }
    // TanStack Query will cap at `retries` (3) regardless; returning true here
    // just says "this failure type is retryable".
    return failureCount < 3;
};

// ---------------------------------------------------------------------------
// QueryClient singleton
// ---------------------------------------------------------------------------

/**
 * Configured TanStack Query `QueryClient` for the mobile app.
 *
 * Default options applied to all queries and mutations:
 *
 * | Setting | Value | Rationale |
 * |---------|-------|-----------|
 * | `staleTime` | 5 min | Public API data (accommodations, destinations) changes infrequently. Fresh data for 5 min avoids redundant refetches on tab switches. |
 * | `gcTime` | 10 min | Keep inactive cache for 10 min to speed up back-navigation. Twice the staleTime to avoid evicting data that might be reused soon. |
 * | `retry` | See predicate | 3 retries for transient errors; 0 retries for client errors (4xx). |
 * | `retryDelay` | exponential | Default TQ exponential backoff (1s → 2s → 4s, capped at 30s). |
 * | `refetchOnWindowFocus` | `false` | No browser window-focus event in RN. Avoids spurious refetches from AppState changes (those are handled per-hook when needed). |
 * | `refetchOnReconnect` | `true` | Refetch stale queries when connectivity is restored. |
 *
 * This is a module-level singleton (safe for RN — no SSR, single JS runtime).
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            /**
             * Data is considered fresh for 5 minutes after fetching.
             * During this window TanStack Query will NOT re-fetch in the background,
             * even when the component remounts.
             */
            staleTime: 5 * 60 * 1000,

            /**
             * Unused cache entries are garbage-collected after 10 minutes.
             * A value larger than `staleTime` ensures the cache survives a
             * brief unmount (e.g. navigating away and back).
             */
            gcTime: 10 * 60 * 1000,

            /**
             * Retry predicate. Client errors (4xx) are NOT retried; transient
             * failures (network, 5xx) are retried up to 3 times.
             *
             * TanStack Query accepts either a boolean, a number (max retry count),
             * or a predicate `(failureCount, error) => boolean`. The predicate form
             * gives us per-error-type control.
             */
            retry: shouldRetry,

            /**
             * Window-focus refetch is not meaningful in React Native.
             * (AppState-based refetch can be wired per-hook when needed.)
             */
            refetchOnWindowFocus: false,

            /**
             * Automatically refetch stale queries when the device regains
             * network connectivity.
             */
            refetchOnReconnect: true
        },
        mutations: {
            /**
             * Mutations are not retried by default — they are side-effectful
             * and retrying could cause duplicate writes. Each mutation hook
             * can opt-in to retry logic explicitly if safe.
             */
            retry: false
        }
    }
});
