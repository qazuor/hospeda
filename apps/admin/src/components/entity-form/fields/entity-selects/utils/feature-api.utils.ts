/**
 * Feature entity select utilities.
 *
 * SPEC-172 PR3 / PR4-fix: Uses the ADMIN catalog endpoint
 * (/api/v1/admin/features) instead of the public endpoint.
 *
 * Rationale: the public endpoint (/api/v1/public/features) has a server-side
 * bug where requesting pageSize=100 returns only 20 items but reports
 * totalPages that depend on the effective cap, not the requested pageSize.
 * The admin endpoint correctly returns all 80 features in a single request
 * with pageSize=100. Since the admin panel is always authenticated, the admin
 * endpoint is appropriate here.
 *
 * Client-side search is used (searchMode: 'client') because the catalog is
 * small (~80 items). Chip labels are resolved with resolveI18nText()
 * (es → en → pt fallback).
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';
import { defaultLocale, trans } from '@repo/i18n';

/** Maximum number of pages fetched as a defensive hard-cap (100 items/page = 2000 items). */
const MAX_PAGES = 20;

/** Page size used per request — matches API MAX_PAGE_SIZE to minimise round-trips. */
const PAGE_SIZE = 100;

/**
 * Admin endpoint for features — returns the full catalog (all ~80 items)
 * in a single request with pageSize=100, unlike the public endpoint which
 * has a server-side cap that prevents retrieving the full catalog.
 */
const ADMIN_FEATURES_ENDPOINT = '/api/v1/admin/features';

/**
 * Converts a slug to a human-readable Title Case label.
 * Used as fallback when the i18n key is missing.
 */
const humanizeSlug = (slug: string): string =>
    slug
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

/**
 * Translates a feature slug to its display label using @repo/i18n.
 * Key: `accommodations.featureNames.<slug>` in the default locale ('es').
 * Falls back to humanizeSlug when the key is absent.
 *
 * @param slug - The snake_case feature slug (e.g. 'sea_view', 'private_pool').
 * @returns Human-readable display label in the default locale.
 */
const translateFeatureName = (slug: string): string => {
    const key = `accommodations.featureNames.${slug}`;
    const translated = trans[defaultLocale as keyof typeof trans]?.[key];
    if (translated && !translated.startsWith('[MISSING:')) {
        return translated;
    }
    return humanizeSlug(slug);
};

/**
 * Shape of a single feature item returned by the admin list endpoint.
 * SPEC-266: `name` column dropped; slug is now the identity key for i18n.
 */
interface PublicFeatureItem {
    readonly id: string;
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
 * Map a feature item to a SelectOption.
 * SPEC-266: resolves the display label via `accommodations.featureNames.<slug>` in @repo/i18n.
 * Falls back to humanizeSlug when the translation key is absent.
 */
const toSelectOption = (item: PublicFeatureItem): SelectOption => {
    const slug = item.slug ?? item.id;
    return {
        value: item.id,
        label: translateFeatureName(slug),
        description: item.slug
    };
};

/**
 * Fetch a single page of the admin feature catalog.
 *
 * Uses the admin endpoint (/api/v1/admin/features) because the public
 * endpoint has a server-side pagination bug that prevents retrieving the
 * full catalog in a single request. The admin endpoint returns all items
 * correctly.
 */
const fetchFeaturePage = async (page: number) => {
    return fetchApi<PublicListResponse>({
        path: `${ADMIN_FEATURES_ENDPOINT}?pageSize=${PAGE_SIZE}&page=${page}`,
        method: 'GET'
    });
};

/**
 * Load the full feature catalog from the admin endpoint.
 *
 * Iterates through all pages (pageSize=100 per request) until every item
 * has been collected. A hard cap of MAX_PAGES (20 pages = 2000 items)
 * guards against infinite loops on misbehaving API responses.
 *
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
            'Error loading admin feature catalog:',
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
