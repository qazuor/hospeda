/**
 * Shared HTTP-status → log-level resolver, for errors that do not carry a
 * `ServiceErrorCode` — namely Hono's `HTTPException`, thrown directly by
 * middleware (e.g. the auth guard's 401 on a guest hitting a protected
 * route, or its 403 on a permission/admin-access denial).
 *
 * Companion to `resolveErrorLogLevel` (`@repo/service-core`), which levels
 * errors that DO carry a `ServiceErrorCode`. Mirrors the same
 * EXPECTED-outcome intent (HOS-109 / OQ-1): a guest 401 and a missing-
 * resource 404 are routine browsing outcomes → `info`; a 403 permission
 * denial (and a 402 entitlement gate) is a probing/business-gate signal
 * worth slightly more visibility → `warn`; everything else stays `error`.
 *
 * This lives in `utils/` rather than inside either formatter because BOTH of
 * them need it: `createErrorHandler` (`middlewares/response.ts`, the global
 * `app.onError` handler for errors thrown from middleware) and
 * `handleRouteError` (`utils/response-helpers.ts`, every route-factory
 * route's catch, reached again via `streaming-route-factory.ts`'s pre-stream
 * error path). They are twin formatters — `apps/api/docs/error-contract.md`
 * R4 — and previously held separate copies of this exact function, one of
 * them unexported, which is what let a 404/410/422 log as `ERROR` with a
 * full stack on the `handleRouteError` path while the global handler had
 * already been fixed for the same case under HOS-109 (HOS-622). A single
 * shared function is what keeps a status leveled identically on both paths.
 *
 * @module utils/http-status-log-level
 */

import type { ErrorLogLevel } from '@repo/service-core';

/**
 * Maps a raw HTTP status code to the log level its errors should be emitted at.
 *
 * @param status - The HTTP status code carried by the `HTTPException`.
 * @returns The log level to emit at; defaults to `error`.
 */
export const resolveHttpStatusLogLevel = (status: number): ErrorLogLevel => {
    switch (status) {
        case 401:
        case 404:
            return 'info';
        case 402:
        // An entitlement gate is a business outcome, not a fault: logging it at
        // `error` with a stack trace floods the ERROR stream with every blocked
        // write of every lapsed host (HOS-283).
        case 403:
            return 'warn';
        default:
            return 'error';
    }
};
