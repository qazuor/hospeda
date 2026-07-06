/**
 * Filter descriptors for the commerce listing summary builder.
 *
 * Mirrors `post-listing-summary/summary.descriptors` / `event-listing-summary/summary.descriptors`
 * in style: each descriptor is a self-contained unit with `isActive` and
 * `build`. The array order controls the modifier order in the final sentence.
 *
 * `cleanText` and `formatRating` are reused from the accommodation module to
 * avoid duplication — they are domain-agnostic.
 */

import { cleanText, formatRating } from '../accommodation-listing-summary/summary.helpers';
import { getGenderedPhrase, getPhrase, lookupCatalogLabel } from './summary.catalogs';
import type { FilterDescriptor } from './summary.types';

/**
 * Type/category filter. Renders: `de restaurante` / `de guía turístico`.
 * Flow modifier — attaches directly to the subject with a space.
 */
const typeDescriptor: FilterDescriptor = {
    key: 'type',
    isActive: ({ filters }) => Boolean(filters.type),
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const label = lookupCatalogLabel({
            key: filters.type ?? '',
            entries: catalogs.types,
            locale
        });
        return `${getPhrase({ locale, key: 'ofCategory' })} ${label}`;
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

/**
 * Free-text filter. Renders: `que contienen "centro" en el nombre o la descripción`.
 * Comma modifier unless it is the only active flow-adjacent modifier
 * (joining rule is decided by the builder via `destinationActive`).
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
        const containing = getPhrase({ locale, key: 'containing' });
        const inNameOrDescription = getPhrase({ locale, key: 'inNameOrDescription' });
        return `${containing} "${cleaned}" ${inNameOrDescription}`;
    }
};

/**
 * Price-range filter (gastronomy only). Renders: `con precios económicos`.
 * No-op (inactive) for entities where `hasPriceRange` is false, even if a
 * stray `priceRange` value were somehow present in `filters`.
 */
const priceRangeDescriptor: FilterDescriptor = {
    key: 'priceRange',
    isActive: ({ filters, entity }) => entity.hasPriceRange && Boolean(filters.priceRange),
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const label = lookupCatalogLabel({
            key: filters.priceRange ?? '',
            entries: catalogs.priceRanges,
            locale
        });
        return `${getPhrase({ locale, key: 'withPrices' })} ${label}`;
    }
};

/**
 * Minimum-rating filter. Renders: `con calificación mínima de 4,5`.
 */
const minRatingDescriptor: FilterDescriptor = {
    key: 'minRating',
    isActive: ({ filters }) => filters.minRating !== undefined && filters.minRating !== null,
    build: ({ context }) => {
        const { filters, locale } = context;
        const formatted = formatRating({ value: filters.minRating ?? 0, locale });
        return `${getPhrase({ locale, key: 'minRating' })} ${formatted}`;
    }
};

/**
 * Featured-only filter. Renders: `solo destacados` / `solo destacadas`
 * (gender-agreed with the entity's subject noun).
 */
const featuredDescriptor: FilterDescriptor = {
    key: 'featured',
    isActive: ({ filters }) => filters.isFeatured === true,
    build: ({ context }) =>
        getGenderedPhrase({
            locale: context.locale,
            key: 'onlyFeatured',
            gender: context.entity.gender
        })
};

/**
 * Ordered descriptor list. Matches the desired modifier order in the
 * sentence:
 *   "X establecimientos gastronómicos de restaurante en Concordia, que
 *    contienen \"pizza\" en el nombre o la descripción, con precios
 *    económicos, con calificación mínima de 4, solo destacados, ordenados..."
 *
 * Type appears FIRST so it flows into the subject ("establecimientos
 * gastronómicos de restaurante") rather than as a parenthetical aside.
 * Destination follows, then the remaining modifiers comma-join as usual.
 */
export const FILTER_DESCRIPTORS: readonly FilterDescriptor[] = [
    typeDescriptor,
    destinationDescriptor,
    textDescriptor,
    priceRangeDescriptor,
    minRatingDescriptor,
    featuredDescriptor
];
