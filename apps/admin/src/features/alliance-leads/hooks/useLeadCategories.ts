/**
 * useLeadCategories
 *
 * Resolves the category slugs a `service_provider` lead chose against the admin
 * catalog (HOS-2339), so the handle dialog can say which of them are inactive,
 * deleted or gone. The catalog is read with `includeDeleted=true` through
 * `GET /api/v1/admin/host-trade-categories`, every page (capped like
 * `host-trade-category-api.utils.ts`).
 *
 * Degrades instead of failing: an actor without `HOST_TRADE_CATEGORY_VIEW`
 * (403) gets raw slugs and no markers; any other failure gets raw slugs and a
 * muted notice. The decision controls never depend on this hook.
 */

import type { HostTradeCategoryAdmin } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import { resolveI18nText } from '@/utils/i18n-text';

/** Defensive hard-cap on pages fetched (100 items/page = 2000 items). */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const ENDPOINT = '/api/v1/admin/host-trade-categories';

/** State of a chosen category relative to the admin catalog. */
export type LeadCategoryState = 'active' | 'inactive' | 'deleted' | 'missing';

/** One chosen category, resolved. */
export type LeadCategoryItem = {
    readonly slug: string;
    /** Localized name from the catalog, or the raw slug when it cannot be resolved. */
    readonly label: string;
    readonly state: LeadCategoryState;
};

/** Result of {@link useLeadCategories}. */
export type UseLeadCategoriesResult = {
    readonly items: readonly LeadCategoryItem[];
    readonly status: 'loading' | 'ready' | 'forbidden' | 'error';
};

type CatalogPageResponse = {
    readonly data: {
        readonly items: HostTradeCategoryAdmin[];
        readonly pagination: { readonly totalPages: number };
    };
};

/** Fetches every page of the catalog, soft-deleted rows included. */
async function fetchCatalog(): Promise<HostTradeCategoryAdmin[]> {
    const fetchPage = (page: number) =>
        fetchApi<CatalogPageResponse>({
            path: `${ENDPOINT}?pageSize=${PAGE_SIZE}&page=${page}&includeDeleted=true`,
            method: 'GET'
        });

    const first = (await fetchPage(1)).data?.data;
    const rows = [...(first?.items ?? [])];
    const totalPages = Math.min(first?.pagination?.totalPages ?? 1, MAX_PAGES);
    for (let page = 2; page <= totalPages; page++) {
        rows.push(...((await fetchPage(page)).data?.data?.items ?? []));
    }
    return rows;
}

/**
 * Classifies one slug against the catalog rows.
 *
 * @param params - `{ slug, rows }`.
 * @returns The resolved item.
 */
export function resolveLeadCategory(params: {
    readonly slug: string;
    readonly rows: readonly HostTradeCategoryAdmin[];
}): LeadCategoryItem {
    const { slug, rows } = params;
    const row = rows.find((r) => r.slug === slug);
    if (!row) return { slug, label: slug, state: 'missing' };
    const label = resolveI18nText(row.nameI18n) || slug;
    if (row.deletedAt) return { slug, label, state: 'deleted' };
    if (row.lifecycleState !== 'ACTIVE') return { slug, label, state: 'inactive' };
    return { slug, label, state: 'active' };
}

/**
 * Resolves the chosen category slugs of a lead.
 *
 * @param params - `{ slugs }`: the lead's `categorySlugs`. Nothing is fetched when empty.
 * @returns Resolved items (raw slugs while loading or on failure) and a status.
 */
export function useLeadCategories(params: {
    readonly slugs: readonly string[];
}): UseLeadCategoriesResult {
    const { slugs } = params;
    const query = useQuery({
        queryKey: ['alliance-leads', 'category-catalog'],
        queryFn: fetchCatalog,
        enabled: slugs.length > 0,
        staleTime: 60_000,
        retry: false
    });

    const raw = slugs.map((slug) => ({ slug, label: slug, state: 'active' as const }));

    if (query.isError) {
        const forbidden = isApiError(query.error) && query.error.status === 403;
        return { items: raw, status: forbidden ? 'forbidden' : 'error' };
    }
    if (!query.data) return { items: raw, status: 'loading' };

    const rows = query.data;
    return { items: slugs.map((slug) => resolveLeadCategory({ slug, rows })), status: 'ready' };
}
