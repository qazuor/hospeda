/**
 * @file search-history-url.ts
 * @description Pure helpers of the search-history page (HOS-2501, split out of
 * `SearchHistoryList.client.tsx` to keep it under 500 lines): rebuilding the
 * search URL of a stored entry and counting its active filters.
 */

import type { SearchHistoryFilters } from '@repo/schemas';
import { canonicalizeFacetValues } from '@/lib/filters/canonical-facet-order';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrlWithParams } from '@/lib/urls';

/**
 * Build the "re-run" URL from a stored search entry.
 *
 * Maps stored `SearchHistoryFilters` fields to the URL params accepted by
 * `/[lang]/alojamientos/`. Date fields are formatted as ISO date strings
 * (YYYY-MM-DD). For `minGuests`, we approximate with the `adults` param since
 * the original adults/children split is not stored.
 *
 * @param params - Entry data and locale for URL building
 * @returns A full URL path with query string
 */
export function buildRerunUrl({
    locale,
    queryText,
    filtersJson
}: {
    readonly locale: SupportedLocale;
    readonly queryText: string | null;
    readonly filtersJson: SearchHistoryFilters | null;
}): string {
    const params: Record<string, string> = {};

    if (queryText) {
        params.q = queryText;
    }

    if (filtersJson) {
        if (filtersJson.destinationId) {
            params.destinationIds = filtersJson.destinationId;
        }
        if (filtersJson.minPrice != null) {
            params.minPrice = String(filtersJson.minPrice);
        }
        if (filtersJson.maxPrice != null) {
            params.maxPrice = String(filtersJson.maxPrice);
        }
        if (filtersJson.minGuests != null) {
            params.adults = String(filtersJson.minGuests);
        }
        if (filtersJson.minBedrooms != null) {
            params.minBedrooms = String(filtersJson.minBedrooms);
        }
        if (filtersJson.minBathrooms != null) {
            params.minBathrooms = String(filtersJson.minBathrooms);
        }
        if (filtersJson.minRating != null) {
            params.minRating = String(filtersJson.minRating);
        }
        if (filtersJson.hasPool) {
            params.hasPool = 'true';
        }
        if (filtersJson.hasWifi) {
            params.hasWifi = 'true';
        }
        if (filtersJson.hasParking) {
            params.hasParking = 'true';
        }
        if (filtersJson.allowsPets) {
            params.allowsPets = 'true';
        }
        if (filtersJson.isFeatured) {
            params.isFeatured = 'true';
        }
        // `type` (single) takes precedence; fall through to `types` (array) otherwise.
        if (filtersJson.type) {
            params.types = filtersJson.type;
        } else if (filtersJson.types?.length) {
            // HOS-524: canonical order, like every other writer of these CSV
            // params. A saved search replayed from history has to land on the
            // SAME listing URL the chips and the sidebar produce for that
            // selection — otherwise one filter keeps two edge-cache entries and
            // two rows in the analytics.
            params.types = canonicalizeFacetValues({ values: filtersJson.types }).join(',');
        }
        if (filtersJson.amenities?.length) {
            params.amenities = canonicalizeFacetValues({
                values: filtersJson.amenities
            }).join(',');
        }
        if (filtersJson.features?.length) {
            params.features = canonicalizeFacetValues({
                values: filtersJson.features
            }).join(',');
        }
        if (filtersJson.checkIn) {
            const d =
                filtersJson.checkIn instanceof Date
                    ? filtersJson.checkIn
                    : new Date(filtersJson.checkIn as unknown as string); // TYPE-WORKAROUND: JSON-parsed date fields are typed as `unknown` in the JSONB filter blob; after the `instanceof Date` guard fails we know the value is a date string.
            params.checkIn = d.toISOString().split('T')[0] ?? '';
        }
        if (filtersJson.checkOut) {
            const d =
                filtersJson.checkOut instanceof Date
                    ? filtersJson.checkOut
                    : new Date(filtersJson.checkOut as unknown as string); // TYPE-WORKAROUND: JSON-parsed date fields are typed as `unknown` in the JSONB filter blob; after the `instanceof Date` guard fails we know the value is a date string.
            params.checkOut = d.toISOString().split('T')[0] ?? '';
        }
    }

    return buildUrlWithParams({ locale, path: 'alojamientos', params });
}

/**
 * Count the number of active filters in a `SearchHistoryFilters` object.
 *
 * Used to render a concise "N filters" badge on each entry.
 *
 * @param filtersJson - Stored filter object, or null
 * @returns Number of distinct active filters
 */
export function countActiveFilters(filtersJson: SearchHistoryFilters | null): number {
    if (!filtersJson) return 0;
    let count = 0;
    if (filtersJson.destinationId) count++;
    if (filtersJson.minPrice != null || filtersJson.maxPrice != null) count++;
    if (filtersJson.minGuests != null || filtersJson.maxGuests != null) count++;
    if (filtersJson.minBedrooms != null) count++;
    if (filtersJson.minBathrooms != null) count++;
    if (filtersJson.minRating != null) count++;
    if (filtersJson.hasPool) count++;
    if (filtersJson.hasWifi) count++;
    if (filtersJson.hasParking) count++;
    if (filtersJson.allowsPets) count++;
    if (filtersJson.isFeatured) count++;
    if (filtersJson.type || filtersJson.types?.length) count++;
    if (filtersJson.amenities?.length) count++;
    if (filtersJson.features?.length) count++;
    if (filtersJson.checkIn || filtersJson.checkOut) count++;
    return count;
}
