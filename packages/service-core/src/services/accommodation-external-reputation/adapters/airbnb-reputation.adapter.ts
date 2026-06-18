/**
 * Airbnb Reputation Adapter (SPEC-237 T-006)
 *
 * Fetches the current aggregate rating and review count from an Airbnb listing
 * via the shared {@link runApifyActor} Apify client.
 *
 * **AC-7.1 legal constraint**: Airbnb's ToS prohibits automated extraction and
 * redistribution of review text.  This adapter MUST NEVER populate `snippets`.
 * The result always has `snippets: null` regardless of what the Apify actor
 * returns.
 *
 * **Degradation contract**: when either `apifyToken` or `apifyAirbnbActor` is
 * absent the adapter returns {@link emptyReputationResult} immediately without
 * making any network call.  All other failure paths also degrade gracefully —
 * the method never throws.
 *
 * @module services/accommodation-external-reputation/adapters/airbnb-reputation
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import { runApifyActor } from '../../accommodation-import/adapters/apify-client.js';
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
    readonly rating?: number | string | null;
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
 * Fetches aggregate `rating` and `reviewsCount` via the configured Apify actor.
 * `snippets` is ALWAYS `null` (AC-7.1 legal guard — Airbnb ToS prohibits
 * review text redistribution).
 *
 * @example
 * ```ts
 * const adapter = new AirbnbReputationAdapter({
 *   apifyToken: 'apify_api_xxx',
 *   apifyAirbnbActor: 'dtrungtin/airbnb-scraper',
 * });
 * const result = await adapter.fetch(listing);
 * // result.snippets === null (always — AC-7.1)
 * ```
 */
export class AirbnbReputationAdapter implements ReputationAdapter {
    readonly #credentials: AirbnbReputationCredentials;

    /**
     * @param credentials - Apify credentials.  When `apifyToken` or
     *   `apifyAirbnbActor` is absent every `fetch` call degrades immediately.
     */
    constructor(credentials: AirbnbReputationCredentials) {
        this.#credentials = credentials;
    }

    /**
     * Fetches reputation data for an Airbnb listing.
     *
     * Always returns `snippets: null` regardless of what the actor returns.
     *
     * **Degradation steps**:
     * 1. Missing credentials → return {@link emptyReputationResult}.
     * 2. Apify actor returns empty dataset → return {@link emptyReputationResult}.
     * 3. Any network/timeout error (handled by {@link runApifyActor}) → empty result.
     *
     * @param listing - The external listing record (provides URL).
     * @returns Reputation data with `snippets: null`.
     */
    async fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult> {
        const token = this.#credentials.apifyToken;
        const actor = this.#credentials.apifyAirbnbActor;

        // Credential degradation — no network call when either is absent
        if (!token || !actor) {
            return emptyReputationResult();
        }

        try {
            const dataset = await runApifyActor({
                token,
                actor,
                actorInput: { startUrls: [{ url: listing.url }] },
                timeoutMs: 30_000
            });

            if (dataset.length === 0) {
                return emptyReputationResult();
            }

            const item = dataset[0] as AirbnbReputationItem;

            const rating = toNumber(
                item.rating ?? item.starRating ?? item.guestSatisfactionOverall
            );
            const reviewsCount = toNumber(
                item.reviewsCount ?? item.numberOfReviews ?? item.reviewCount
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
        } catch {
            return emptyReputationResult();
        }
    }
}
