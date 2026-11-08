/**
 * @file listing-catalogs.ts
 * @description Loads the amenity and feature catalogs the listing editors
 * offer, scoped to one vertical and read to the last page (HOS-2061). The
 * venue/experience editor and the accommodation editor
 * (`accommodation-editor-data.ts`) both read through `readAllCatalogPages`.
 *
 * The public catalog endpoints cap `pageSize` at 100. A single-page read
 * silently drops every row past the cap, which is how a catalog loses entries
 * without anything failing, so this loader follows `pagination.totalPages`
 * until the catalog is exhausted.
 */

import { amenitiesApi, featuresApi } from '@/lib/api/endpoints';
import { transformAmenityList } from '@/lib/api/transforms';
import type { AmenityData, ApiResult, PaginatedResponse } from '@/lib/api/types';

/** The public catalog endpoints cap `pageSize` at 100. */
export const LISTING_CATALOG_PAGE_SIZE = 100;

/** The verticals whose editors read a catalog. */
export type ListingCatalogVertical = 'accommodation' | 'venue' | 'experience';

/** One page fetcher for a catalog endpoint. */
type CatalogPageFetcher = (params: {
    readonly page: number;
    readonly pageSize: number;
    readonly applicableVertical: ListingCatalogVertical;
}) => Promise<ApiResult<PaginatedResponse<unknown>>>;

/**
 * Reads every page of one catalog.
 *
 * All or nothing: when any page fails, the result is `null`. A partial catalog
 * is worse than none, because the picker would render a listing's saved rows
 * as unselectable and the next save could drop them.
 *
 * @param params - The page fetcher and the vertical to scope it to.
 * @returns Every catalog row in API order, or `null` when any page failed.
 */
export async function readAllCatalogPages({
    fetchPage,
    vertical
}: {
    readonly fetchPage: CatalogPageFetcher;
    readonly vertical: ListingCatalogVertical;
}): Promise<{ readonly items: readonly Record<string, unknown>[] } | null> {
    const base = { pageSize: LISTING_CATALOG_PAGE_SIZE, applicableVertical: vertical } as const;
    const first = await fetchPage({ ...base, page: 1 });
    if (!first.ok) return null;

    const totalPages = Math.max(1, first.data.pagination?.totalPages ?? 1);
    const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
            fetchPage({ ...base, page: index + 2 })
        )
    );

    const items: Record<string, unknown>[] = [...(first.data.items as Record<string, unknown>[])];
    for (const result of rest) {
        if (!result.ok) return null;
        items.push(...(result.data.items as Record<string, unknown>[]));
    }
    return { items };
}

/**
 * Loads the amenity and feature catalogs for one vertical.
 *
 * SPEC-266: filtered to the listing's actual vertical, so a brewery (venue)
 * only sees venue-scoped amenities and an experience listing sees
 * experience-scoped ones.
 *
 * Degrades cleanly: a failed read yields an empty list rather than a 500,
 * which the registry then reads as "no amenities section" instead of offering
 * a link to an empty page.
 *
 * @param params - The vertical to scope the catalogs to.
 * @returns The two catalogs, each empty on any failure.
 */
export async function loadListingCatalogs({
    vertical
}: {
    readonly vertical: ListingCatalogVertical;
}): Promise<{
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
}> {
    try {
        const [amenities, features] = await Promise.all([
            readAllCatalogPages({ fetchPage: (params) => amenitiesApi.list(params), vertical }),
            readAllCatalogPages({ fetchPage: (params) => featuresApi.list(params), vertical })
        ]);
        return {
            amenities: amenities ? transformAmenityList(amenities) : [],
            features: features ? transformAmenityList(features) : []
        };
    } catch {
        // Catalog unavailable: the editor drops the amenities section entirely.
        return { amenities: [], features: [] };
    }
}
