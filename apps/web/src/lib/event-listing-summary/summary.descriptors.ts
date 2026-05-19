/**
 * Filter descriptors for the event listing summary builder.
 *
 * Mirrors `accommodation-listing-summary/summary.descriptors` in style:
 * each descriptor is a self-contained unit with `isActive` and `build`. The
 * array order controls the modifier order in the final sentence.
 *
 * Generic formatting helpers (`formatNaturalList`, `cleanText`, `formatPrice`)
 * are reused from the accommodation module to avoid duplication — they are
 * domain-agnostic.
 */

import {
    cleanText,
    formatNaturalList,
    formatPrice
} from '../accommodation-listing-summary/summary.helpers';
import { getPhrase, lookupCatalogLabel } from './summary.catalogs';
import type { FilterDescriptor } from './summary.types';

/**
 * Format an ISO `yyyy-mm-dd` string as a locale-friendly short date.
 * Example (es): "20/05/2026". Example (en): "May 20, 2026".
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
 * Free-text filter. Renders: `que contienen "carnaval" en el nombre o la descripción`.
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
        // "que contiene" is the canonical singular form. "1 evento que contiene"
        // also reads correctly with plural totals — Spanish allows the singular
        // relative clause when modifying a numeric count agnostic to plurality.
        const containing =
            locale === 'es' ? 'que contiene' : getPhrase({ locale, key: 'containing' });
        const inNameOrDesc = getPhrase({ locale, key: 'inNameOrDescription' });
        return `${containing} "${cleaned}" ${inNameOrDesc}`;
    }
};

/**
 * Destination filter. Renders: `en Concordia`.
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

/** Category filter. Renders: `de música` or `de música, teatro y cultura`. */
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
 * Temporal `when` chip. Renders one of the pre-baked phrases ("durante esta
 * semana", "ya finalizados", etc). Used when no explicit date range is set.
 */
const whenChipDescriptor: FilterDescriptor = {
    key: 'whenChip',
    isActive: ({ filters }) => {
        if (filters.startDateAfter || filters.startDateBefore) return false;
        const w = filters.when;
        return w === 'today' || w === 'week' || w === 'month' || w === 'next60' || w === 'past';
    },
    build: ({ context }) => {
        const w = context.filters.when;
        return getPhrase({ locale: context.locale, key: `when_${w}` });
    }
};

/**
 * Explicit date range. Renders one of:
 * - `desde el 20/05/2026`
 * - `hasta el 31/08/2026`
 * - `entre el 20/05/2026 y el 31/08/2026`
 */
const dateRangeDescriptor: FilterDescriptor = {
    key: 'dateRange',
    isActive: ({ filters }) => Boolean(filters.startDateAfter || filters.startDateBefore),
    build: ({ context }) => {
        const { filters, locale } = context;
        const from = filters.startDateAfter ? formatIsoDay(filters.startDateAfter, locale) : '';
        const to = filters.startDateBefore ? formatIsoDay(filters.startDateBefore, locale) : '';
        if (from && to) {
            return `${getPhrase({ locale, key: 'dateBetween' })} ${from} ${getPhrase({ locale, key: 'and' })} el ${to}`;
        }
        if (from) {
            return `${getPhrase({ locale, key: 'dateFrom' })} ${from}`;
        }
        return `${getPhrase({ locale, key: 'dateTo' })} ${to}`;
    }
};

/**
 * Price block. Combines `isFree`, `minPrice`, `maxPrice`, and `includeUnpriced`
 * into a single descriptive fragment so the price story reads as one clause.
 *
 * Examples:
 * - "gratuitos"
 * - "con precio de hasta $5.000"
 * - "con precio entre $1.000 y $5.000"
 * - "con precio desde $1.000, sin contar eventos sin precio definido"
 */
const priceDescriptor: FilterDescriptor = {
    key: 'price',
    isActive: ({ filters }) => {
        if (filters.isFree === true) return true;
        if (filters.price?.min || filters.price?.max) return true;
        // Only mention `includeUnpriced` when the user explicitly opted OUT.
        if (filters.includeUnpriced === false) return true;
        return false;
    },
    build: ({ context }) => {
        const { filters, locale, options } = context;
        const currency = options.currency;
        const parts: string[] = [];

        if (filters.isFree === true) {
            parts.push(getPhrase({ locale, key: 'onlyFree' }));
        } else {
            const min = filters.price?.min ?? null;
            const max = filters.price?.max ?? null;
            if (min !== null && max !== null) {
                parts.push(
                    `${getPhrase({ locale, key: 'priceBetween' })} ${formatPrice({ value: min, locale, currency })} ${getPhrase({ locale, key: 'and' })} ${formatPrice({ value: max, locale, currency })}`
                );
            } else if (min !== null) {
                parts.push(
                    `${getPhrase({ locale, key: 'priceFrom' })} ${formatPrice({ value: min, locale, currency })}`
                );
            } else if (max !== null) {
                parts.push(
                    `${getPhrase({ locale, key: 'priceUpTo' })} ${formatPrice({ value: max, locale, currency })}`
                );
            }
        }

        // Note the explicit opt-out from "incluir sin precio". Default is TRUE
        // (server-side), so absent / true → no mention.
        if (filters.includeUnpriced === false) {
            parts.push(getPhrase({ locale, key: 'excludingUnpriced' }));
        }

        return parts.join(', ');
    }
};

/** Featured-only filter. Renders: `solo destacados`. */
const featuredDescriptor: FilterDescriptor = {
    key: 'featured',
    isActive: ({ filters }) => filters.isFeatured === true,
    build: ({ context }) => getPhrase({ locale: context.locale, key: 'onlyFeatured' })
};

/**
 * Ordered descriptor list (matches the desired modifier order in the sentence).
 *
 * Category appears FIRST so it can flow into the subject as "eventos de música"
 * rather than ", de música" (which reads as a parenthetical aside). Destination
 * follows ("eventos de música en Gualeguaychú"), then the remaining modifiers
 * comma-join as usual.
 */
export const FILTER_DESCRIPTORS: readonly FilterDescriptor[] = [
    categoryDescriptor,
    destinationDescriptor,
    textDescriptor,
    whenChipDescriptor,
    dateRangeDescriptor,
    priceDescriptor,
    featuredDescriptor
];

/** Descriptors that flow into the subject (no comma when first). */
export const FLOW_MODIFIER_KEYS: ReadonlySet<string> = new Set(['category', 'destination', 'text']);

// Tiny helper so consumers do not need to reach into the natural-list helper.
export { formatNaturalList };
