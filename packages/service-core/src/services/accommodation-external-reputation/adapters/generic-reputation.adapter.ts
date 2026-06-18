/**
 * Generic Reputation Adapter (SPEC-237 T-006)
 *
 * Universal fallback adapter for any external listing platform not covered by
 * a platform-specific adapter.  Uses `safeExternalFetch` to retrieve the
 * listing page and parses the `aggregateRating` schema.org JSON-LD block to
 * extract aggregate rating and review count.
 *
 * **AC-7.1 legal constraint**: This adapter MUST NEVER populate `snippets`.
 * The result always has `snippets: null`.  The ToS of an unknown platform is
 * unknown, so we conservatively prohibit text extraction for all generic pages.
 *
 * **Never throws** — all failure paths return {@link emptyReputationResult}.
 *
 * @module services/accommodation-external-reputation/adapters/generic-reputation
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import { safeExternalFetch } from '@repo/utils';
import type { ReputationAdapter, ReputationFetchResult } from './adapter.types.js';
import { emptyReputationResult } from './adapter.types.js';

// ---------------------------------------------------------------------------
// JSON-LD aggregateRating parsing
// ---------------------------------------------------------------------------

/**
 * Minimal shape of a schema.org `aggregateRating` node.
 */
interface JsonLdAggregateRating {
    readonly ratingValue?: number | string;
    readonly reviewCount?: number | string;
    readonly ratingCount?: number | string;
    readonly bestRating?: number | string;
    readonly worstRating?: number | string;
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
 * Parses the first `aggregateRating` node found inside any
 * `<script type="application/ld+json">` block in `html`.
 *
 * Handles:
 * - Top-level `{ "@type": "...", "aggregateRating": { ... } }` objects.
 * - `@graph`-wrapped node arrays.
 * - Arrays of LD nodes at the top level.
 *
 * @param html - Full HTML body of the listing page.
 * @returns The first `aggregateRating` object found, or `null`.
 */
export function parseAggregateRatingFromPage(html: string): JsonLdAggregateRating | null {
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

        const found = searchForAggregateRating(parsed);
        if (found) {
            return found;
        }
    }

    return null;
}

/**
 * Recursively searches a parsed JSON-LD value for an `aggregateRating` object.
 *
 * @param node - Any parsed JSON value.
 * @returns The first `aggregateRating` found, or `null`.
 */
function searchForAggregateRating(node: unknown): JsonLdAggregateRating | null {
    if (typeof node !== 'object' || node === null) {
        return null;
    }

    // Handle arrays (top-level array of LD nodes)
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = searchForAggregateRating(item);
            if (found) return found;
        }
        return null;
    }

    const n = node as JsonLdNode;

    if (n.aggregateRating && typeof n.aggregateRating === 'object') {
        return n.aggregateRating;
    }

    // Recurse into @graph
    if (Array.isArray(n['@graph'])) {
        for (const child of n['@graph']) {
            const found = searchForAggregateRating(child);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Converts raw `ratingValue` and `reviewCount` / `ratingCount` values to
 * finite numbers.
 *
 * @param raw - Parsed aggregateRating node.
 * @returns `{ rating, reviewsCount }` — either may be `null`.
 */
function extractAggregateValues(raw: JsonLdAggregateRating): {
    rating: number | null;
    reviewsCount: number | null;
} {
    const ratingRaw = raw.ratingValue;
    const rating = ratingRaw !== undefined ? Number.parseFloat(String(ratingRaw)) : null;

    const countRaw = raw.reviewCount ?? raw.ratingCount;
    const reviewsCount = countRaw !== undefined ? Number.parseInt(String(countRaw), 10) : null;

    return {
        rating: rating !== null && Number.isFinite(rating) ? rating : null,
        reviewsCount: reviewsCount !== null && Number.isFinite(reviewsCount) ? reviewsCount : null
    };
}

// ---------------------------------------------------------------------------
// GenericReputationAdapter
// ---------------------------------------------------------------------------

/**
 * Fallback reputation adapter for any unlisted external platform.
 *
 * Parses schema.org `aggregateRating` JSON-LD from the listing page.
 * `snippets` is ALWAYS `null` (AC-7.1 — unknown platform ToS).
 *
 * @example
 * ```ts
 * const adapter = new GenericReputationAdapter();
 * const result = await adapter.fetch(listing);
 * // result.snippets === null (always — AC-7.1)
 * ```
 */
export class GenericReputationAdapter implements ReputationAdapter {
    /**
     * Fetches reputation data for a listing on an unknown platform.
     *
     * **Step 1**: Fetch the listing page via `safeExternalFetch`.
     * **Step 2**: Parse `aggregateRating` from embedded JSON-LD.
     * **Step 3**: Map to {@link ReputationFetchResult} with `snippets: null`.
     *
     * Returns {@link emptyReputationResult} when the fetch fails, the page is
     * blocked, or no `aggregateRating` block is found.
     *
     * @param listing - The external listing record (provides URL).
     * @returns Reputation data with `snippets: null`.
     */
    async fetch(listing: AccommodationExternalListing): Promise<ReputationFetchResult> {
        try {
            const fetchResult = await safeExternalFetch({
                url: listing.url,
                timeoutMs: 10_000
            });

            if (!fetchResult.ok) {
                return emptyReputationResult();
            }

            const aggregateRating = parseAggregateRatingFromPage(fetchResult.body);
            if (!aggregateRating) {
                return emptyReputationResult();
            }

            const { rating, reviewsCount } = extractAggregateValues(aggregateRating);

            if (rating === null && reviewsCount === null) {
                return emptyReputationResult();
            }

            return {
                rating,
                reviewsCount,
                deepLink: listing.url,
                // AC-7.1: NEVER surface review text from unknown platforms
                snippets: null,
                attributionUrl: null
            };
        } catch {
            return emptyReputationResult();
        }
    }
}
