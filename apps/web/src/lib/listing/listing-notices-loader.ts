/**
 * @file listing-notices-loader.ts
 * SSR loader of the listing notices for the editor hubs (HOS-1762).
 *
 * The hub shows the same notices the listing card shows (HOS-1492), so the owner
 * who was asked for a fix sees the request and its reason before editing. The
 * notices are enrichment of the hub, never a precondition of it: any failure (no
 * session, a network error, an unexpected body) degrades to "no notices" and is
 * logged, so the hub keeps rendering.
 *
 * The read is per vertical, not per listing (D-2): the endpoint returns every
 * listing of the owner in the vertical and this loader keeps the requested one.
 * There is no per-listing endpoint and none is added.
 */

import type { ListingNoticesItem } from '@repo/schemas';
import { type PublishVerticalSlug, publishApi } from '../api/endpoints-protected';
import { webLogger } from '../logger';
import { indexListingNotices } from './listing-notices';

/** Result of {@link loadListingNoticesItem}. RO-RO. */
export interface ListingNoticesItemLoadResult {
    /** The entry of the requested listing; `undefined` renders nothing. */
    readonly item: ListingNoticesItem | undefined;
}

/**
 * Loads the notices of one listing the caller owns.
 *
 * @param params.vertical - The listing's vertical (from the page resolution).
 * @param params.listingId - The listing id.
 * @param params.cookieHeader - The SSR cookie header of the request.
 * @returns `{ item }`, never throws.
 */
export async function loadListingNoticesItem({
    vertical,
    listingId,
    cookieHeader
}: {
    readonly vertical: PublishVerticalSlug;
    readonly listingId: string;
    readonly cookieHeader?: string;
}): Promise<ListingNoticesItemLoadResult> {
    if (!cookieHeader) return { item: undefined };
    try {
        const index = indexListingNotices({
            result: await publishApi.listingNotices({ vertical, cookieHeader })
        });
        if (!index.ok) {
            webLogger.warn('[listing-notices] Could not load listing notices', {
                vertical,
                listingId
            });
        }
        return { item: index.byListingId.get(listingId) };
    } catch (error) {
        webLogger.warn('[listing-notices] Listing notices request failed', {
            vertical,
            listingId,
            error: error instanceof Error ? error.message : String(error)
        });
        return { item: undefined };
    }
}
