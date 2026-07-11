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
 * - `visitorId` is an opaque random UUID (see {@link ../middlewares/visitor-id.ts}),
 *   NOT PII — it identifies a browser session cookie, never a real person,
 *   and carries no personal data. Same exclusion rationale as above does NOT
 *   apply to it.
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
    /**
     * Better Auth session ID — set alongside `userId`/`role` at actor
     * resolution when the request carries a resolved session. `undefined`
     * for guest/anonymous requests.
     */
    sessionId?: string;
    /**
     * Opaque, non-PII visitor identifier read from (or newly generated into)
     * the `hospeda_vid` session cookie — set by the visitor-id middleware.
     * Allows grouping anonymous requests from the same browser session even
     * without an authenticated user.
     */
    visitorId?: string;
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
    /**
     * Better Auth session ID, when the request carries a resolved session.
     * Set at the same seam as `userId`/`role` (actor middleware), so the
     * three fields land on the store together. Omitted for requests with no
     * session (should not happen when `userId`/`role` are set, but the field
     * stays optional for forward compatibility).
     */
    sessionId?: string;
}

/**
 * Input shape for {@link setRequestContextVisitor}.
 */
export interface SetRequestContextVisitorInput {
    /** Opaque, non-PII visitor identifier from the `hospeda_vid` cookie. */
    visitorId: string;
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
 * @param input - Actor identity (and, when available, session ID) to attach
 * to the current request context.
 *
 * @example
 * ```ts
 * // Inside actor middleware, after resolving the authenticated user:
 * setRequestContextActor({ userId: user.id, role: user.role, sessionId: session.id });
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
    if (input.sessionId !== undefined) {
        store.sessionId = input.sessionId;
    }
}

/**
 * Mutates the active request's store to record the anonymous visitor ID.
 *
 * This is a no-op when called outside an active ALS scope, so it is always
 * safe to call unconditionally. Set by the visitor-id middleware for BOTH
 * authenticated and guest requests — an authenticated request can still have
 * a `visitorId` (the same browser session), giving operators a way to
 * correlate an authenticated user's requests with any anonymous requests
 * from the same browser session before login.
 *
 * @param input - The visitor ID to attach to the current request context.
 *
 * @example
 * ```ts
 * // Inside the visitor-id middleware, after resolving/generating the cookie:
 * setRequestContextVisitor({ visitorId });
 * ```
 */
export function setRequestContextVisitor(input: SetRequestContextVisitorInput): void {
    const store = requestContextStorage.getStore();
    if (!store) {
        // No active scope — no-op.
        return;
    }
    store.visitorId = input.visitorId;
}
