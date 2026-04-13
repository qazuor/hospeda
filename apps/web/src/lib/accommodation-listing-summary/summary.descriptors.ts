/**
 * Filter descriptors for the accommodation listing summary builder.
 *
 * Each descriptor is an isolated, composable unit that:
 * 1. Detects whether its corresponding filter is active.
 * 2. Builds the prose fragment that describes it.
 *
 * The `types` filter is NOT included here — it is handled separately by
 * `summary.subject.ts` because it becomes the sentence subject rather than
 * a modifier.
 *
 * The order of this array controls the order of modifiers in the final sentence.
 */

import { getPhrase, lookupCatalogLabel } from './summary.catalogs';
import {
    cleanText,
    formatNaturalList,
    formatPrice,
    formatRating,
    pluralizeWord,
    toSafeNumber
} from './summary.helpers';
import type { FilterDescriptor } from './summary.types';

// ---------------------------------------------------------------------------
// Helper: resolve catalog labels for a list of keys
// ---------------------------------------------------------------------------

function resolveLabels(
    keys: readonly string[],
    entries: readonly { key: string; label: Record<string, string> }[] | undefined,
    locale: string
): string[] {
    return keys.map((key) => {
        if (!entries) return key;
        const entry = entries.find((e) => e.key === key);
        return entry ? (entry.label[locale] ?? key) : key;
    });
}

// ---------------------------------------------------------------------------
// Individual descriptors
// ---------------------------------------------------------------------------

/**
 * Destination filter descriptor.
 * Renders: "en Colón" or "en Colón o Concordia"
 *
 * Note: destination is a "flow modifier" — it attaches directly to the
 * subject with a space (no comma).
 */
const destinationDescriptor: FilterDescriptor = {
    key: 'destination',
    isActive: ({ filters }) =>
        Array.isArray(filters.destinations) && filters.destinations.length > 0,
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const destinations = filters.destinations ?? [];
        const labels = destinations.map((key) =>
            lookupCatalogLabel({ key, entries: catalogs.destinations, locale })
        );
        const conjunction = getPhrase({ locale, key: 'or' });
        const list = formatNaturalList({ items: labels, conjunction });
        return `${getPhrase({ locale, key: 'in' })} ${list}`;
    }
};

/**
 * Free-text filter descriptor.
 * Renders: `que contienen "centro" en el nombre o la descripción`
 *
 * Note: text is a "flow modifier" — it attaches directly to the subject
 * (or after destination) with a space (no comma). However when BOTH
 * destination and text are active, the builder adds a comma before text.
 */
const textDescriptor: FilterDescriptor = {
    key: 'text',
    isActive: ({ filters }) => {
        if (!filters.text) return false;
        const cleaned = cleanText({ text: filters.text });
        return cleaned.length > 0;
    },
    build: ({ context }) => {
        const { filters, locale } = context;
        const raw = filters.text ?? '';
        const cleaned = cleanText({ text: raw });
        const containing = getPhrase({ locale, key: 'containing' });
        const inNameOrDesc = getPhrase({ locale, key: 'inNameOrDescription' });
        return `${containing} "${cleaned}" ${inNameOrDesc}`;
    }
};

/**
 * Price range filter descriptor.
 * Handles: min only, max only, both, includeWithoutPrice alone, and combinations.
 *
 * Renders examples:
 * - "con precio desde $8.000"
 * - "con precio de hasta $20.000"
 * - "con precio entre $8.000 y $20.000"
 * - "sin precio definido"
 * - "con precio entre $8.000 y $20.000 o sin precio definido"
 */
const priceDescriptor: FilterDescriptor = {
    key: 'price',
    isActive: ({ filters }) => {
        const p = filters.price;
        if (!p) return false;
        const minNum = toSafeNumber({ value: p.min });
        const maxNum = toSafeNumber({ value: p.max });
        return minNum !== null || maxNum !== null || p.includeWithoutPrice === true;
    },
    build: ({ context }) => {
        const { filters, locale, options } = context;
        const p = filters.price ?? {};
        const minNum = toSafeNumber({ value: p.min });
        const maxNum = toSafeNumber({ value: p.max });
        const includeWithout = p.includeWithoutPrice === true;

        const currency = options.currency;
        const and = getPhrase({ locale, key: 'and' });
        const or = getPhrase({ locale, key: 'or' });
        const withoutPriceDefined = getPhrase({ locale, key: 'withoutPriceDefined' });

        let rangePart = '';

        if (minNum !== null && maxNum !== null) {
            const formattedMin = formatPrice({ value: minNum, locale, currency });
            const formattedMax = formatPrice({ value: maxNum, locale, currency });
            const priceBetween = getPhrase({ locale, key: 'priceBetween' });
            rangePart = `${priceBetween} ${formattedMin} ${and} ${formattedMax}`;
        } else if (minNum !== null) {
            const formattedMin = formatPrice({ value: minNum, locale, currency });
            const priceFrom = getPhrase({ locale, key: 'priceFrom' });
            rangePart = `${priceFrom} ${formattedMin}`;
        } else if (maxNum !== null) {
            const formattedMax = formatPrice({ value: maxNum, locale, currency });
            const priceUpTo = getPhrase({ locale, key: 'priceUpTo' });
            rangePart = `${priceUpTo} ${formattedMax}`;
        }

        if (rangePart && includeWithout) {
            return `${rangePart} ${or} ${withoutPriceDefined}`;
        }
        if (rangePart) {
            return rangePart;
        }
        // Only includeWithoutPrice active
        return withoutPriceDefined;
    }
};

/**
 * Guests filter descriptor.
 * Renders: "para al menos 3 huéspedes" or "para exactamente 1 huésped"
 */
const guestsDescriptor: FilterDescriptor = {
    key: 'guests',
    isActive: ({ filters }) => toSafeNumber({ value: filters.guests }) !== null,
    build: ({ context }) => {
        const { filters, locale, options } = context;
        const count = toSafeNumber({ value: filters.guests }) ?? 0;
        const mode = options.quantityMode?.guests ?? 'atLeast';
        const prefix =
            mode === 'exact'
                ? getPhrase({ locale, key: 'forExactly' })
                : getPhrase({ locale, key: 'forAtLeast' });
        const noun = pluralizeWord({
            count,
            singular: getPhrase({ locale, key: 'guestSingular' }),
            plural: getPhrase({ locale, key: 'guestPlural' })
        });
        return `${prefix} ${count} ${noun}`;
    }
};

/**
 * Bedrooms filter descriptor.
 * Renders: "con al menos 2 dormitorios" or "con exactamente 1 dormitorio"
 */
const bedroomsDescriptor: FilterDescriptor = {
    key: 'bedrooms',
    isActive: ({ filters }) => toSafeNumber({ value: filters.bedrooms }) !== null,
    build: ({ context }) => {
        const { filters, locale, options } = context;
        const count = toSafeNumber({ value: filters.bedrooms }) ?? 0;
        const mode = options.quantityMode?.bedrooms ?? 'atLeast';
        const prefix =
            mode === 'exact'
                ? getPhrase({ locale, key: 'withExactly' })
                : getPhrase({ locale, key: 'withAtLeast' });
        const noun = pluralizeWord({
            count,
            singular: getPhrase({ locale, key: 'bedroomSingular' }),
            plural: getPhrase({ locale, key: 'bedroomPlural' })
        });
        return `${prefix} ${count} ${noun}`;
    }
};

/**
 * Bathrooms filter descriptor.
 * Renders: "con al menos 1 baño" or "con exactamente 2 baños"
 */
const bathroomsDescriptor: FilterDescriptor = {
    key: 'bathrooms',
    isActive: ({ filters }) => toSafeNumber({ value: filters.bathrooms }) !== null,
    build: ({ context }) => {
        const { filters, locale, options } = context;
        const count = toSafeNumber({ value: filters.bathrooms }) ?? 0;
        const mode = options.quantityMode?.bathrooms ?? 'atLeast';
        const prefix =
            mode === 'exact'
                ? getPhrase({ locale, key: 'withExactly' })
                : getPhrase({ locale, key: 'withAtLeast' });
        const noun = pluralizeWord({
            count,
            singular: getPhrase({ locale, key: 'bathroomSingular' }),
            plural: getPhrase({ locale, key: 'bathroomPlural' })
        });
        return `${prefix} ${count} ${noun}`;
    }
};

/**
 * Services filter descriptor.
 * Renders: "con servicios como desayuno y limpieza"
 */
const servicesDescriptor: FilterDescriptor = {
    key: 'services',
    isActive: ({ filters }) => Array.isArray(filters.services) && filters.services.length > 0,
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const services = filters.services ?? [];
        const labels = resolveLabels(services, catalogs.services, locale);
        const conjunction = getPhrase({ locale, key: 'and' });
        const list = formatNaturalList({ items: labels, conjunction });
        return `${getPhrase({ locale, key: 'withServicesLike' })} ${list}`;
    }
};

/**
 * Amenities filter descriptor.
 * Renders: "con amenities como wifi y pileta"
 */
const amenitiesDescriptor: FilterDescriptor = {
    key: 'amenities',
    isActive: ({ filters }) => Array.isArray(filters.amenities) && filters.amenities.length > 0,
    build: ({ context }) => {
        const { filters, catalogs, locale } = context;
        const amenities = filters.amenities ?? [];
        const labels = resolveLabels(amenities, catalogs.amenities, locale);
        const conjunction = getPhrase({ locale, key: 'and' });
        const list = formatNaturalList({ items: labels, conjunction });
        return `${getPhrase({ locale, key: 'withAmenitiesLike' })} ${list}`;
    }
};

/**
 * Rating filter descriptor.
 * Handles: rating only, includeWithoutRating only, or both.
 *
 * Renders:
 * - "con calificación mínima de 4"
 * - "con calificación mínima de 4 o sin calificación"
 * - "sin calificación" (when only includeWithoutRating is true)
 */
const ratingDescriptor: FilterDescriptor = {
    key: 'rating',
    isActive: ({ filters }) => {
        const hasRating = toSafeNumber({ value: filters.minRating }) !== null;
        const hasWithout = filters.includeWithoutRating === true;
        return hasRating || hasWithout;
    },
    build: ({ context }) => {
        const { filters, locale } = context;
        const ratingNum = toSafeNumber({ value: filters.minRating });
        const includeWithout = filters.includeWithoutRating === true;

        const withoutRating = getPhrase({ locale, key: 'withoutRating' });
        const or = getPhrase({ locale, key: 'or' });

        if (ratingNum !== null) {
            const formattedRating = formatRating({ value: ratingNum, locale });
            const withMinRating = getPhrase({ locale, key: 'withMinRating' });
            const ratingPart = `${withMinRating} ${formattedRating}`;
            return includeWithout ? `${ratingPart} ${or} ${withoutRating}` : ratingPart;
        }

        // Only includeWithoutRating is active
        return withoutRating;
    }
};

/**
 * Featured filter descriptor.
 * Renders: "solo destacados" (true) or "solo no destacados" (false)
 * Not active when `featured` is null or undefined.
 */
const featuredDescriptor: FilterDescriptor = {
    key: 'featured',
    isActive: ({ filters }) => filters.featured === true || filters.featured === false,
    build: ({ context }) => {
        const { filters, locale } = context;
        return filters.featured === true
            ? getPhrase({ locale, key: 'onlyFeatured' })
            : getPhrase({ locale, key: 'onlyNotFeatured' });
    }
};

// ---------------------------------------------------------------------------
// Ordered descriptor array (controls sentence order)
// ---------------------------------------------------------------------------

/**
 * All filter descriptors in the order they appear in the summary sentence.
 *
 * Order:
 * 1. destination  (flow modifier — no comma after subject)
 * 2. text         (flow modifier — no comma after subject, comma if destination also active)
 * 3. price        (comma modifier)
 * 4. guests       (comma modifier)
 * 5. bedrooms     (comma modifier)
 * 6. bathrooms    (comma modifier)
 * 7. services     (comma modifier)
 * 8. amenities    (comma modifier)
 * 9. rating       (comma modifier)
 * 10. featured    (comma modifier)
 */
export const FILTER_DESCRIPTORS: readonly FilterDescriptor[] = [
    destinationDescriptor,
    textDescriptor,
    priceDescriptor,
    guestsDescriptor,
    bedroomsDescriptor,
    bathroomsDescriptor,
    servicesDescriptor,
    amenitiesDescriptor,
    ratingDescriptor,
    featuredDescriptor
] as const;

/** Keys of the "flow modifiers" — these attach to the subject with a space, not a comma. */
export const FLOW_MODIFIER_KEYS: ReadonlySet<string> = new Set(['destination', 'text']);
