/**
 * Phrase dictionary and default catalogs for the commerce listing summary
 * builder (gastronomy + experience, BETA-119).
 *
 * Mirrors `post-listing-summary/summary.catalogs` and
 * `event-listing-summary/summary.catalogs` in structure. The default type
 * catalogs match the FilterSidebar options in `gastronomia/index.astro` and
 * `experiencias/index.astro`, and the labels match the existing
 * `gastronomy.types.*` / `experience.type.*` i18n copy in
 * `packages/i18n/src/locales/{es,en}/{gastronomy,experience}.json`.
 */

import type { CatalogEntry, EntityGender, SummaryLocale } from './summary.types';

/** Default gastronomy type labels (mirror the FilterSidebar config + i18n copy). */
export const DEFAULT_GASTRONOMY_TYPES: readonly CatalogEntry[] = [
    { key: 'RESTAURANT', label: { es: 'restaurante', en: 'restaurant' } },
    { key: 'BAR', label: { es: 'bar', en: 'bar' } },
    { key: 'CAFE', label: { es: 'café', en: 'café' } },
    { key: 'PARRILLA', label: { es: 'parrilla', en: 'grill' } },
    { key: 'CERVECERIA', label: { es: 'cervecería', en: 'brewery' } },
    { key: 'HELADERIA', label: { es: 'heladería', en: 'ice cream shop' } },
    { key: 'PANADERIA', label: { es: 'panadería', en: 'bakery' } },
    { key: 'ROTISERIA', label: { es: 'rotisería', en: 'delicatessen' } },
    { key: 'FOOD_TRUCK', label: { es: 'food truck', en: 'food truck' } }
] as const;

/** Default experience type labels (mirror the FilterSidebar config + i18n copy). */
export const DEFAULT_EXPERIENCE_TYPES: readonly CatalogEntry[] = [
    { key: 'CAR_RENTAL', label: { es: 'alquiler de autos', en: 'car rental' } },
    { key: 'BIKE_RENTAL', label: { es: 'alquiler de bicicletas', en: 'bike rental' } },
    { key: 'KAYAK_RENTAL', label: { es: 'alquiler de kayak', en: 'kayak rental' } },
    { key: 'QUAD_RENTAL', label: { es: 'alquiler de cuadriciclos', en: 'quad rental' } },
    { key: 'TOUR_GUIDE', label: { es: 'guía turístico', en: 'tour guide' } },
    { key: 'GUIDED_VISIT', label: { es: 'visita guiada', en: 'guided visit' } },
    { key: 'EXCURSION', label: { es: 'excursión', en: 'excursion' } },
    { key: 'BOAT_TRIP', label: { es: 'paseo en lancha', en: 'boat trip' } },
    { key: 'FISHING_CHARTER', label: { es: 'pesca deportiva', en: 'fishing charter' } },
    { key: 'BIRD_WATCHING', label: { es: 'avistamiento de aves', en: 'bird watching' } },
    { key: 'CULTURAL_TOUR', label: { es: 'tour cultural', en: 'cultural tour' } },
    { key: 'WINE_TASTING', label: { es: 'degustación de vinos', en: 'wine tasting' } },
    { key: 'OUTDOOR_ADVENTURE', label: { es: 'aventura al aire libre', en: 'outdoor adventure' } },
    { key: 'OTHER', label: { es: 'otro', en: 'other' } }
] as const;

/**
 * Default price-range labels (gastronomy only). Plural adjective forms so
 * they compose naturally as "con precios económicos" / "with budget prices".
 */
export const DEFAULT_PRICE_RANGES: readonly CatalogEntry[] = [
    { key: 'BUDGET', label: { es: 'económicos', en: 'budget' } },
    { key: 'MID', label: { es: 'moderados', en: 'moderate' } },
    { key: 'HIGH', label: { es: 'elevados', en: 'upscale' } },
    { key: 'PREMIUM', label: { es: 'premium', en: 'premium' } }
] as const;

/**
 * Sort phrase fragment per encoded sort key (matches the identical
 * `sortOptions` array declared in both `gastronomia/index.astro` and
 * `experiencias/index.astro`). The `featured` fragment is gender-dependent
 * (Spanish agreement with the entity noun); the others are gender-invariant.
 * Consumed via {@link getSortPhraseFragment}, never indexed directly.
 */
const SORT_KEY_PHRASES: Readonly<
    Record<string, { readonly es: Record<EntityGender, string>; readonly en: string }>
> = {
    featured: {
        es: {
            masculine: 'con los destacados primero',
            feminine: 'con las destacadas primero'
        },
        en: 'with featured first'
    },
    ratingDesc: {
        es: { masculine: 'por mejor calificación', feminine: 'por mejor calificación' },
        en: 'by highest rating'
    },
    newest: {
        es: { masculine: 'por más recientes', feminine: 'por más recientes' },
        en: 'by most recent'
    },
    nameAsc: {
        es: { masculine: 'por nombre, A a Z', feminine: 'por nombre, A a Z' },
        en: 'by name, A to Z'
    }
};

/** Resolve the sort-phrase fragment (without the leading "ordenados"/"sorted" word) for a given sort key, locale, and entity gender. Returns `undefined` for unknown keys. */
export function getSortPhraseFragment({
    sortKey,
    locale,
    gender
}: {
    readonly sortKey: string;
    readonly locale: SummaryLocale;
    readonly gender: EntityGender;
}): string | undefined {
    const entry = SORT_KEY_PHRASES[sortKey];
    if (!entry) return undefined;
    return locale === 'es' ? entry.es[gender] : entry.en;
}

/**
 * Phrase dictionary for templated assembly. Keys are referenced by both the
 * builder and the individual descriptors. Gender-dependent entries
 * (`sortedBy`, `onlyFeatured`) are resolved via {@link getGenderedPhrase}.
 */
const PHRASES: Readonly<Record<SummaryLocale, Readonly<Record<string, string>>>> = {
    es: {
        showing: 'Mostrando',
        of: 'de',
        noFiltersActive: 'sin filtros activos',
        ofCategory: 'de',
        in: 'en',
        containing: 'que contienen',
        inNameOrDescription: 'en el nombre o la descripción',
        withPrices: 'con precios',
        minRating: 'con calificación mínima de',
        noResultsFound: 'No se encontraron'
    },
    en: {
        showing: 'Showing',
        of: 'of',
        noFiltersActive: 'no active filters',
        ofCategory: 'of',
        in: 'in',
        containing: 'containing',
        inNameOrDescription: 'in name or description',
        withPrices: 'with',
        minRating: 'with minimum rating of',
        noResultsFound: 'No results found for'
    }
} as const;

/** Gender-dependent phrase fragments (Spanish agreement; English is invariant). */
const GENDERED_PHRASES: Readonly<
    Record<SummaryLocale, Record<'sortedBy' | 'onlyFeatured', Record<EntityGender, string>>>
> = {
    es: {
        sortedBy: { masculine: 'ordenados', feminine: 'ordenadas' },
        onlyFeatured: { masculine: 'solo destacados', feminine: 'solo destacadas' }
    },
    en: {
        sortedBy: { masculine: 'sorted', feminine: 'sorted' },
        onlyFeatured: { masculine: 'featured only', feminine: 'featured only' }
    }
} as const;

/** Look up a phrase by locale and key. Falls back to the key when not found. */
export function getPhrase({ locale, key }: { locale: SummaryLocale; key: string }): string {
    return PHRASES[locale][key] ?? key;
}

/** Resolve a gender-dependent phrase fragment ("ordenados/ordenadas", "solo destacados/destacadas"). */
export function getGenderedPhrase({
    locale,
    key,
    gender
}: {
    readonly locale: SummaryLocale;
    readonly key: 'sortedBy' | 'onlyFeatured';
    readonly gender: EntityGender;
}): string {
    return GENDERED_PHRASES[locale][key][gender];
}

/** Resolve a catalog key to a localized label (fallback: raw key). */
export function lookupCatalogLabel({
    key,
    entries,
    locale
}: {
    key: string;
    entries: readonly CatalogEntry[] | undefined;
    locale: SummaryLocale;
}): string {
    if (!entries) return key;
    const entry = entries.find((e) => e.key === key);
    return entry ? entry.label[locale] : key;
}
