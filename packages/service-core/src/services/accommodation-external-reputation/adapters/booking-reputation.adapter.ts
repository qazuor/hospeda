/**
 * Booking.com Reputation Adapter (SPEC-237 T-006, updated SPEC-250)
 *
 * Fetches the current aggregate rating and review count from Booking.com
 * using a two-phase strategy:
 *
 * **Phase A — inline (fast path)**:
 * `fetch()` uses `safeExternalFetch` to retrieve the Booking.com listing page
 * and parses the `aggregateRating` schema.org block from the embedded JSON-LD.
 * Zero cost when successful (~1 s).  Returns the result immediately.
 *
 * If the JSON-LD path yields all-null aggregates, `fetch()` returns an
 * empty result.  The service layer then detects the all-null result, sees that
 * `startRun` is available, and calls it to enqueue an async Apify run.
 *
 * **Phase B — async (Apify path, SPEC-250)**:
 * `startRun(listing)` enqueues an Apify actor run asynchronously via
 * {@link startApifyRun} and returns `{ runId, datasetId }`.  The polling cron
 * job (`poll-apify-reputation-runs`) calls `mapDatasetItems(items, listing)`
 * once the run succeeds to extract the aggregate reputation values.
 *
 * **AC-7.1 legal constraint**: Booking.com's ToS prohibits automated
 * extraction and redistribution of review text.  This adapter MUST NEVER
 * populate `snippets`.  The result always has `snippets: null` regardless of
 * what the upstream source provides.
 *
 * **Never throws** — all failure paths return {@link emptyReputationResult}.
 *
 * @module services/accommodation-external-reputation/adapters/booking-reputation
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import { safeExternalFetch } from '@repo/utils/safe-fetch';
import { startApifyRun } from '../../accommodation-import/adapters/apify-client.js';
import type { ReputationAdapter, ReputationFetchResult } from './adapter.types.js';
import { emptyReputationResult } from './adapter.types.js';

// ---------------------------------------------------------------------------
// Credentials shape
// ---------------------------------------------------------------------------

/**
 * Credentials required by the Booking.com reputation adapter.
 */
export interface BookingReputationCredentials {
    /** Apify API token.  Required for the fallback path. */
    readonly apifyToken?: string;
    /** Apify actor slug for Booking.com scraping (e.g. `apify/booking-scraper`). */
    readonly apifyBookingActor?: string;
}

// ---------------------------------------------------------------------------
// JSON-LD parsing helpers
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a schema.org `aggregateRating` node that we parse from
 * the JSON-LD embedded in the Booking.com listing page.
 */
interface JsonLdAggregateRating {
    readonly ratingValue?: number | string;
    readonly reviewCount?: number | string;
    readonly ratingCount?: number | string;
}

/**
 * Minimal JSON-LD graph node that may contain an `aggregateRating`.
 */
interface JsonLdNode {
    readonly '@type'?: string | readonly string[];
    readonly aggregateRating?: JsonLdAggregateRating;
    readonly '@graph'?: readonly JsonLdNode[];
}

/**
 * Parses schema.org `aggregateRating` data from a JSON-LD block embedded in
 * an HTML page.
 *
 * Walks all `<script type="application/ld+json">` blocks and returns the first
 * `aggregateRating` node found, regardless of the parent schema.org type.
 *
 * @param html - Full HTML body of the listing page.
 * @returns The parsed aggregate rating shape, or `null` when not found.
 */
function parseAggregateRatingFromJsonLd(html: string): JsonLdAggregateRating | null {
    // Find all JSON-LD script tags
    const scriptPattern =
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match = scriptPattern.exec(html);

    while (match !== null) {
        const raw = match[1];
        match = scriptPattern.exec(html);
        if (!raw) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            continue;
        }

        const found = findAggregateRating(parsed);
        if (found) {
            return found;
        }
    }

    return null;
}

/**
 * Recursively searches a parsed JSON-LD value for an `aggregateRating` node.
 *
 * @param node - Parsed JSON value to search.
 * @returns The first `aggregateRating` object found, or `null`.
 */
function findAggregateRating(node: unknown): JsonLdAggregateRating | null {
    if (typeof node !== 'object' || node === null) {
        return null;
    }

    const n = node as JsonLdNode;

    if (n.aggregateRating && typeof n.aggregateRating === 'object') {
        return n.aggregateRating;
    }

    // Recurse into @graph arrays
    if (Array.isArray(n['@graph'])) {
        for (const child of n['@graph']) {
            const found = findAggregateRating(child);
            if (found) return found;
        }
    }

    // Recurse if the top-level value is an array (some pages embed an array of LD nodes)
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findAggregateRating(item);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Converts a raw `aggregateRating` JSON-LD node to `{ rating, reviewsCount }`.
 *
 * @param raw - Parsed aggregateRating object.
 * @returns Numeric rating and reviewsCount (either may be `null`).
 */
function extractFromAggregateRating(raw: JsonLdAggregateRating): {
    rating: number | null;
    reviewsCount: number | null;
} {
    const ratingRaw = raw.ratingValue;
    const rating =
        ratingRaw !== undefined
            ? typeof ratingRaw === 'number'
                ? ratingRaw
                : Number.parseFloat(String(ratingRaw))
            : null;

    const countRaw = raw.reviewCount ?? raw.ratingCount;
    const reviewsCount =
        countRaw !== undefined
            ? typeof countRaw === 'number'
                ? countRaw
                : Number.parseInt(String(countRaw), 10)
            : null;

    return {
        rating: rating !== null && Number.isFinite(rating) ? rating : null,
        reviewsCount: reviewsCount !== null && Number.isFinite(reviewsCount) ? reviewsCount : null
    };
}

// ---------------------------------------------------------------------------
// Apify dataset item type
// ---------------------------------------------------------------------------

/**
 * Subset of a Booking.com Apify actor dataset item relevant to reputation.
 *
 * **AC-7.1**: Only aggregate fields are declared here.  `reviews`, `reviewText`,
 * `reviewList`, and any other review-text keys are INTENTIONALLY ABSENT so
 * TypeScript makes it impossible to accidentally map them.
 */
interface BookingReputationItem {
    readonly rating?: number | string | null;
    readonly reviewScore?: number | string | null;
    readonly guestRating?: number | string | null;
    readonly reviewsCount?: number | string | null;
    readonly numberOfReviews?: number | string | null;
    /** `voyager/booking-scraper` returns the review count under `reviews`. */
    readonly reviews?: number | string | null;
    readonly url?: string | null;
}

/**
 * Attempts to extract a numeric value from various raw types.
 *
 * @param raw - Raw value (number, numeric string, or null/undefined).
 * @returns Parsed finite number, or `null`.
 */
function toNumber(raw: number | string | null | undefined): number | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// BookingReputationAdapter
// ---------------------------------------------------------------------------

/**
 * Reputation adapter for Booking.com listings.
 *
 * Fetches aggregate `rating` and `reviewsCount`.  `snippets` is ALWAYS `null`
 * (AC-7.1 legal guard — Booking.com prohibits text extraction).
 *
 * **Extraction flow (SPEC-250 two-phase):**
 * 1. `fetch()` tries `safeExternalFetch` + JSON-LD `aggregateRating` (fast inline path).
 * 2. If JSON-LD succeeds, returns the result inline (run_status='idle').
 * 3. If JSON-LD misses, `fetch()` returns an all-null result.  The service
 *    detects the all-null aggregate + `startRun` presence and calls `startRun()`.
 * 4. `startRun()` enqueues an async Apify actor run and returns `{ runId, datasetId }`.
 * 5. The polling cron calls `mapDatasetItems()` once the run succeeds.
 *
 * @example
 * ```ts
 * const adapter = new BookingReputationAdapter({
 *   apifyToken: 'apify_api_xxx',
 *   apifyBookingActor: 'dtrungtin/booking-scraper',
 * });
 * const result = await adapter.fetch(listing);
 * // result.snippets === null (always — AC-7.1)
 * ```
 */
export class BookingReputationAdapter implements ReputationAdapter {
    readonly #credentials: BookingReputationCredentials;

    /**
     * @param credentials - Apify credentials for the async Apify path.
     *   When omitted or empty, only the primary JSON-LD path is attempted.
     *   If JSON-LD also misses, the adapter degrades to an all-null result.
     */
    constructor(credentials: BookingReputationCredentials) {
        this.#credentials = credentials;
    }

    /**
     * Fetches reputation data for a Booking.com listing using the fast JSON-LD path.
     *
     * Attempts to parse the `aggregateRating` schema.org block from the HTML
     * page returned by `safeExternalFetch`.  If the page is blocked or contains
     * no `aggregateRating`, returns an all-null result.  The service layer will
     * then call `startRun()` to enqueue an async Apify run.
     *
     * The Apify fallback that previously lived in this method has been extracted
     * to `startRun()` and `mapDatasetItems()` (SPEC-250 Phase 3).
     *
     * Always returns `snippets: null` (AC-7.1 legal constraint).
     *
     * @param listing - The external listing record (provides URL).
     * @returns Reputation data (all-null when JSON-LD unavailable), with `snippets: null`.
     */
    async fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult> {
        try {
            // Primary — SSRF-safe fetch + JSON-LD aggregateRating
            const fetchResult = await safeExternalFetch({
                url: listing.url,
                timeoutMs: 10_000,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
                }
            });

            if (fetchResult.ok) {
                const aggregateRating = parseAggregateRatingFromJsonLd(fetchResult.body);
                if (aggregateRating) {
                    const { rating, reviewsCount } = extractFromAggregateRating(aggregateRating);
                    if (rating !== null || reviewsCount !== null) {
                        return buildBookingResult({ rating, reviewsCount, deepLink: listing.url });
                    }
                }
            }

            // JSON-LD path missed or blocked — return all-null so the service
            // can fall through to the async Apify path via startRun().
            return emptyReputationResult();
        } catch {
            return emptyReputationResult();
        }
    }

    /**
     * Phase A — enqueues an async Apify actor run for this Booking.com listing.
     *
     * Builds the same actor input used by the previous sync fallback
     * (`startUrls` with the listing URL) and calls {@link startApifyRun}.
     * Returns `{ runId, datasetId }` on success so the caller can persist
     * them for the polling cron job.
     *
     * **Degradation contract**: returns `null` (never throws) when:
     * - `apifyToken` or `apifyBookingActor` credentials are absent.
     * - {@link startApifyRun} returns `null` (API error, network failure, etc.).
     *
     * @param listing - The external listing record (provides URL for actor input).
     * @returns `{ runId, datasetId }` on success, or `null` on failure.
     */
    async startRun(
        listing: AccommodationExternalListing
    ): Promise<{ runId: string; datasetId: string } | null> {
        const token = this.#credentials.apifyToken;
        const actor = this.#credentials.apifyBookingActor;

        if (!token || !actor) {
            return null;
        }

        // Reuse the same actorInput that the previous sync fallback used.
        // OQ-2 resolution: the async /runs endpoint accepts the identical body
        // as the legacy run-sync-get-dataset-items endpoint (verified against
        // Apify REST API v2 reference, 2026-06-20).
        const result = await startApifyRun({
            token,
            actor,
            actorInput: { startUrls: [{ url: listing.url }] }
        });

        if (!result) {
            return null;
        }

        return { runId: result.runId, datasetId: result.defaultDatasetId };
    }

    /**
     * Phase B — maps raw Apify dataset items to a {@link ReputationFetchResult}.
     *
     * **Pure function — no HTTP calls.**  Called by the polling cron job after
     * `getApifyDatasetItems()` retrieves the completed run's output.
     *
     * Extracts `rating`, `reviewsCount`, and `deepLink` from the first dataset
     * item using the same field priority order as the previous sync fallback:
     * - `rating`: `item.rating ?? item.reviewScore ?? item.guestRating`
     * - `reviewsCount`: `item.reviewsCount ?? item.numberOfReviews ?? item.reviews`
     * - `deepLink`: `item.url` when present and non-empty, otherwise `listing.url`
     *
     * Always sets `snippets: null` (AC-7.1 legal constraint).
     *
     * @param items - Raw dataset items from `getApifyDatasetItems()`.
     * @param listing - The external listing record (used as fallback `deepLink`).
     * @returns A fully-populated {@link ReputationFetchResult}.
     */
    mapDatasetItems(
        items: unknown[],
        listing: AccommodationExternalListing
    ): ReputationFetchResult {
        if (items.length === 0) {
            return emptyReputationResult();
        }

        const item = items[0] as BookingReputationItem;

        return buildBookingResult({
            rating: toNumber(item.rating ?? item.reviewScore ?? item.guestRating),
            reviewsCount: toNumber(item.reviewsCount ?? item.numberOfReviews ?? item.reviews),
            deepLink: typeof item.url === 'string' && item.url ? item.url : listing.url
        });
    }
}

// ---------------------------------------------------------------------------
// Result builder
// ---------------------------------------------------------------------------

/**
 * Builds a Booking.com {@link ReputationFetchResult} from extracted aggregate
 * values.  Always sets `snippets: null` to enforce the AC-7.1 legal constraint.
 *
 * @param params - Extracted aggregate data.
 * @returns A Booking reputation result with `snippets` forced to `null`.
 */
function buildBookingResult(params: {
    rating: number | null;
    reviewsCount: number | null;
    deepLink: string;
}): ReputationFetchResult {
    return {
        rating: params.rating,
        reviewsCount: params.reviewsCount,
        deepLink: params.deepLink,
        // AC-7.1: NEVER surface review text from Booking.com
        snippets: null,
        attributionUrl: null
    };
}
