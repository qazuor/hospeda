/**
 * @file external-reputation-types.ts
 * @description Shared types and pure helpers of the owner-facing external
 * reputation section (HOS-2515).
 */

import type { AccommodationExternalListingsResponse } from '@repo/schemas';

/** Platform values mirroring ExternalPlatformEnum (schema dependency-free). */
export type ExternalPlatform = 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER';

/**
 * A single external listing row returned by the API.
 *
 * HOS-290: INFERRED from the shared response schema rather than hand-written.
 * A local interface describing the server's payload is what let the client and
 * the server drift far enough for this whole section to break in production.
 */
export type ExternalListingRow = AccommodationExternalListingsResponse['listings'][number];

/**
 * Reputation metadata returned by the GET listings endpoint. Same rationale as
 * {@link ExternalListingRow}: inferred, never re-described.
 */
export type ReputationMeta = AccommodationExternalListingsResponse['reputation'];

/** The two per-listing visibility flags the owner can toggle. */
export type ListingToggleField = 'showLink' | 'showReviews';

/** Every platform the owner can register, in the order the select lists them. */
export const PLATFORMS: readonly ExternalPlatform[] = ['GOOGLE', 'BOOKING', 'AIRBNB', 'OTHER'];

/**
 * Minutes to show in the rate-limit message.
 *
 * HOS-290: reads the value from the 429 JSON body (`error.details.retryAfter`,
 * which `refresh.ts` always sends) and only falls back to the `Retry-After`
 * header. The request is cross-origin and that header is not CORS-exposed, so
 * header-only parsing would always yield the 5-minute default while the real
 * window is 10.
 *
 * @param retryAfterSeconds - Seconds from the body or the header.
 * @returns Whole minutes, 5 when the value is missing or invalid.
 */
export function retryAfterMinutes(retryAfterSeconds: number | string | null | undefined): number {
    if (retryAfterSeconds === null || retryAfterSeconds === undefined) return 5;
    const secs =
        typeof retryAfterSeconds === 'number'
            ? retryAfterSeconds
            : Number.parseInt(retryAfterSeconds, 10);
    if (Number.isNaN(secs) || secs <= 0) return 5;
    return Math.ceil(secs / 60);
}
