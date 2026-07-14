/**
 * Shared query-parsing helper for the occupancy calendar's three GET
 * endpoints (public, protected, admin — HOS-43 Phase 1).
 *
 * All three routes accept the same optional `?from&to` half-open range
 * (spec section 5/6: `from` inclusive, `to` exclusive — "check-out day is
 * free"). Both must be provided together (an asymmetric `from` without `to`,
 * or vice versa, is a client error, not "fetch everything"); when neither is
 * provided the route falls back to fetching the full occupancy set. Kept as
 * a single shared helper so the `from < to` validation and error shape do not
 * drift across the three route files.
 *
 * @module routes/accommodation/occupancy-range-util
 */

import { AccommodationOccupancyRangeQuerySchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';

/**
 * A resolved occupancy range query: either both bounds set, or both `undefined`.
 */
export interface ResolvedOccupancyRange {
    readonly from: string | undefined;
    readonly to: string | undefined;
}

/**
 * Validates and normalizes the raw `from`/`to` query strings shared by the
 * public/protected/admin occupancy GET routes.
 *
 * @param raw - The raw (already regex-validated by the route's `requestQuery`
 *   schema) `from`/`to` strings, possibly `undefined`.
 * @returns `{ from, to }` when both are present and `from < to`; `{ from: undefined, to: undefined }`
 *   when neither is present (the route should fetch the full occupancy set).
 * @throws {ServiceError} `VALIDATION_ERROR` when exactly one of `from`/`to` is
 *   provided, or when `from >= to`.
 */
export function resolveOccupancyRangeQuery(raw: {
    from?: string;
    to?: string;
}): ResolvedOccupancyRange {
    const { from, to } = raw;

    if (!from && !to) {
        return { from: undefined, to: undefined };
    }

    if (!from || !to) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Both "from" and "to" must be provided together, or neither.'
        );
    }

    const parsed = AccommodationOccupancyRangeQuerySchema.safeParse({ from, to });
    if (!parsed.success) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            parsed.error.issues[0]?.message ?? '"from" must be strictly before "to".'
        );
    }

    return { from: parsed.data.from, to: parsed.data.to };
}
