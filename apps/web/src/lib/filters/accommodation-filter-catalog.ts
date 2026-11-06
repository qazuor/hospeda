/**
 * @file accommodation-filter-catalog.ts
 * @description Loads the amenity and feature catalogs that feed the accommodation
 * listing filters (HOS-2057).
 *
 * Three rules, each fixing a measured bug:
 * - scoped to the `accommodation` vertical, so venue/experience-only items never
 *   show up as accommodation filters;
 * - paged to completion: the server clamps `pageSize` to 100, so a single call
 *   silently drops everything past the first 100 rows;
 * - never sorted by `name`, a column SPEC-266 dropped. Both lists sort by
 *   `displayWeight` desc.
 */

import type { AmenityPublic, FeaturePublic } from '@repo/schemas';
import { amenitiesApi, featuresApi, SSR_PUBLIC_CACHE_TTL_MS } from '@/lib/api/endpoints';
import type { ApiResult, PaginatedResponse } from '@/lib/api/types';

/** Server-side page size cap (`MAX_PAGE_SIZE` in apps/api). */
const CATALOG_PAGE_SIZE = 100;

/** Safety cap against a misbehaving API reporting endless pages. */
const MAX_CATALOG_PAGES = 20;

/** Result of {@link fetchAccommodationFilterCatalog}. */
export interface AccommodationFilterCatalog {
    readonly amenities: readonly AmenityPublic[];
    readonly features: readonly FeaturePublic[];
}

type PageFetcher<T> = (params: {
    readonly page: number;
}) => Promise<ApiResult<PaginatedResponse<T>>>;

/**
 * Pages through a list endpoint until every row is collected.
 * A failed page degrades to what was collected so far (empty on first-page failure).
 */
const collectAllPages = async <T>({
    fetchPage
}: {
    readonly fetchPage: PageFetcher<T>;
}): Promise<readonly T[]> => {
    const first = await fetchPage({ page: 1 });
    if (!first.ok) return [];
    const items: T[] = [...first.data.items];
    const totalPages = Math.min(first.data.pagination.totalPages, MAX_CATALOG_PAGES);
    for (let page = 2; page <= totalPages; page++) {
        const next = await fetchPage({ page });
        if (!next.ok) break;
        items.push(...next.data.items);
    }
    return items;
};

/**
 * Fetches the complete, active, accommodation-applicable amenity and feature catalogs.
 *
 * @returns Both catalogs, each sorted by `displayWeight` desc; empty on failure.
 */
export const fetchAccommodationFilterCatalog = async (): Promise<AccommodationFilterCatalog> => {
    const base = {
        pageSize: CATALOG_PAGE_SIZE,
        applicableVertical: 'accommodation' as const,
        sortBy: 'displayWeight',
        sortOrder: 'desc' as const,
        cacheTtlMs: SSR_PUBLIC_CACHE_TTL_MS
    };
    const [amenities, features] = await Promise.all([
        collectAllPages({
            fetchPage: ({ page }) => amenitiesApi.list({ ...base, isActive: true, page })
        }),
        collectAllPages({ fetchPage: ({ page }) => featuresApi.list({ ...base, page }) })
    ]);
    return { amenities, features };
};
