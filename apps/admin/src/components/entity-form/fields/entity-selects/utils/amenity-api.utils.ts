/**
 * Amenity entity select utilities.
 *
 * SPEC-172 PR3 / PR4-fix: Uses the ADMIN catalog endpoint
 * (/api/v1/admin/amenities) instead of the public endpoint.
 *
 * Rationale: the public endpoint (/api/v1/public/amenities) has a server-side
 * bug where requesting pageSize=100 returns only 10 items but reports
 * totalPages=1, making it impossible to retrieve all 90 amenities via
 * pagination. The admin endpoint correctly returns all 90 in a single
 * request with pageSize=100. Since the admin panel is always authenticated,
 * the admin endpoint is appropriate here.
 *
 * Client-side search is used (searchMode: 'client') because the catalog is
 * small (~90 items). Chip labels are resolved by translating the snake_case
 * slug via @repo/i18n `accommodations.amenityNames.<slug>`, with a humanize
 * fallback (replace `_` with space + Title Case) when the key is missing.
 */

import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { fetchApi } from '@/lib/api/client';
import { resolveI18nText } from '@/utils/i18n-text';
import { adminLogger } from '@/utils/logger';
import { defaultLocale, trans } from '@repo/i18n';
import type { I18nText } from '@repo/schemas';

/** Maximum number of pages fetched as a defensive hard-cap (100 items/page = 2000 items). */
const MAX_PAGES = 20;

/**
 * Admin endpoint for amenities — returns the full catalog (all ~90 items)
 * in a single request with pageSize=100, unlike the public endpoint which
 * has a server-side cap of 10 items per page regardless of pageSize.
 */
const ADMIN_AMENITIES_ENDPOINT = '/api/v1/admin/amenities';

/**
 * Converts a snake_case string to a human-readable Title Case label.
 * Used as fallback when an i18n translation key is missing.
 *
 * @example humanizeSlug('air_conditioning') → 'Air Conditioning'
 */
const humanizeSlug = (slug: string): string =>
    slug
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

/**
 * Translates an amenity slug to its display label using @repo/i18n.
 *
 * Lookup key: `accommodations.amenityNames.<slug>` in the default locale ('es').
 * Falls back to humanizeSlug when the key is absent (avoids showing raw
 * `[MISSING: ...]` strings in the UI).
 *
 * @param slug - The snake_case amenity name (e.g. 'air_conditioning', 'wifi').
 * @returns Human-readable display label in the default locale.
 */
const translateAmenityName = (slug: string): string => {
    const key = `accommodations.amenityNames.${slug}`;
    const translated = trans[defaultLocale as keyof typeof trans]?.[key];
    if (translated && !translated.startsWith('[MISSING:')) {
        return translated;
    }
    return humanizeSlug(slug);
};

/** Page size used per request — matches API MAX_PAGE_SIZE to minimise round-trips. */
const PAGE_SIZE = 100;

/**
 * Shape of a single amenity item returned by the public list endpoint.
 */
interface PublicAmenityItem {
    readonly id: string;
    readonly name: Partial<I18nText> | string | null | undefined;
    readonly slug?: string;
    readonly icon?: string | null;
    readonly type?: string;
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
        readonly items: PublicAmenityItem[];
        readonly pagination: PaginationMeta;
    };
}

/**
 * Map a public amenity item to a SelectOption.
 *
 * The display label is resolved by translating the snake_case slug via
 * `accommodations.amenityNames.<slug>` in @repo/i18n (default locale: 'es').
 * This matches the behaviour of AmenitiesGrid.astro on the web app. A humanize
 * fallback (Title Case) is used when the translation key is absent so the UI
 * never shows a raw slug or a `[MISSING: ...]` string.
 *
 * The `value` stays as the amenity UUID so form submission is unaffected.
 *
 * Resolution order for the slug:
 * 1. `item.slug` — explicit catalog slug (preferred: guaranteed snake_case).
 * 2. `item.name.es` — the es locale from the I18nText name object.
 * 3. `item.id` — last-resort fallback (humanize will just return the raw id).
 */
const toSelectOption = (item: PublicAmenityItem): SelectOption => {
    // Derive the snake_case slug used as the i18n key suffix.
    const nameEs =
        typeof item.name === 'object' && item.name !== null
            ? resolveI18nText(item.name)
            : ((item.name as string | undefined) ?? '');
    // The i18n keys are keyed by the snake_case NAME (e.g. 'air_conditioning'),
    // matching the web's AmenitiesGrid. The catalog `slug` strips underscores
    // ('airconditioning') so it would miss the key — prefer name.es.
    const slug = nameEs || item.slug || item.id;

    return {
        value: item.id,
        label: translateAmenityName(slug),
        description: item.slug
    };
};

/**
 * Fetch a single page of the admin amenity catalog.
 *
 * Uses the admin endpoint (/api/v1/admin/amenities) because the public
 * endpoint has a server-side pagination bug: requesting pageSize=100
 * returns only 10 items but reports totalPages=1, silently truncating
 * the catalog. The admin endpoint returns all items correctly.
 */
const fetchAmenityPage = async (page: number) => {
    return fetchApi<PublicListResponse>({
        path: `${ADMIN_AMENITIES_ENDPOINT}?pageSize=${PAGE_SIZE}&page=${page}`,
        method: 'GET'
    });
};

/**
 * Load the full amenity catalog from the admin endpoint.
 *
 * Iterates through all pages (pageSize=100 per request) until every item
 * has been collected. A hard cap of MAX_PAGES (20 pages = 2000 items)
 * guards against infinite loops on misbehaving API responses.
 *
 * The result is used for client-side filtering inside EntitySelectField
 * (searchMode: 'client').
 */
export const loadAllAmenities = async (): Promise<SelectOption[]> => {
    try {
        const allItems: PublicAmenityItem[] = [];

        const firstResponse = await fetchAmenityPage(1);
        const firstPage = firstResponse.data?.data;
        allItems.push(...(firstPage?.items ?? []));

        const totalPages = Math.min(firstPage?.pagination?.totalPages ?? 1, MAX_PAGES);

        for (let page = 2; page <= totalPages; page++) {
            const response = await fetchAmenityPage(page);
            const items = response.data?.data?.items ?? [];
            allItems.push(...items);
        }

        return allItems.map(toSelectOption);
    } catch (error) {
        adminLogger.error(
            'Error loading admin amenity catalog:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};

/**
 * Resolve amenity SelectOptions for a list of known IDs.
 *
 * Since we have the full catalog in memory after the first load, this function
 * loads the full catalog and picks the matching items. This avoids the need
 * for a separate batch endpoint.
 */
export const loadAmenitiesByIds = async (ids: string[]): Promise<SelectOption[]> => {
    if (ids.length === 0) return [];

    try {
        const all = await loadAllAmenities();
        return all.filter((opt) => ids.includes(opt.value));
    } catch (error) {
        adminLogger.error(
            'Error loading amenities by IDs:',
            error instanceof Error ? error.message : String(error)
        );
        return [];
    }
};
