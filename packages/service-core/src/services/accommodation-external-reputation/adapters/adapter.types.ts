/**
 * Reputation adapter types (SPEC-237 T-006)
 *
 * Defines the shared types and the {@link ReputationAdapter} interface that
 * every platform-specific reputation fetch adapter must implement.
 *
 * **Design constraints**:
 * - Only Google is allowed to populate `snippets`.  All other platform adapters
 *   MUST set `snippets: null` (AC-7.1 legal guard against scraping review text
 *   from platforms that prohibit it in their ToS).
 * - All aggregate fields are nullable — a fresh listing may have no reviews yet,
 *   and a failed/blocked fetch must leave previously-cached values intact.
 *
 * @module services/accommodation-external-reputation/adapters/adapter.types
 */

import type { ExternalReviewSnippet } from '@repo/schemas';
import type { AccommodationExternalListing } from '@repo/schemas';

// ---------------------------------------------------------------------------
// ReputationFetchResult
// ---------------------------------------------------------------------------

/**
 * The result returned by a {@link ReputationAdapter} after a single platform
 * fetch attempt.
 *
 * All fields are nullable because:
 * - A newly-registered listing may have zero reviews on the platform.
 * - A blocked or degraded fetch should not overwrite previously-cached data
 *   with `undefined` — callers must explicitly handle `null` as "not available
 *   this run".
 *
 * **Legal constraint (AC-7.1)**: `snippets` MUST be `null` for every adapter
 * except {@link GoogleReputationAdapter}.  Booking, Airbnb, and generic
 * adapters must strip snippet text before returning this type.
 */
export interface ReputationFetchResult {
    /**
     * Overall numeric rating as returned by the platform (e.g. 4.7 on a 1–5
     * scale, or 9.2 on a 1–10 scale).  `null` when the platform has no rating
     * yet or the fetch did not return one.
     */
    readonly rating: number | null;
    /**
     * Total number of reviews as returned by the platform.
     * `null` when unavailable.
     */
    readonly reviewsCount: number | null;
    /**
     * Deep link to the listing's reviews section on the external platform.
     * Shown on the public detail page when `showLink` is true.
     * `null` when the platform does not provide a direct reviews URL.
     */
    readonly deepLink: string | null;
    /**
     * Up to N most relevant / most recent review snippets.
     *
     * **Legal constraint (AC-7.1)**: Only {@link GoogleReputationAdapter} may
     * populate this field.  All other adapters MUST return `null` regardless of
     * what the upstream source returns.
     *
     * `null` when the platform does not support snippet fetching, when the
     * adapter is legally prohibited from returning text, or when the last fetch
     * was not successful.
     */
    readonly snippets: readonly ExternalReviewSnippet[] | null;
    /**
     * URL to the platform's required attribution notice (e.g. the Google Maps
     * attribution URL that must be shown alongside Google review data).
     * Optional — only set when the platform legally requires it.
     * `null` or `undefined` when attribution is not required.
     */
    readonly attributionUrl?: string | null;
}

// ---------------------------------------------------------------------------
// ReputationAdapter
// ---------------------------------------------------------------------------

/**
 * Contract that every platform-specific reputation fetch adapter must satisfy.
 *
 * Each adapter is responsible for:
 * 1. Fetching the current aggregate rating and review count from the platform.
 * 2. Optionally fetching snippet text (Google only — AC-7.1).
 * 3. Mapping the raw platform response to a {@link ReputationFetchResult}.
 * 4. Never throwing — all failures degrade to a result with `null` fields.
 *
 * @example
 * ```ts
 * const adapter: ReputationAdapter = new GoogleReputationAdapter();
 * const result = await adapter.fetch(listing);
 * // result.rating, result.reviewsCount, result.snippets (Google only)
 * ```
 */
export interface ReputationAdapter {
    /**
     * Fetches current reputation data for the given external listing.
     *
     * Implementations MUST:
     * - Never throw — degrade to `{ rating: null, reviewsCount: null, deepLink: null, snippets: null }`.
     * - Respect the AC-7.1 legal constraint: only Google may populate `snippets`.
     * - Use the `listing.url` and/or `listing.externalId` to resolve the platform resource.
     *
     * @param listing - The external listing record (provides URL, externalId, platform).
     * @returns Resolved reputation data, always with all fields defined (nullable).
     */
    fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult>;
}

// ---------------------------------------------------------------------------
// Null / empty result helper
// ---------------------------------------------------------------------------

/**
 * Returns an empty / degraded {@link ReputationFetchResult} where all fields
 * are `null`.  Adapters use this as their degradation sentinel so callers can
 * distinguish "fetch ran but found nothing" from a thrown error.
 *
 * @returns An empty reputation result with all nullable fields set to `null`.
 */
export function emptyReputationResult(): ReputationFetchResult {
    return {
        rating: null,
        reviewsCount: null,
        deepLink: null,
        snippets: null,
        attributionUrl: null
    };
}
