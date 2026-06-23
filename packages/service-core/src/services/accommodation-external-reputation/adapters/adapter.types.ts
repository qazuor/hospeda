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
 * **Async two-phase extension (SPEC-250)**:
 * Adapters backed by Apify additionally implement the optional `startRun` and
 * `mapDatasetItems` methods to support the async polling pattern.  Adapters that
 * resolve fully inline (e.g. Google via Places API) do NOT implement these.
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
     * For Apify-backed adapters (Booking fallback, Airbnb): `fetch()` handles only
     * the fast inline path (e.g. JSON-LD for Booking).  If the inline path yields
     * all-null aggregates and `startRun` is present, the service will call
     * `startRun()` to enqueue an async Apify run instead.
     *
     * @param listing - The external listing record (provides URL, externalId, platform).
     * @returns Resolved reputation data, always with all fields defined (nullable).
     */
    fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult>;

    /**
     * Phase A — enqueue an Apify actor run for this listing asynchronously.
     *
     * Implemented ONLY by adapters that use Apify as a data source
     * (Booking fallback path, Airbnb full path).  Adapters without an Apify
     * dependency (Google, Generic) do NOT implement this method.
     *
     * The service checks for the presence of this method before calling it:
     * ```ts
     * if (adapter.startRun) {
     *   const run = await adapter.startRun(listing);
     * }
     * ```
     *
     * **Degradation contract**: returns `null` (never throws) on:
     * - Missing credentials (token / actor slug not configured).
     * - Apify API error (non-201 response, network failure, bad response shape).
     *
     * On success, returns `{ runId, datasetId }` so the caller can persist them
     * for later polling by the cron job (`poll-apify-reputation-runs`).
     *
     * @param listing - The external listing record (provides URL for actor input).
     * @returns `{ runId, datasetId }` on successful enqueue, or `null` on failure.
     */
    startRun?(
        listing: AccommodationExternalListing
    ): Promise<{ runId: string; datasetId: string } | null>;

    /**
     * Phase B — map raw Apify dataset items to a {@link ReputationFetchResult}.
     *
     * Implemented by the same adapters that implement {@link startRun}.  Called
     * by the polling cron job (`poll-apify-reputation-runs`) AFTER the Apify run
     * has reached `SUCCEEDED` status and the dataset items have been fetched via
     * `getApifyDatasetItems()`.
     *
     * **MUST be a pure function** — no HTTP calls, no side effects.  The cron job
     * calls this synchronously in its result-mapping step; any network I/O here
     * would block the poller's tight loop.
     *
     * Respects the AC-7.1 legal constraint: MUST NOT populate `snippets`.
     *
     * @param items - Raw dataset items as returned by `getApifyDatasetItems()`.
     * @param listing - The external listing record (used for fallback `deepLink`).
     * @returns A fully-populated {@link ReputationFetchResult} (all fields nullable).
     */
    mapDatasetItems?(
        items: unknown[],
        listing: AccommodationExternalListing
    ): ReputationFetchResult;
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
