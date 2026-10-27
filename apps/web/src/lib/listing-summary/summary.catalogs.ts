/**
 * Phrase dictionary and default catalogs for the listing summary
 * builder (gastronomy + experience, BETA-119).
 *
 * Mirrors `post-listing-summary/summary.catalogs` and
 * `event-listing-summary/summary.catalogs` in structure. The default type
 * catalogs match the FilterSidebar options in `gastronomia/index.astro` and
 * `experiencias/index.astro`, and the labels match the existing
 * `gastronomy.types.*` / `experience.type.*` i18n copy in
 * `packages/i18n/src/locales/{es,en,pt}/{gastronomy,experience}.json`.
 */

import type { CatalogEntry, EntityGender, SummaryLocale } from './summary.types';

/** Default gastronomy type labels (mirror the FilterSidebar config + i18n copy). */
export const DEFAULT_VENUE_TYPES: readonly CatalogEntry[] = [
    { key: 'RESTAURANT', label: { es: 'restaurante', en: 'restaurant', pt: 'restaurante' } },
    { key: 'BAR', label: { es: 'bar', en: 'bar', pt: 'bar' } },
    { key: 'CAFE', label: { es: 'café', en: 'café', pt: 'café' } },
    { key: 'PARRILLA', label: { es: 'parrilla', en: 'grill', pt: 'churrascaria' } },
    { key: 'CERVECERIA', label: { es: 'cervecería', en: 'brewery', pt: 'cervejaria' } },
    { key: 'HELADERIA', label: { es: 'heladería', en: 'ice cream shop', pt: 'sorveteria' } },
    { key: 'PANADERIA', label: { es: 'panadería', en: 'bakery', pt: 'padaria' } },
    { key: 'ROTISERIA', label: { es: 'rotisería', en: 'delicatessen', pt: 'rotisserie' } },
    { key: 'FOOD_TRUCK', label: { es: 'food truck', en: 'food truck', pt: 'food truck' } }
] as const;

/** Default experience type labels (mirror the FilterSidebar config + i18n copy). */
export const DEFAULT_EXPERIENCE_TYPES: readonly CatalogEntry[] = [
    {
        key: 'CAR_RENTAL',
        label: { es: 'alquiler de autos', en: 'car rental', pt: 'aluguel de carros' }
    },
    {
        key: 'BIKE_RENTAL',
        label: { es: 'alquiler de bicicletas', en: 'bike rental', pt: 'aluguel de bicicletas' }
    },
    {
        key: 'KAYAK_RENTAL',
        label: { es: 'alquiler de kayak', en: 'kayak rental', pt: 'aluguel de caiaque' }
    },
    {
        key: 'QUAD_RENTAL',
        label: { es: 'alquiler de cuadriciclos', en: 'quad rental', pt: 'aluguel de quadriciclos' }
    },
    { key: 'TOUR_GUIDE', label: { es: 'guía turístico', en: 'tour guide', pt: 'guia turístico' } },
    {
        key: 'GUIDED_VISIT',
        label: { es: 'visita guiada', en: 'guided visit', pt: 'visita guiada' }
    },
    { key: 'EXCURSION', label: { es: 'excursión', en: 'excursion', pt: 'excursão' } },
    { key: 'BOAT_TRIP', label: { es: 'paseo en lancha', en: 'boat trip', pt: 'passeio de barco' } },
    {
        key: 'FISHING_CHARTER',
        label: { es: 'pesca deportiva', en: 'fishing charter', pt: 'pesca esportiva' }
    },
    {
        key: 'BIRD_WATCHING',
        label: { es: 'avistamiento de aves', en: 'bird watching', pt: 'observação de aves' }
    },
    {
        key: 'CULTURAL_TOUR',
        label: { es: 'tour cultural', en: 'cultural tour', pt: 'tour cultural' }
    },
    {
        key: 'WINE_TASTING',
        label: { es: 'degustación de vinos', en: 'wine tasting', pt: 'degustação de vinhos' }
    },
    {
        key: 'OUTDOOR_ADVENTURE',
        label: { es: 'aventura al aire libre', en: 'outdoor adventure', pt: 'aventura ao ar livre' }
    },
    { key: 'OTHER', label: { es: 'otro', en: 'other', pt: 'outro' } }
] as const;

/**
 * Default price-range labels (gastronomy only). Plural adjective forms so
 * they compose naturally as "con precios económicos" / "with budget prices".
 */
export const DEFAULT_PRICE_RANGES: readonly CatalogEntry[] = [
    { key: 'BUDGET', label: { es: 'económicos', en: 'budget', pt: 'econômicos' } },
    { key: 'MID', label: { es: 'moderados', en: 'moderate', pt: 'moderados' } },
    { key: 'HIGH', label: { es: 'elevados', en: 'upscale', pt: 'elevados' } },
    { key: 'PREMIUM', label: { es: 'premium', en: 'premium', pt: 'premium' } }
] as const;

/**
 * Sort phrase fragment per encoded sort key (matches the identical
 * `sortOptions` array declared in both `gastronomia/index.astro` and
 * `experiencias/index.astro`). The `featured` fragment is gender-dependent
 * (Spanish agreement with the entity noun); the others are gender-invariant.
 * Consumed via {@link getSortPhraseFragment}, never indexed directly.
 */
const SORT_KEY_PHRASES: Readonly<
    Record<
        string,
        {
            readonly es: Record<EntityGender, string>;
            readonly en: string;
            readonly pt: Record<EntityGender, string>;
        }
    >
> = {
    featured: {
        es: {
            masculine: 'con los destacados primero',
            feminine: 'con las destacadas primero'
        },
        en: 'with featured first',
        pt: {
            masculine: 'com os destacados primeiro',
            feminine: 'com as destacadas primeiro'
        }
    },
    ratingDesc: {
        es: { masculine: 'por mejor calificación', feminine: 'por mejor calificación' },
        en: 'by highest rating',
        pt: { masculine: 'por melhor avaliação', feminine: 'por melhor avaliação' }
    },
    newest: {
        es: { masculine: 'por más recientes', feminine: 'por más recientes' },
        en: 'by most recent',
        pt: { masculine: 'por mais recentes', feminine: 'por mais recentes' }
    },
    nameAsc: {
        es: { masculine: 'por nombre, A a Z', feminine: 'por nombre, A a Z' },
        en: 'by name, A to Z',
        pt: { masculine: 'por nome, de A a Z', feminine: 'por nome, de A a Z' }
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
    if (locale === 'en') return entry.en;
    return locale === 'pt' ? entry.pt[gender] : entry.es[gender];
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
    },
    pt: {
        showing: 'Mostrando',
        of: 'de',
        noFiltersActive: 'sem filtros ativos',
        ofCategory: 'de',
        in: 'em',
        containing: 'que contêm',
        inNameOrDescription: 'no nome ou na descrição',
        withPrices: 'com preços',
        minRating: 'com avaliação mínima de',
        noResultsFound: 'Nenhum resultado encontrado para'
    }
} as const;

/** Gender-dependent phrase fragments (Spanish and Portuguese agreement; English is invariant). */
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
    },
    pt: {
        sortedBy: { masculine: 'ordenados', feminine: 'ordenadas' },
        onlyFeatured: { masculine: 'somente destacados', feminine: 'somente destacadas' }
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
