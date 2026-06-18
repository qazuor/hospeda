/**
 * Google Reputation Adapter (SPEC-237 T-006)
 *
 * Fetches the current aggregate rating, review count, and up to 5 review
 * snippets from the Google Places API (New) Place Details endpoint.
 *
 * **Field mask**: requests `rating,userRatingsTotal,reviews` in addition to
 * the display/URL fields needed for `deepLink` construction.  This is the ONLY
 * adapter permitted to fetch and surface review snippets (AC-7.1).
 *
 * **Place ID resolution**: uses the same pattern as the SPEC-222 import adapter
 * but implemented here independently — the import adapter intentionally omits
 * `rating`/`reviews` from its field mask and must NOT be modified.  A local
 * `resolveGooglePlaceId` helper mirrors the import adapter's extraction logic.
 *
 * **Degradation contract**: never throws.  Any missing credential, unresolvable
 * Place ID, non-2xx response, or network error returns
 * {@link emptyReputationResult}.
 *
 * **Attribution**: Google Maps Platform requires that applications show a
 * "Powered by Google" attribution when displaying Places data.  This adapter
 * populates `attributionUrl` with the standard Google Maps attribution link for
 * the place so the service layer / UI can render the required notice.
 *
 * @module services/accommodation-external-reputation/adapters/google-reputation
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import type { ExternalReviewSnippet } from '@repo/schemas';
import type { ReputationAdapter, ReputationFetchResult } from './adapter.types.js';
import { emptyReputationResult } from './adapter.types.js';

// ---------------------------------------------------------------------------
// Credentials shape
// ---------------------------------------------------------------------------

/**
 * Credentials required by the Google reputation adapter.
 * Injected at construction time so the adapter is testable without env reads.
 */
export interface GoogleReputationCredentials {
    /** Google Places API (New) key.  Empty string signals "no key" — degrade. */
    readonly googlePlacesApiKey: string;
}

// ---------------------------------------------------------------------------
// Places API (New) response types
// ---------------------------------------------------------------------------

/**
 * A review author attribution sub-object.
 */
interface PlacesReviewAuthor {
    readonly displayName?: string;
    readonly uri?: string;
    readonly photoUri?: string;
}

/**
 * A single review entry as returned by the Places API (New).
 * Field names follow the Places API (New) camelCase conventions.
 */
interface PlacesReview {
    readonly name?: string;
    readonly relativePublishTimeDescription?: string;
    readonly rating?: number;
    readonly text?: {
        readonly text?: string;
        readonly languageCode?: string;
    };
    readonly originalText?: {
        readonly text?: string;
    };
    readonly authorAttribution?: PlacesReviewAuthor;
    readonly publishTime?: string;
}

/**
 * Subset of the Places API (New) Place Details response used by this adapter.
 * Only fields included in the field mask will be present.
 */
interface PlacesReputationApiResponse {
    readonly rating?: number;
    readonly userRatingsTotal?: number;
    readonly reviews?: readonly PlacesReview[];
    readonly googleMapsUri?: string;
    readonly displayName?: {
        readonly text?: string;
    };
}

/**
 * Error response wrapper from the Places API.
 */
interface PlacesApiErrorResponse {
    readonly error?: {
        readonly message?: string;
        readonly code?: number;
    };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Places API (New) base URL for Place Details.
 * Fixed trusted host — exempt from `safeExternalFetch` per AC-10.2.
 */
const PLACES_API_BASE = 'https://places.googleapis.com/v1/places';

/**
 * Field mask for reputation fetching.
 *
 * UNLIKE the import adapter (SPEC-222) this mask INTENTIONALLY includes
 * `rating`, `userRatingsTotal`, and `reviews`.  This is the reputation adapter
 * — fetching these fields is its sole purpose.
 */
const REPUTATION_FIELD_MASK = 'rating,userRatingsTotal,reviews,googleMapsUri,displayName';

/**
 * Maximum number of review snippets to surface.  The Places API (New) returns
 * up to 5 reviews per request; we cap at the same value.
 */
const MAX_SNIPPETS = 5;

/**
 * Google Maps attribution URL prefix.  Per Google's attribution requirements,
 * applications that display Places data must show a "Powered by Google" notice
 * with a link to this base URL (or the place-specific `googleMapsUri`).
 */
const GOOGLE_ATTRIBUTION_URL = 'https://www.google.com/maps';

// ---------------------------------------------------------------------------
// Place ID resolution (local — must NOT modify the SPEC-222 import adapter)
// ---------------------------------------------------------------------------

/**
 * Attempts to extract a Google Place ID from a Maps URL string.
 *
 * Mirrors the extraction logic in the SPEC-222 `google-places.adapter.ts` but
 * lives here independently so the import adapter's field mask is never changed.
 *
 * Extraction strategy (priority order):
 * 1. `place_id` query parameter — `?place_id=ChIJ...`.
 * 2. `ChIJ`-prefixed token anywhere in the URL string.
 *
 * @param rawUrl - The external listing URL string.
 * @returns The extracted Place ID, or `null` when none is found.
 */
function resolveGooglePlaceId(rawUrl: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }

    // Strategy 1: explicit `place_id` query param
    const fromParam = parsed.searchParams.get('place_id');
    if (fromParam?.startsWith('ChIJ')) {
        return fromParam;
    }

    // Strategy 2: scan the full URL for a ChIJ-prefixed token
    const match = /ChIJ[A-Za-z0-9_\-]{10,50}/.exec(parsed.href);
    if (match?.[0]) {
        return match[0];
    }

    return null;
}

// ---------------------------------------------------------------------------
// Snippet mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Places API (New) review entry to an {@link ExternalReviewSnippet}.
 *
 * @param review - A single Places API review object.
 * @returns A mapped snippet, or `null` when the review lacks the minimum
 *   required fields (`author` and `text`).
 */
function mapReviewToSnippet(review: PlacesReview): ExternalReviewSnippet | null {
    const author = review.authorAttribution?.displayName;
    const text = review.text?.text ?? review.originalText?.text;

    // Both author and text are required by the ExternalReviewSnippet schema.
    if (!author || !text) {
        return null;
    }

    return {
        author,
        text,
        rating: review.rating ?? null,
        timeIso: review.publishTime ?? null,
        authorUrl: review.authorAttribution?.uri ?? null,
        profilePhoto: review.authorAttribution?.photoUri ?? null,
        relativeTime: review.relativePublishTimeDescription ?? null
    };
}

// ---------------------------------------------------------------------------
// GoogleReputationAdapter
// ---------------------------------------------------------------------------

/**
 * Reputation adapter for Google Maps / Google Places listings.
 *
 * Resolves the Place ID from the listing URL (or `listing.externalId`), calls
 * the Places API (New) Place Details endpoint with a field mask that includes
 * `rating`, `userRatingsTotal`, and `reviews`, then maps the response to a
 * {@link ReputationFetchResult} — the ONLY adapter allowed to populate
 * `snippets` (AC-7.1).
 *
 * **Never throws** — all failure paths return {@link emptyReputationResult}.
 *
 * @example
 * ```ts
 * const adapter = new GoogleReputationAdapter({ googlePlacesApiKey: 'AIza...' });
 * const result = await adapter.fetch(listing);
 * // result.rating      → e.g. 4.7
 * // result.snippets    → up to 5 ExternalReviewSnippet objects (may be null)
 * // result.deepLink    → Google Maps URL for the place
 * ```
 */
export class GoogleReputationAdapter implements ReputationAdapter {
    readonly #credentials: GoogleReputationCredentials;

    /**
     * @param credentials - Google Places API credentials.
     */
    constructor(credentials: GoogleReputationCredentials) {
        this.#credentials = credentials;
    }

    /**
     * Fetches the current reputation data for a Google Maps listing.
     *
     * **Step 1 — Credential check**: Returns {@link emptyReputationResult}
     * immediately when `googlePlacesApiKey` is empty.
     *
     * **Step 2 — Place ID resolution**: Tries `listing.externalId` first, then
     * falls back to parsing `listing.url`.  If neither yields a Place ID,
     * returns {@link emptyReputationResult}.
     *
     * **Step 3 — Places API call**: Fetches `rating`, `userRatingsTotal`,
     * `reviews`, `googleMapsUri`, and `displayName` via the Place Details
     * endpoint.  Non-2xx responses and network errors degrade gracefully.
     *
     * **Step 4 — Mapping**: Converts the API response to a
     * {@link ReputationFetchResult}.  Maps up to {@link MAX_SNIPPETS} review
     * snippets; sets `attributionUrl` to the place's `googleMapsUri` (or the
     * generic Google Maps URL as fallback) per Google's attribution policy.
     *
     * @param listing - The external listing record to fetch reputation for.
     * @returns Populated {@link ReputationFetchResult}, or all-null on degradation.
     */
    async fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult> {
        // Step 1: Credential check
        const apiKey = this.#credentials.googlePlacesApiKey;
        if (!apiKey) {
            return emptyReputationResult();
        }

        // Step 2: Place ID resolution — prefer externalId, fall back to URL
        const placeId = listing.externalId ?? resolveGooglePlaceId(listing.url);
        if (!placeId) {
            return emptyReputationResult();
        }

        // Step 3: Places API (New) Place Details call
        let apiResponse: PlacesReputationApiResponse;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15_000);

            let response: Response;
            try {
                response = await fetch(`${PLACES_API_BASE}/${placeId}`, {
                    method: 'GET',
                    headers: {
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': REPUTATION_FIELD_MASK
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (!response.ok) {
                return emptyReputationResult();
            }

            const json = (await response.json()) as
                | PlacesReputationApiResponse
                | PlacesApiErrorResponse;

            if ('error' in json && json.error) {
                return emptyReputationResult();
            }

            apiResponse = json as PlacesReputationApiResponse;
        } catch {
            // Network error, abort, JSON parse error — degrade
            return emptyReputationResult();
        }

        // Step 4: Map the API response to ReputationFetchResult
        return buildReputationResult(apiResponse, listing.url);
    }
}

// ---------------------------------------------------------------------------
// buildReputationResult (pure mapping — no network I/O, no throws)
// ---------------------------------------------------------------------------

/**
 * Maps a Places API (New) response to a {@link ReputationFetchResult}.
 *
 * **Legal note (AC-7.1)**: This is the ONLY place in the codebase where
 * snippet text may be extracted and surfaced.  The Google Maps Platform Terms
 * of Service allow displaying review text when accompanied by proper
 * attribution.  All other platform adapters MUST return `snippets: null`.
 *
 * @param place - The raw Places API response.
 * @param listingUrl - The original listing URL (used as deepLink fallback).
 * @returns A fully populated ReputationFetchResult.
 */
function buildReputationResult(
    place: PlacesReputationApiResponse,
    listingUrl: string
): ReputationFetchResult {
    const rating = typeof place.rating === 'number' ? place.rating : null;
    const reviewsCount = typeof place.userRatingsTotal === 'number' ? place.userRatingsTotal : null;

    // deepLink: prefer the place-specific googleMapsUri; fall back to listing URL
    const deepLink = place.googleMapsUri ?? listingUrl;

    // snippets: map up to MAX_SNIPPETS reviews, discard entries missing required fields
    let snippets: readonly ExternalReviewSnippet[] | null = null;
    if (Array.isArray(place.reviews) && place.reviews.length > 0) {
        const mapped = place.reviews
            .slice(0, MAX_SNIPPETS)
            .map(mapReviewToSnippet)
            .filter((s): s is ExternalReviewSnippet => s !== null);
        snippets = mapped.length > 0 ? mapped : null;
    }

    // attributionUrl: the place-specific Maps URI is the canonical attribution
    // link per Google Maps Platform requirements.
    const attributionUrl = place.googleMapsUri ?? GOOGLE_ATTRIBUTION_URL;

    return {
        rating,
        reviewsCount,
        deepLink,
        snippets,
        attributionUrl
    };
}
