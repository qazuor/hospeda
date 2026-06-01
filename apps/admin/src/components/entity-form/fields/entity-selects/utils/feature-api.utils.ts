/**
 * Feature entity select utilities.
 *
 * SPEC-172 PR3: Uses the PUBLIC catalog endpoint (/api/v1/public/features)
 * because features are read-only catalog data that requires no admin auth.
 * The endpoint carries a 5-min HTTP cache so repeated calls are cheap.
 *
 * Client-side search is used (searchMode: 'client') because the catalog is
 * small (~80 items) and the 5-min cache makes full-list fetches essentially
 * free. Chip labels are resolved with resolveI18nText() (es → en → pt).
 *
 * loadAllFeatures paginates through ALL pages (pageSize=100, API max) so the
 * chip list is never silently truncated if the catalog grows past 100 entries.
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';
import type { I18nText } from '@repo/schemas';

/** Maximum number of pages fetched as a defensive hard-cap (100 items/page = 2000 items). */
const MAX_PAGES = 20;

/** Page size used per request — matches API MAX_PAGE_SIZE to minimise round-trips. */
const PAGE_SIZE = 100;

/**
 * Shape of a single feature item returned by the public list endpoint.
 */
interface PublicFeatureItem {
    readonly id: string;
    readonly name: Partial<I18nText> | string | null | undefined;
    readonly slug?: string;
    readonly icon?: string | null;
}

/**
 * Pagination metadata block included in every public list response.
 */
interface PaginationMeta {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
}

/**
 * Standard response envelope returned by the public list route.
 */
interface PublicListResponse {
    readonly data: {
        readonly items: PublicFeatureItem[];
        readonly pagination: PaginationMeta;
    };
}

/**
 * Map a public feature item to a SelectOption.
 * Resolves the i18n `name` object via resolveI18nText (es → en → pt fallback).
 */
const toSelectOption = (item: PublicFeatureItem): SelectOption => {
    const label =
        typeof item.name === 'object' && item.name !== null
            ? resolveI18nText(item.name)
            : (item.name as string) || item.id;

    return {
        value: item.id,
        label,
        description: item.slug
    };
};

/**
 * Fetch a single page of the public feature catalog.
 */
const fetchFeaturePage = async (page: number) => {
    return fetchApi<PublicListResponse>({
        path: `/api/v1/public/features?pageSize=${PAGE_SIZE}&page=${page}`,
        method: 'GET'
    });
};

/**
 * Load the full feature catalog from the public endpoint.
 *
 * Iterates through all pages (pageSize=100 per request, matching the API cap)
 * until every item has been collected. This prevents silent truncation if the
 * catalog ever grows beyond 100 entries. A hard cap of MAX_PAGES (20 pages =
 * 2000 items) guards against infinite loops on misbehaving API responses.
 *
 * The 5-min HTTP cache on the endpoint makes repeated page fetches cheap.
 * The result is used for client-side filtering inside EntitySelectField
 * (searchMode: 'client').
 */
export const loadAllFeatures = async (): Promise<SelectOption[]> => {
    try {
        const allItems: PublicFeatureItem[] = [];

        const firstResponse = await fetchFeaturePage(1);
        const firstPage = firstResponse.data?.data;
        allItems.push(...(firstPage?.items ?? []));

        const totalPages = Math.min(firstPage?.pagination?.totalPages ?? 1, MAX_PAGES);

        for (let page = 2; page <= totalPages; page++) {
            const response = await fetchFeaturePage(page);
            const items = response.data?.data?.items ?? [];
            allItems.push(...items);
        }

        return allItems.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading public feature catalog:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Resolve feature SelectOptions for a list of known IDs.
 *
 * Since we have the full catalog in memory after the first load, this function
 * loads the full catalog and picks the matching items. This avoids the need
 * for a separate batch endpoint.
 */
export const loadFeaturesByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const all = await loadAllFeatures();
        return all.filter((opt) => ids.includes(opt.value));
    } catch (error) {
        adminLogger.error(
            'Error loading features by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
