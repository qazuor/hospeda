/**
 * @file venue-collection-sitemap.ts
 * @description Resolves which venue business-line collections are non-empty, so
 * `/sitemap-dynamic.xml` only advertises collections that have at least one
 * published listing (HOS-1787 leaf 6.9, AC:6:2).
 *
 * Empty pages are never advertised — the same rule the attraction and partner
 * landings follow. The count comes from the public venue list scoped by the
 * internal catalog value, which is exactly the set the collection page renders.
 *
 * Everything is fail-closed: a non-2xx response, a malformed body, a missing
 * `pagination.total`, a timeout or a rejected fetch excludes the collection
 * until the next render. A transient failure must never advertise an empty page.
 */

import {
    buildVenueBusinessLineCollectionSitemapPath,
    listVenueBusinessLineCollections
} from '@/lib/venue/business-line-collection';

/** Minimal response shape read from `GET /api/v1/public/venues`. */
interface VenueCollectionCountResponse {
    readonly success?: boolean;
    readonly data?: {
        readonly pagination?: {
            readonly total?: number;
        };
    };
}

/** Per-request timeout, matching `fetchAllEntities` in the sitemap handler. */
const COLLECTION_TIMEOUT_MS = 15_000;

/**
 * Returns the paths (without locale) of the venue collections that currently
 * have at least one published listing.
 *
 * @param input - The API origin.
 * @param input.apiUrl - API base URL without a trailing slash.
 * @returns The locale-agnostic collection paths, in catalog order.
 */
export async function fetchPopulatedVenueCollectionPaths({
    apiUrl
}: {
    readonly apiUrl: string;
}): Promise<readonly string[]> {
    const collections = listVenueBusinessLineCollections();

    const paths = await Promise.all(
        collections.map(async ({ businessLine }): Promise<string | null> => {
            const searchParams = new URLSearchParams({
                page: '1',
                pageSize: '1',
                businessLine
            });

            try {
                const response = await fetch(
                    `${apiUrl}/api/v1/public/venues?${searchParams.toString()}`,
                    { signal: AbortSignal.timeout(COLLECTION_TIMEOUT_MS) }
                );
                if (!response.ok) return null;

                const json = (await response.json()) as VenueCollectionCountResponse;
                const total = json.data?.pagination?.total;
                if (json.success !== true || typeof total !== 'number' || total <= 0) {
                    return null;
                }

                return buildVenueBusinessLineCollectionSitemapPath({ businessLine });
            } catch {
                // Network error, timeout or invalid JSON: fail closed.
                return null;
            }
        })
    );

    return paths.filter((path): path is string => path !== null);
}
