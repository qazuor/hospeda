/**
 * Partner type list-filter options (HOS-2336 AC-4.2).
 *
 * Feeds the partner list filter from the ADMIN catalog endpoint (the admin
 * panel never reads `/api/v1/public/*`). Every lifecycle state is included: an
 * admin must be able to find the partners whose type was deactivated. The
 * filter sends the type SLUG (`?type=media`), so the option value is the slug.
 */

import type { PartnerTypeAdminListItem } from '@repo/schemas';
import { fetchApi } from '@/lib/api/client';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';

/** Admin endpoint for the partner type catalog. */
const ADMIN_PARTNER_TYPES_ENDPOINT = '/api/v1/admin/partner-types';

/** The catalog is a handful of rows: one page at the API maximum holds it. */
const PAGE_SIZE = 100;

interface AdminListResponse {
    readonly data: { readonly items: PartnerTypeAdminListItem[] };
}

/** Fetches the catalog's single page, every lifecycle state included. */
const fetchCatalogPage = async () =>
    fetchApi<AdminListResponse>({
        path: `${ADMIN_PARTNER_TYPES_ENDPOINT}?page=1&pageSize=${PAGE_SIZE}`,
        method: 'GET'
    });

/**
 * Loads every partner type as `{ value: slug, label }`, labelled from the
 * row's own `nameI18n` (es, then en, then pt), else its slug.
 *
 * @returns Options, or an empty list when the request fails (logged).
 */
export const loadPartnerTypeFilterOptions = async (): Promise<
    ReadonlyArray<{ readonly value: string; readonly label: string }>
> => {
    try {
        const result = await fetchCatalogPage();
        return (result.data?.data?.items ?? []).map((row) => ({
            value: row.slug,
            label: resolveI18nText(row.nameI18n) || row.slug
        }));
    } catch (error) {
        adminLogger.error(
            'Error loading partner type filter options:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
