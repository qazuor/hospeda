/**
 * Generic AsyncLocalStorage-based request context (SPEC-184).
 *
 * Provides a per-request store that propagates automatically across all async
 * work spawned during that request — including code in shared packages that
 * never receives the Hono Context. The store is populated by
 * {@link requestContextMiddleware} and can be enriched later (e.g., after
 * actor resolution) via {@link setRequestContextActor}.
 *
 * Design constraints (approved by owner):
 * - No logger imports — this module must remain dependency-free so it can be
 *   consumed by SPEC-180 (Sentry) and the app-log DB sink without cycles.
 * - No ip / user-agent — explicitly excluded (PII).
 * - MUTABLE store object so downstream middlewares can enrich it in-place
 *   without re-running the ALS.
 *
 * @module lib/request-context
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of the per-request store held in AsyncLocalStorage.
 *
 * All fields except `requestId`, `method`, and `path` are optional because
 * the store is created before authentication and enriched progressively.
 */
export interface RequestContextStore {
    /** Unique identifier for the request (from `hono/request-id`). */
    requestId: string;
    /** HTTP method in uppercase, e.g. `"GET"`. */
    method: string;
    /** URL pathname, e.g. `"/api/v1/public/accommodations"`. */
    path: string;
    /** Authenticated user ID — set after actor resolution. */
    userId?: string;
    /** Authenticated user role string — set after actor resolution. */
    role?: string;
}

/**
 * Input shape for {@link runWithRequestContext}.
 */
export interface RunWithRequestContextInput {
    /** Initial store values for the request lifetime. */
    store: RequestContextStore;
    /** Async function to run inside the ALS scope. */
    fn: () => Promise<void>;
}

/**
 * Input shape for {@link setRequestContextActor}.
 */
export interface SetRequestContextActorInput {
    /** Authenticated user ID. */
    userId: string;
    /** Authenticated user role string. */
    role: string;
}

// ---------------------------------------------------------------------------
// AsyncLocalStorage instance
// ---------------------------------------------------------------------------

/**
 * Singleton AsyncLocalStorage instance that holds the per-request context.
 * Exported for advanced use (e.g., forking in tests); prefer the wrapper
 * functions for everyday use.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs `fn` inside an AsyncLocalStorage scope seeded with `store`.
 *
 * Any async work spawned from `fn` (including work in packages that only
 * call {@link getRequestContext}) will see the same store object. Because the
 * store is mutable, later calls to {@link setRequestContextActor} update it
 * in-place without needing a new ALS scope.
 *
 * @param input - Store seed and async function to run.
 * @returns Promise that resolves when `fn` completes.
 *
 * @example
 * ```ts
 * await runWithRequestContext({
 *   store: { requestId: '123', method: 'GET', path: '/api/v1/public/health' },
 *   fn: async () => {
 *     await next(); // downstream handlers see the store
 *   },
 * });
 * ```
 */
export async function runWithRequestContext(input: RunWithRequestContextInput): Promise<void> {
    const { store, fn } = input;
    await requestContextStorage.run(store, fn);
}

/**
 * Returns the current request's store, or `undefined` when called outside
 * an active ALS scope (e.g., during server startup, background jobs that were
 * not wrapped, or in tests that don't exercise the middleware).
 *
 * Callers must handle the `undefined` case gracefully.
 *
 * @returns The active {@link RequestContextStore} or `undefined`.
 *
 * @example
 * ```ts
 * const ctx = getRequestContext();
 * if (ctx) {
 *   console.log(ctx.requestId); // safe to use
 * }
 * ```
 */
export function getRequestContext(): RequestContextStore | undefined {
    return requestContextStorage.getStore();
}

/**
 * Mutates the active request's store to record the resolved actor.
 *
 * This is a no-op when called outside an active ALS scope (e.g., in
 * unauthenticated code paths or unit tests that don't run the middleware),
 * so it is always safe to call unconditionally.
 *
 * @param input - Actor identity to attach to the current request context.
 *
 * @example
 * ```ts
 * // Inside actor middleware, after resolving the authenticated user:
 * setRequestContextActor({ userId: user.id, role: user.role });
 * ```
 */
export function setRequestContextActor(input: SetRequestContextActorInput): void {
    const store = requestContextStorage.getStore();
    if (!store) {
        // No active scope — no-op. Happens for guest requests or when called
        // from code paths that run before the ALS scope is established.
        return;
    }
    store.userId = input.userId;
    store.role = input.role;
}
