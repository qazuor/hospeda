/**
 * POI category entity select utilities (HOS-144 T-016).
 *
 * Mirrors `amenity-api.utils.ts`'s admin-catalog-with-pagination pattern for
 * the `poi_categories` catalog consumed by `PoiCategorySelectField`.
 *
 * Uses the ADMIN catalog endpoint (`/api/v1/admin/poi-categories`, HOS-144
 * NG-1 follow-up shipped ahead of schedule) rather than a public endpoint —
 * POI categories have no public list route, and the admin panel is always
 * authenticated. Client-side search (`searchMode: 'client'`) is used because
 * the catalog is expected to be small (a curated handful of categories).
 *
 * Unlike amenities/features (i18n-by-slug against a closed enum), POI
 * categories carry their own `nameI18n` content directly (mirrors
 * `destinations.nameI18n`) — labels are resolved via `resolveI18nText()`,
 * never an i18n lookup by slug.
 */

import type { PoiCategoryAdmin } from '@repo/schemas';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';

/** Maximum number of pages fetched as a defensive hard-cap (100 items/page = 2000 items). */
const MAX_PAGES = 20;

/** Admin endpoint for the POI category catalog. */
const ADMIN_POI_CATEGORIES_ENDPOINT = '/api/v1/admin/poi-categories';

/** Page size used per request — matches the API's max `pageSize`. */
const PAGE_SIZE = 100;

/** Pagination metadata block included in the admin list response. */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/** Standard response envelope returned by the admin list route. */
interface AdminListResponse {
    readonly data: {
        readonly items: PoiCategoryAdmin[];
        readonly pagination: PaginationMeta;
    };
}

/**
 * Map a POI category to a SelectOption.
 *
 * Label resolves the category's own `nameI18n` (es → en → pt via
 * `resolveI18nText`), falling back to `slug` only if every locale is empty —
 * POI categories are data-driven content, never a slug-keyed i18n lookup.
 */
const toSelectOption = (item: PoiCategoryAdmin): SelectOption => ({
    value: item.id,
    label: resolveI18nText(item.nameI18n) || item.slug,
    description: item.slug
});

/** Fetch a single page of the admin POI category catalog. */
const fetchPoiCategoryPage = async (page: number) => {
    return fetchApi<AdminListResponse>({
        path: `${ADMIN_POI_CATEGORIES_ENDPOINT}?pageSize=${PAGE_SIZE}&page=${page}`,
        method: 'GET'
    });
};

/**
 * Load the full POI category catalog from the admin endpoint.
 *
 * Iterates through all pages (pageSize=100 per request) until every item
 * has been collected. A hard cap of MAX_PAGES (20 pages = 2000 items) guards
 * against infinite loops on misbehaving API responses.
 *
 * The result is used for client-side filtering inside `EntitySelectField`
 * (`searchMode: 'client'`).
 */
export const loadAllPoiCategories = async (): Promise<SelectOption[]> => {
    try {
        const allItems: PoiCategoryAdmin[] = [];

        const firstResponse = await fetchPoiCategoryPage(1);
        const firstPage = firstResponse.data?.data;
        allItems.push(...(firstPage?.items ?? []));

        const totalPages = Math.min(firstPage?.pagination?.totalPages ?? 1, MAX_PAGES);

        for (let page = 2; page <= totalPages; page++) {
            const response = await fetchPoiCategoryPage(page);
            const items = response.data?.data?.items ?? [];
            allItems.push(...items);
        }

        return allItems.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading admin POI category catalog:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Resolve POI category SelectOptions for a list of known IDs.
 *
 * Loads the full catalog (small enough to fetch in one call) and picks the
 * matching items — avoids needing a separate batch endpoint.
 */
export const loadPoiCategoriesByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const all = await loadAllPoiCategories();
        return all.filter((opt) => ids.includes(opt.value));
    } catch (error) {
        adminLogger.error(
            'Error loading POI categories by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
