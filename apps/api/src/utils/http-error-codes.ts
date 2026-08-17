/**
 * The single status → error-code table for `HTTPException`s.
 *
 * Two formatters turn a thrown `HTTPException` into the API's error envelope:
 *
 * - {@link handleRouteError} (`utils/response-helpers.ts`) — the `catch` inside
 *   the route factory, where every factory-built route lands;
 * - `createErrorHandler` (`middlewares/response.ts`) — `app.onError`, where
 *   anything thrown from middleware or a hand-rolled route lands instead.
 *
 * They used to carry SEPARATE copies of this mapping, each covering only
 * 400/401/402/403/404/409 and defaulting everything else to `INTERNAL_ERROR`.
 * That is what made a 422 announce itself as a server fault (H-105) — and it
 * was never one route: `plan-change.ts` alone throws 422 six times, and 502/503
 * /504 were in the same hole.
 *
 * Keeping the table in one module is the point. Two copies "kept in sync by
 * comment" is precisely the arrangement that drifted, so there is nothing here
 * to keep in sync: both formatters read this.
 */

import { ServiceErrorCode } from '@repo/schemas';

/**
 * Maps an HTTP status to the `error.code` the client receives.
 *
 * A 4xx must never map to `INTERNAL_ERROR`: the code is what consumers branch
 * on, and `INTERNAL_ERROR` tells them the failure is ours and worth a retry,
 * when a 4xx means the request itself needs to change.
 */
const HTTP_STATUS_TO_ERROR_CODE: Readonly<Record<number, ServiceErrorCode>> = {
    400: ServiceErrorCode.VALIDATION_ERROR,
    401: ServiceErrorCode.UNAUTHORIZED,
    402: ServiceErrorCode.ENTITLEMENT_REQUIRED,
    403: ServiceErrorCode.FORBIDDEN,
    404: ServiceErrorCode.NOT_FOUND,
    409: ServiceErrorCode.ALREADY_EXISTS,
    410: ServiceErrorCode.GONE,
    // Unprocessable: the request parsed but the server will not act on it —
    // a caller error, so VALIDATION_ERROR, never INTERNAL_ERROR (H-105).
    422: ServiceErrorCode.VALIDATION_ERROR,
    429: ServiceErrorCode.QUOTA_EXCEEDED,
    500: ServiceErrorCode.INTERNAL_ERROR,
    502: ServiceErrorCode.PROVIDER_ERROR,
    503: ServiceErrorCode.SERVICE_UNAVAILABLE,
    504: ServiceErrorCode.PROVIDER_TIMEOUT
};

/**
 * Resolves the `error.code` for an HTTP status carried by an `HTTPException`.
 *
 * Unlisted statuses fall back by CLASS rather than to `INTERNAL_ERROR`, so an
 * unforeseen 4xx still reaches the client as a caller error. Falling back to
 * `INTERNAL_ERROR` for everything is the behaviour this module exists to end.
 *
 * @param status - HTTP status of the thrown `HTTPException`
 * @returns The error code to place in the response envelope
 *
 * @example
 * resolveErrorCodeForStatus(422); // ServiceErrorCode.VALIDATION_ERROR
 * resolveErrorCodeForStatus(451); // ServiceErrorCode.VALIDATION_ERROR (4xx class)
 * resolveErrorCodeForStatus(507); // ServiceErrorCode.INTERNAL_ERROR (5xx class)
 */
export const resolveErrorCodeForStatus = (status: number): ServiceErrorCode => {
    const mapped = HTTP_STATUS_TO_ERROR_CODE[status];
    if (mapped) {
        return mapped;
    }
    if (status >= 400 && status < 500) {
        return ServiceErrorCode.VALIDATION_ERROR;
    }
    return ServiceErrorCode.INTERNAL_ERROR;
};

/**
 * The statuses this table covers explicitly. Exposed so guards can assert
 * against the real table instead of restating it — a restated list is one that
 * can agree with itself while both halves are wrong.
 */
export const MAPPED_HTTP_STATUSES: readonly number[] =
    Object.keys(HTTP_STATUS_TO_ERROR_CODE).map(Number);
