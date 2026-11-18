/**
 * Provider trade category entity select utilities (HOS-919 T-045).
 *
 * Feeds the category multi-select on the host-trade (provider) form from the
 * ADMIN catalog endpoint. The admin panel never reads the public catalog
 * (`/api/v1/public/*`), so the options come from
 * `/api/v1/admin/host-trade-categories`.
 *
 * Two loaders with deliberately different scopes:
 *  - {@link loadAllHostTradeCategories} offers ACTIVE categories only, so a
 *    deactivated category is no longer pickable for new links.
 *  - {@link loadHostTradeCategoriesByIds} resolves ids across ALL lifecycle
 *    states, so a category the provider already has stays visible and
 *    selectable after it was deactivated (spec: inactive categories remain on
 *    providers that have them).
 *
 * Labels come from each row's own `nameI18n` (es → en → pt), never from the
 * slug.
 */

import type { HostTradeCategoryAdmin } from '@repo/schemas';
import {
    SELECT_OPTION_SEARCH_TERMS_KEY,
    type SelectOption
} from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';

/** Defensive hard-cap on pages fetched (100 items/page = 2000 items). */
const MAX_PAGES = 20;

/** Admin endpoint for the category catalog. */
const ADMIN_HOST_TRADE_CATEGORIES_ENDPOINT = '/api/v1/admin/host-trade-categories';

/** Page size per request, the API's maximum. */
const PAGE_SIZE = 100;

interface PaginationMeta {
    readonly totalPages: number;
}

interface AdminListResponse {
    readonly data: {
        readonly items: HostTradeCategoryAdmin[];
        readonly pagination: PaginationMeta;
    };
}

/** Maps a category to a select option labelled from its own `nameI18n`. */
const toSelectOption = (item: HostTradeCategoryAdmin): SelectOption => ({
    value: item.id,
    label: resolveI18nText(item.nameI18n) || item.slug,
    description: item.slug,
    // Lets the select search the name and the related words in every locale (HOS-2340).
    metadata: {
        [SELECT_OPTION_SEARCH_TERMS_KEY]: {
            nameI18n: item.nameI18n,
            keywordsI18n: item.keywordsI18n
        }
    }
});

/** Fetches one page of the admin catalog, optionally scoped to ACTIVE rows. */
const fetchPage = async ({ page, activeOnly }: { page: number; activeOnly: boolean }) =>
    fetchApi<AdminListResponse>({
        path: `${ADMIN_HOST_TRADE_CATEGORIES_ENDPOINT}?pageSize=${PAGE_SIZE}&page=${page}${
            activeOnly ? '&lifecycleState=ACTIVE' : ''
        }`,
        method: 'GET'
    });

/** Walks every page of the catalog and returns the raw rows. */
const fetchAllRows = async ({
    activeOnly
}: {
    activeOnly: boolean;
}): Promise<HostTradeCategoryAdmin[]> => {
    const rows: HostTradeCategoryAdmin[] = [];
    const first = (await fetchPage({ page: 1, activeOnly })).data?.data;
    rows.push(...(first?.items ?? []));

    const totalPages = Math.min(first?.pagination?.totalPages ?? 1, MAX_PAGES);
    for (let page = 2; page <= totalPages; page++) {
        const next = (await fetchPage({ page, activeOnly })).data?.data;
        rows.push(...(next?.items ?? []));
    }
    return rows;
};

/**
 * Loads the ACTIVE categories as select options, for client-side search inside
 * `EntitySelectField`.
 *
 * @returns Options, or an empty list when the request fails (logged).
 */
export const loadAllHostTradeCategories = async (): Promise<SelectOption[]> => {
    try {
        return (await fetchAllRows({ activeOnly: true })).map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading admin host trade category catalog:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Loads every category as `{ value: slug, label }` for the host-trades list
 * filter, which sends comma-separated SLUGS (`categories=plomeria,gas`).
 *
 * All lifecycle states are included on purpose: an admin must be able to find
 * the providers that still carry a deactivated category.
 *
 * @returns Options labelled from `nameI18n`, or an empty list on failure.
 */
export const loadHostTradeCategoryFilterOptions = async (): Promise<
    ReadonlyArray<{ readonly value: string; readonly label: string }>
> => {
    try {
        return (await fetchAllRows({ activeOnly: false })).map((row) => ({
            value: row.slug,
            label: resolveI18nText(row.nameI18n) || row.slug
        }));
    } catch (error) {
        adminLogger.error(
            'Error loading host trade category filter options:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Resolves options for known ids across every lifecycle state, so categories a
 * provider already has keep a label even when inactive.
 *
 * @param ids - Category ids to resolve.
 * @returns The matching options, or an empty list when the request fails.
 */
export const loadHostTradeCategoriesByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const rows = await fetchAllRows({ activeOnly: false });
        return rows.filter((row) => ids.includes(row.id)).map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading host trade categories by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
