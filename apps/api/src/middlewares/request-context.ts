/**
 * Request context middleware (SPEC-184; correlation: HOS-1424).
 *
 * Wraps each request in an AsyncLocalStorage scope populated with the
 * request's identity fields. Any async work spawned during the request
 * — including code deep in shared packages — can call
 * {@link getRequestContext} to retrieve `requestId`, `correlationId`,
 * `method`, `path`, and (after actor resolution) `userId` / `role` without
 * needing access to the Hono Context.
 *
 * The correlation id is minted HERE, at the edge, once per business
 * intention (NUCLEO/08 §2.1, AC:U2:9): a client that already holds one sends
 * it in `x-correlation-id` and it is respected when it is a valid UUID;
 * anything else (absent, malformed, oversized) is replaced by a fresh UUID,
 * because the value is stored in `uuid` columns and must never let a caller
 * inject arbitrary text into the audit trail. It is echoed on the response
 * so the client can send it back on the next request of the same intention.
 *
 * Registration order matters: this middleware MUST be placed immediately after
 * `requestId()` (from `hono/request-id`) so that `c.get('requestId')` is
 * already populated when the store is built.
 *
 * @module middlewares/request-context
 */

import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { runWithRequestContext } from '../lib/request-context';

/** Header that carries the correlation id, in both directions. */
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/** Any RFC 4122 UUID (any version), case-insensitive. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the correlation id of a request: the client's when it is a valid
 * UUID (normalised to lower case), a freshly minted one otherwise.
 *
 * @param input - The raw `x-correlation-id` header value, if any.
 * @returns The correlation id to use, and whether it was minted here.
 */
export function resolveCorrelationId(input: { readonly header: string | undefined }): {
    readonly correlationId: string;
    readonly minted: boolean;
} {
    const candidate = input.header?.trim();
    if (candidate && UUID_PATTERN.test(candidate)) {
        return { correlationId: candidate.toLowerCase(), minted: false };
    }
    return { correlationId: randomUUID(), minted: true };
}

/**
 * Hono middleware that establishes a per-request AsyncLocalStorage scope.
 *
 * Reads `requestId` from the Hono Context (set by `hono/request-id` which
 * must be registered before this middleware), resolves the correlation id,
 * then wraps the downstream handler chain inside {@link runWithRequestContext}
 * so every awaited function sees the store.
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
        const { correlationId } = resolveCorrelationId({
            header: c.req.header(CORRELATION_ID_HEADER)
        });

        c.header(CORRELATION_ID_HEADER, correlationId);

        await runWithRequestContext({
            store: { requestId, correlationId, method, path },
            fn: async () => {
                await next();
            }
        });

        // A handler that returned a raw Response (or the error handler) may have
        // dropped the header set above; put it back when the headers allow it.
        if (!c.res.headers.has(CORRELATION_ID_HEADER)) {
            try {
                c.res.headers.set(CORRELATION_ID_HEADER, correlationId);
            } catch {
                // Immutable headers (a proxied fetch Response): nothing to echo.
            }
        }
    };
}
