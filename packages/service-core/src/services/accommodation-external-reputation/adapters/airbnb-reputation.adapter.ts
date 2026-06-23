/**
 * Airbnb Reputation Adapter (SPEC-237 T-006, updated SPEC-250)
 *
 * Fetches the current aggregate rating and review count from an Airbnb listing
 * via an async Apify actor run (two-phase pattern introduced in SPEC-250).
 *
 * **Async two-phase pattern (SPEC-250)**:
 * - `fetch()` always returns {@link emptyReputationResult} (all null).  Airbnb
 *   has no accessible JSON-LD or public API fast path, so every fetch goes
 *   through Apify.  The service detects the all-null result + presence of
 *   `startRun` and calls the async path.
 * - `startRun(listing)` enqueues an async Apify actor run and returns
 *   `{ runId, datasetId }` for persistence by the caller.
 * - `mapDatasetItems(items, listing)` maps the completed run's dataset to a
 *   {@link ReputationFetchResult}.  Pure function — no HTTP calls.
 *
 * **AC-7.1 legal constraint**: Airbnb's ToS prohibits automated extraction and
 * redistribution of review text.  This adapter MUST NEVER populate `snippets`.
 * The result always has `snippets: null` regardless of what the Apify actor
 * returns.
 *
 * **Degradation contract**: when either `apifyToken` or `apifyAirbnbActor` is
 * absent, `startRun()` returns `null` immediately without making any network
 * call.  All other failure paths also degrade gracefully — the method never
 * throws.
 *
 * @module services/accommodation-external-reputation/adapters/airbnb-reputation
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import { startApifyRun } from '../../accommodation-import/adapters/apify-client.js';
import type { ReputationAdapter, ReputationFetchResult } from './adapter.types.js';
import { emptyReputationResult } from './adapter.types.js';

// ---------------------------------------------------------------------------
// Credentials shape
// ---------------------------------------------------------------------------

/**
 * Credentials required by the Airbnb reputation adapter.
 */
export interface AirbnbReputationCredentials {
    /** Apify API token.  Both fields are required to make a call. */
    readonly apifyToken?: string;
    /** Apify actor slug for Airbnb scraping (e.g. `apify/airbnb-scraper`). */
    readonly apifyAirbnbActor?: string;
}

// ---------------------------------------------------------------------------
// Apify dataset item type
// ---------------------------------------------------------------------------

/**
 * Subset of an Airbnb Apify actor dataset item relevant to reputation.
 *
 * **AC-7.1**: Only aggregate fields are declared here.  `reviews`, `reviewText`,
 * `reviewsList`, `guestReviews`, and any other review-text keys are
 * INTENTIONALLY ABSENT so TypeScript makes it impossible to accidentally map
 * them into the result.
 */
interface AirbnbReputationItem {
    /**
     * `rating` may be a flat number (some actors) OR a nested object (the
     * `tri_angle/airbnb-rooms-urls-scraper` returns
     * `{ guestSatisfaction, reviewsCount, ... }`). Only the aggregate
     * sub-fields are read — never any review text (AC-7.1).
     */
    readonly rating?:
        | number
        | string
        | null
        | {
              readonly guestSatisfaction?: number | string | null;
              readonly reviewsCount?: number | string | null;
          };
    readonly starRating?: number | string | null;
    readonly guestSatisfactionOverall?: number | string | null;
    readonly reviewsCount?: number | string | null;
    readonly numberOfReviews?: number | string | null;
    readonly reviewCount?: number | string | null;
    readonly url?: string | null;
}

/**
 * Parses a finite number from various raw value types.
 *
 * @param raw - A number, numeric string, or null/undefined.
 * @returns A finite number, or `null`.
 */
function toNumber(raw: number | string | null | undefined): number | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// AirbnbReputationAdapter
// ---------------------------------------------------------------------------

/**
 * Reputation adapter for Airbnb listings.
 *
 * Fetches aggregate `rating` and `reviewsCount` via an async Apify actor run.
 * `snippets` is ALWAYS `null` (AC-7.1 legal guard — Airbnb ToS prohibits
 * review text redistribution).
 *
 * **SPEC-250 two-phase pattern**: `fetch()` always returns an empty result
 * (Airbnb has no fast inline path).  The service falls through to `startRun()`
 * to enqueue an async Apify run, and the polling cron calls `mapDatasetItems()`
 * once the run succeeds.
 *
 * @example
 * ```ts
 * const adapter = new AirbnbReputationAdapter({
 *   apifyToken: 'apify_api_xxx',
 *   apifyAirbnbActor: 'dtrungtin/airbnb-scraper',
 * });
 * // fetch() always returns empty — service calls startRun() next
 * const empty = await adapter.fetch(listing);
 * const run = await adapter.startRun(listing);
 * // later, after cron resolves the run:
 * const result = adapter.mapDatasetItems(items, listing);
 * // result.snippets === null (always — AC-7.1)
 * ```
 */
export class AirbnbReputationAdapter implements ReputationAdapter {
    readonly #credentials: AirbnbReputationCredentials;

    /**
     * @param credentials - Apify credentials.  When `apifyToken` or
     *   `apifyAirbnbActor` is absent, `startRun()` degrades to `null`.
     */
    constructor(credentials: AirbnbReputationCredentials) {
        this.#credentials = credentials;
    }

    /**
     * Returns an empty reputation result.
     *
     * Airbnb has no accessible JSON-LD or fast inline data source.  Every
     * Airbnb reputation fetch goes through Apify asynchronously.  The service
     * layer detects the all-null result and presence of `startRun` and enqueues
     * an async run instead.
     *
     * The `listing` parameter is accepted for interface compatibility but is not
     * used — no network call is made.
     *
     * @param _listing - Unused; present for {@link ReputationAdapter} compatibility.
     * @returns An all-null {@link ReputationFetchResult}.
     */
    async fetch(_listing: AccommodationExternalListing): Promise<ReputationFetchResult> {
        return emptyReputationResult();
    }

    /**
     * Phase A — enqueues an async Apify actor run for this Airbnb listing.
     *
     * Builds the actor input with the listing URL as the start URL (same input
     * that the previous sync call used) and calls {@link startApifyRun}.
     * Returns `{ runId, datasetId }` on success so the caller can persist them
     * for the polling cron job.
     *
     * **Degradation contract**: returns `null` (never throws) when:
     * - `apifyToken` or `apifyAirbnbActor` credentials are absent.
     * - {@link startApifyRun} returns `null` (API error, network failure, etc.).
     *
     * OQ-2 resolution: the async `/runs` endpoint accepts the identical
     * `actorInput` body as the legacy `run-sync-get-dataset-items` endpoint
     * (verified against Apify REST API v2 reference, 2026-06-20).
     *
     * @param listing - The external listing record (provides URL for actor input).
     * @returns `{ runId, datasetId }` on success, or `null` on failure.
     */
    async startRun(
        listing: AccommodationExternalListing
    ): Promise<{ runId: string; datasetId: string } | null> {
        const token = this.#credentials.apifyToken;
        const actor = this.#credentials.apifyAirbnbActor;

        if (!token || !actor) {
            return null;
        }

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
     * item using the same field priority and normalization logic as the previous
     * sync `fetch()` implementation:
     * - `rating`: nested `item.rating.guestSatisfaction` (tri_angle actor) →
     *   flat `item.rating` → `item.starRating` → `item.guestSatisfactionOverall`
     * - `reviewsCount`: nested `item.rating.reviewsCount` → `item.reviewsCount` →
     *   `item.numberOfReviews` → `item.reviewCount`
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

        const item = items[0] as AirbnbReputationItem;

        // `rating` is either a flat number/string or a nested aggregate object
        // (`tri_angle/airbnb-rooms-urls-scraper` shape).  Pull the overall score and
        // review count from whichever shape the configured actor returns.
        const nestedRating =
            item.rating !== null && typeof item.rating === 'object' ? item.rating : undefined;
        const flatRating =
            typeof item.rating === 'number' || typeof item.rating === 'string'
                ? item.rating
                : undefined;

        const rating = toNumber(
            nestedRating?.guestSatisfaction ??
                flatRating ??
                item.starRating ??
                item.guestSatisfactionOverall
        );
        const reviewsCount = toNumber(
            nestedRating?.reviewsCount ??
                item.reviewsCount ??
                item.numberOfReviews ??
                item.reviewCount
        );
        const deepLink = typeof item.url === 'string' && item.url ? item.url : listing.url;

        return {
            rating,
            reviewsCount,
            deepLink,
            // AC-7.1: NEVER surface review text from Airbnb
            snippets: null,
            attributionUrl: null
        };
    }
}
