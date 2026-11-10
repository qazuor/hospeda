/**
 * Write-side guard for slugs Astro would shadow with a static route segment.
 *
 * `@repo/schemas` owns the list (`RESERVED_LISTING_SLUGS`) and the read-only
 * predicate; this module turns the predicate into the service-layer error every
 * listing write path shares. It lives in `utils` so the two large services
 * (`accommodation.service.ts`, `base-listing.service.ts`) only call it.
 *
 * The error is a `VALIDATION_ERROR` (HTTP 400) with
 * `details.field = 'slug'` and `details.reason = 'RESERVED'`. The error
 * contract puts 400 before 404, so callers must invoke this before any
 * destination lookup.
 *
 * @module utils/listing-reserved-slug
 */

import { isReservedListingSlug, ServiceErrorCode, type VerticalValue } from '@repo/schemas';
import { ServiceError } from '../types';

/** Input of {@link assertListingSlugNotReserved}. */
export interface AssertListingSlugNotReservedInput {
    /** Listing vertical the slug belongs to. */
    readonly vertical: VerticalValue;
    /** Slug supplied by the caller. */
    readonly slug: string;
}

/**
 * Rejects an explicitly supplied listing slug that a static route segment
 * would outrank.
 *
 * A generated slug never reaches this guard: the generators treat a reserved
 * candidate as taken and append a numeric suffix instead.
 *
 * @param input - The vertical and the explicit slug.
 * @throws {ServiceError} `VALIDATION_ERROR` with `details.field = 'slug'` and
 * `details.reason = 'RESERVED'`.
 */
export function assertListingSlugNotReserved(input: AssertListingSlugNotReservedInput): void {
    if (!isReservedListingSlug(input)) {
        return;
    }

    throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reserved listing slug', {
        field: 'slug',
        reason: 'RESERVED'
    });
}
