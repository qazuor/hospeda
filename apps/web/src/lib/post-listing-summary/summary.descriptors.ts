/**
 * Filter descriptors for the post listing summary builder.
 *
 * Mirrors `event-listing-summary/summary.descriptors` in style: each
 * descriptor is a self-contained unit with `isActive` and `build`. The array
 * order controls the modifier order in the final sentence.
 *
 * Generic formatting helpers (`cleanText`) are reused from the accommodation
 * module to avoid duplication — they are domain-agnostic.
 */

import { cleanText } from '../accommodation-listing-summary/summary.helpers';
import { getPhrase, lookupCatalogLabel } from './summary.catalogs';
import type { FilterDescriptor } from './summary.types';

/**
 * Format an ISO `yyyy-mm-dd` string as a locale-friendly short date.
 * Example (es): "20 may 2026". Example (en): "May 20, 2026".
 */
function formatIsoDay(iso: string, locale: 'es' | 'en'): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d, 12);
    if (Number.isNaN(date.getTime())) return iso;
    const fmt = new Intl.DateTimeFormat(locale === 'es' ? 'es-AR' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    return fmt.format(date);
}

/**
 * Free-text filter. Renders: `que contienen "carnaval" en el título o el contenido`.
 * Flow modifier — attaches with a space (or comma when destination is active).
 */
const textDescriptor: FilterDescriptor = {
    key: 'text',
    isActive: ({ filters }) => {
        if (!filters.text) return false;
        return cleanText({ text: filters.text }).length > 0;
    },
    build: ({ context }) => {
        const { filters, locale } = context;
        const cleaned = cleanText({ text: filters.text ?? '' });
        // "que contiene" is the canonical singular form. "1 publicación que
        // contiene" reads correctly with plural totals too — Spanish allows
        // the singular relative clause when modifying a numeric count agnostic
        // to plurality.
        const containing =
            locale === 'es' ? 'que contiene' : getPhrase({ locale, key: 'containing' });
        const inTitleOrContent = getPhrase({ locale, key: 'inTitleOrContent' });
        return `${containing} "${cleaned}" ${inTitleOrContent}`;
    }
};

/**
 * Destination filter. Renders: `sobre Concordia`.
 * Flow modifier — attaches directly to the subject with a space.
 */
const destinationDescriptor: FilterDescriptor = {
    key: 'destination',
    isActive: ({ filters }) => Boolean(filters.destinationId),
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const label = lookupCatalogLabel({
            key: filters.destinationId ?? '',
            entries: catalogs.destinations,
            locale
        });
        return `${getPhrase({ locale, key: 'in' })} ${label}`;
    }
};

/** Category filter. Renders: `de cultura`. */
const categoryDescriptor: FilterDescriptor = {
    key: 'category',
    isActive: ({ filters }) => Boolean(filters.category),
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const label = lookupCatalogLabel({
            key: filters.category ?? '',
            entries: catalogs.categories,
            locale
        });
        return `${getPhrase({ locale, key: 'ofCategory' })} ${label}`;
    }
};

/**
 * Explicit date range. Renders one of:
 * - `publicadas desde el 20 may 2026`
 * - `publicadas hasta el 31 ago 2026`
 * - `publicadas entre el 20 may 2026 y el 31 ago 2026`
 */
const dateRangeDescriptor: FilterDescriptor = {
    key: 'dateRange',
    isActive: ({ filters }) => Boolean(filters.publishedAfter || filters.publishedBefore),
    build: ({ context }) => {
        const { filters, locale } = context;
        const from = filters.publishedAfter ? formatIsoDay(filters.publishedAfter, locale) : '';
        const to = filters.publishedBefore ? formatIsoDay(filters.publishedBefore, locale) : '';
        if (from && to) {
            return `${getPhrase({ locale, key: 'dateBetween' })} ${from} ${getPhrase({ locale, key: 'and' })} el ${to}`;
        }
        if (from) {
            return `${getPhrase({ locale, key: 'dateFrom' })} ${from}`;
        }
        return `${getPhrase({ locale, key: 'dateTo' })} ${to}`;
    }
};

/** Featured-only filter. Renders: `solo destacadas`. */
const featuredDescriptor: FilterDescriptor = {
    key: 'featured',
    isActive: ({ filters }) => filters.isFeatured === true,
    build: ({ context }) => getPhrase({ locale: context.locale, key: 'onlyFeatured' })
};

/**
 * Ordered descriptor list. Matches the desired modifier order in the
 * sentence:
 *   "X publicaciones de cultura sobre Concordia, que contienen \"feria\",
 *    publicadas desde el 1 ene 2026, solo destacadas, ordenadas por ..."
 *
 * Category appears FIRST so it flows into the subject as "publicaciones de
 * cultura" rather than ", de cultura" (which reads as a parenthetical aside).
 * Destination follows ("publicaciones de cultura sobre Concordia"), then the
 * remaining modifiers comma-join as usual.
 */
export const FILTER_DESCRIPTORS: readonly FilterDescriptor[] = [
    categoryDescriptor,
    destinationDescriptor,
    textDescriptor,
    dateRangeDescriptor,
    featuredDescriptor
];

/** Descriptors that flow into the subject (no comma when first). */
export const FLOW_MODIFIER_KEYS: ReadonlySet<string> = new Set(['category', 'destination', 'text']);
