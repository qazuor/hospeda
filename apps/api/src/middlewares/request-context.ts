/**
 * Request context middleware (SPEC-184).
 *
 * Wraps each request in an AsyncLocalStorage scope populated with the
 * request's identity fields. Any async work spawned during the request
 * — including code deep in shared packages — can call
 * {@link getRequestContext} to retrieve `requestId`, `method`, `path`, and
 * (after actor resolution) `userId` / `role` without needing access to the
 * Hono Context.
 *
 * Registration order matters: this middleware MUST be placed immediately after
 * `requestId()` (from `hono/request-id`) so that `c.get('requestId')` is
 * already populated when the store is built.
 *
 * @module middlewares/request-context
 */

import type { MiddlewareHandler } from 'hono';
import { runWithRequestContext } from '../lib/request-context';

/**
 * Hono middleware that establishes a per-request AsyncLocalStorage scope.
 *
 * Reads `requestId` from the Hono Context (set by `hono/request-id` which
 * must be registered before this middleware), then wraps the downstream
 * handler chain inside {@link runWithRequestContext} so every awaited
 * function sees the store.
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // In create-app.ts, after requestId():
 * app.use(wrapMiddleware(requestId()))
 *    .use(wrapMiddleware(requestContextMiddleware()));
 * ```
 */
export function requestContextMiddleware(): MiddlewareHandler {
    return async (c, next) => {
        const requestId = c.get('requestId') ?? 'unknown';
        const method = c.req.method;
        const path = c.req.path;

        await runWithRequestContext({
            store: { requestId, method, path },
            fn: async () => {
                await next();
            }
        });
    };
}
