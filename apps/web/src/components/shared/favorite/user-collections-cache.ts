/**
 * @file user-collections-cache.ts
 * @description Module-level singleton cache for the authenticated user's
 * bookmark collections. Used by FavoriteButton instances to avoid firing
 * one API request per heart on a busy listing page.
 *
 * The cache is per page-load (no TTL): when the user navigates to a new page
 * the module is re-evaluated and the cache resets. That is acceptable because
 * collections rarely change mid-browsing.
 *
 * Concurrent first-callers share a single in-flight promise (dedupe) so we
 * never trigger a thundering herd of identical requests when many cards
 * hydrate at the same time.
 */

import {
    type BookmarkCollectionItem,
    userBookmarkCollectionsApi
} from '@/lib/api/endpoints-protected';

/** Cached list of collections, populated on the first successful fetch. */
let cached: readonly BookmarkCollectionItem[] | null = null;

/** In-flight promise so concurrent callers share one request. */
let inFlight: Promise<readonly BookmarkCollectionItem[]> | null = null;

/**
 * Return the user's collections, fetching them once per page-load and reusing
 * the cached result on subsequent calls. Returns an empty array on any error
 * so callers can treat "no collections" the same as "no data available".
 */
export async function getUserCollections(): Promise<readonly BookmarkCollectionItem[]> {
    if (cached !== null) return cached;
    if (inFlight !== null) return inFlight;

    inFlight = (async () => {
        try {
            const result = await userBookmarkCollectionsApi.list({
                page: 1,
                pageSize: 100,
                includeBookmarkCount: true
            });
            if (result.ok && Array.isArray(result.data.items)) {
                cached = result.data.items;
                return cached;
            }
        } catch {
            // Treat as no collections — UI degrades gracefully.
        }
        cached = [];
        return cached;
    })();

    const value = await inFlight;
    inFlight = null;
    return value;
}

/**
 * Invalidate the cached collections list. Callers should invoke this after
 * creating, renaming, or deleting a collection so the next read reflects the
 * change.
 */
export function invalidateUserCollections(): void {
    cached = null;
    inFlight = null;
}
