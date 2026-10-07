/**
 * Grammar catalogs, phrase dictionaries, and helper for the summary builder.
 *
 * This file is the single source of truth for all human-readable text fragments
 * used in summary generation. Consumers may extend the catalogs by merging
 * their own entries with the defaults exported here.
 */

import type { CatalogEntry, SortKeyEntry, SummaryLocale, TypeGrammarEntry } from './summary.types';

// ---------------------------------------------------------------------------
// Accommodation type grammar
// ---------------------------------------------------------------------------

/**
 * Default grammar entries for all standard accommodation types.
 * Provides singular and plural forms in Spanish and English.
 *
 * Consumers can extend this array when custom types are needed:
 * ```ts
 * const catalogs = {
 *   types: [
 *     ...DEFAULT_TYPE_GRAMMAR,
 *     { key: 'APART_HOTEL', singular: { es: 'apart hotel', en: 'apart hotel' }, plural: { es: 'apart hoteles', en: 'apart hotels' } },
 *   ]
 * };
 * ```
 */
export const DEFAULT_TYPE_GRAMMAR: readonly TypeGrammarEntry[] = [
    {
        key: 'APARTMENT',
        singular: { es: 'departamento', en: 'apartment', pt: 'apartamento' },
        plural: { es: 'departamentos', en: 'apartments', pt: 'apartamentos' }
    },
    {
        key: 'HOUSE',
        singular: { es: 'casa', en: 'house', pt: 'casa' },
        plural: { es: 'casas', en: 'houses', pt: 'casas' }
    },
    {
        key: 'COUNTRY_HOUSE',
        singular: { es: 'casa quinta', en: 'country house', pt: 'casa de campo' },
        plural: { es: 'casas quinta', en: 'country houses', pt: 'casas de campo' }
    },
    {
        key: 'CABIN',
        singular: { es: 'cabaña', en: 'cabin', pt: 'cabana' },
        plural: { es: 'cabañas', en: 'cabins', pt: 'cabanas' }
    },
    {
        key: 'HOTEL',
        singular: { es: 'hotel', en: 'hotel', pt: 'hotel' },
        plural: { es: 'hoteles', en: 'hotels', pt: 'hotéis' }
    },
    {
        key: 'HOSTEL',
        singular: { es: 'hostel', en: 'hostel', pt: 'hostel' },
        plural: { es: 'hostels', en: 'hostels', pt: 'hostels' }
    },
    {
        key: 'CAMPING',
        singular: { es: 'camping', en: 'campsite', pt: 'camping' },
        plural: { es: 'campings', en: 'campsites', pt: 'campings' }
    },
    {
        key: 'ROOM',
        singular: { es: 'habitación', en: 'room', pt: 'quarto' },
        plural: { es: 'habitaciones', en: 'rooms', pt: 'quartos' }
    },
    {
        key: 'MOTEL',
        singular: { es: 'motel', en: 'motel', pt: 'motel' },
        plural: { es: 'moteles', en: 'motels', pt: 'motéis' }
    },
    {
        key: 'RESORT',
        singular: { es: 'resort', en: 'resort', pt: 'resort' },
        plural: { es: 'resorts', en: 'resorts', pt: 'resorts' }
    }
] as const;

// ---------------------------------------------------------------------------
// Sort key catalog
// ---------------------------------------------------------------------------

/**
 * Default sort key definitions for standard accommodation sort options.
 * Each entry provides a label and directional phrases in both locales.
 *
 * Consumers can extend or replace this array to support custom sort keys.
 */
export const DEFAULT_SORT_KEYS: readonly SortKeyEntry[] = [
    {
        key: 'name',
        type: 'alpha',
        label: { es: 'nombre', en: 'name', pt: 'nome' },
        asc: { es: 'A a Z', en: 'A to Z', pt: 'A a Z' },
        desc: { es: 'Z a A', en: 'Z to A', pt: 'Z a A' }
    },
    {
        key: 'createdAt',
        type: 'date',
        label: { es: 'fecha de creación', en: 'creation date', pt: 'data de criação' },
        asc: { es: 'más antiguos primero', en: 'oldest first', pt: 'mais antigos primeiro' },
        desc: { es: 'más recientes primero', en: 'newest first', pt: 'mais recentes primeiro' }
    },
    {
        key: 'averageRating',
        type: 'numeric',
        label: { es: 'calificación', en: 'rating', pt: 'avaliação' },
        asc: { es: 'de menor a mayor', en: 'lowest first', pt: 'menor para maior' },
        desc: { es: 'de mayor a menor', en: 'highest first', pt: 'maior para menor' }
    },
    {
        key: 'reviewsCount',
        type: 'numeric',
        label: { es: 'cantidad de reseñas', en: 'review count', pt: 'quantidade de avaliações' },
        asc: { es: 'de menor a mayor', en: 'fewest first', pt: 'menos primeiro' },
        desc: { es: 'de mayor a menor', en: 'most first', pt: 'mais primeiro' }
    },
    {
        key: 'isFeatured',
        type: 'boolean',
        label: { es: 'destacados', en: 'featured', pt: 'destaques' },
        asc: {
            es: 'no destacados primero',
            en: 'non-featured first',
            pt: 'não destacados primeiro'
        },
        desc: { es: 'destacados primero', en: 'featured first', pt: 'destacados primeiro' }
    },
    {
        key: 'price',
        type: 'numeric',
        label: { es: 'precio', en: 'price', pt: 'preço' },
        asc: { es: 'de menor a mayor', en: 'lowest first', pt: 'menor para maior' },
        desc: { es: 'de mayor a menor', en: 'highest first', pt: 'maior para menor' }
    }
] as const;

// ---------------------------------------------------------------------------
// Phrase dictionary
// ---------------------------------------------------------------------------

/**
 * All sentence fragments used by the summary builder, keyed by locale.
 * The `getPhrase` helper provides type-safe access to these entries.
 */
export const PHRASES: Readonly<Record<SummaryLocale, Readonly<Record<string, string>>>> = {
    es: {
        showing: 'Mostrando',
        of: 'de',
        genericSubjectSingular: 'hospedaje',
        genericSubjectPlural: 'hospedajes',
        noFiltersActive: 'sin filtros activos',
        sortedBy: 'ordenados por',
        in: 'en',
        containing: 'que contienen',
        inNameOrDescription: 'en el nombre o la descripción',
        priceFrom: 'con precio desde',
        priceUpTo: 'con precio de hasta',
        priceBetween: 'con precio entre',
        and: 'y',
        or: 'o',
        withoutPriceDefined: 'sin precio definido',
        forAtLeast: 'para al menos',
        forExactly: 'para exactamente',
        guestSingular: 'huésped',
        guestPlural: 'huéspedes',
        withServicesLike: 'con servicios como',
        withAmenitiesLike: 'con amenities como',
        withMinRating: 'con calificación mínima de',
        withoutRating: 'sin calificación',
        withAtLeast: 'con al menos',
        withExactly: 'con exactamente',
        bedroomSingular: 'dormitorio',
        bedroomPlural: 'dormitorios',
        bathroomSingular: 'baño',
        bathroomPlural: 'baños',
        onlyFeatured: 'solo destacados',
        onlyNotFeatured: 'solo no destacados',
        noResultsFound: 'No se encontraron'
    },
    en: {
        showing: 'Showing',
        of: 'of',
        genericSubjectSingular: 'accommodation',
        genericSubjectPlural: 'accommodations',
        noFiltersActive: 'no active filters',
        sortedBy: 'sorted by',
        in: 'in',
        containing: 'containing',
        inNameOrDescription: 'in name or description',
        priceFrom: 'with price from',
        priceUpTo: 'with price up to',
        priceBetween: 'with price between',
        and: 'and',
        or: 'or',
        withoutPriceDefined: 'without defined price',
        forAtLeast: 'for at least',
        forExactly: 'for exactly',
        guestSingular: 'guest',
        guestPlural: 'guests',
        withServicesLike: 'with services like',
        withAmenitiesLike: 'with amenities like',
        withMinRating: 'with minimum rating of',
        withoutRating: 'without rating',
        withAtLeast: 'with at least',
        withExactly: 'with exactly',
        bedroomSingular: 'bedroom',
        bedroomPlural: 'bedrooms',
        bathroomSingular: 'bathroom',
        bathroomPlural: 'bathrooms',
        onlyFeatured: 'featured only',
        onlyNotFeatured: 'non-featured only',
        noResultsFound: 'No results found for'
    },
    pt: {
        showing: 'Mostrando',
        of: 'de',
        genericSubjectSingular: 'hospedagem',
        genericSubjectPlural: 'hospedagens',
        noFiltersActive: 'sem filtros ativos',
        sortedBy: 'ordenados por',
        in: 'em',
        containing: 'que contêm',
        inNameOrDescription: 'no nome ou na descrição',
        priceFrom: 'com preço a partir de',
        priceUpTo: 'com preço até',
        priceBetween: 'com preço entre',
        and: 'e',
        or: 'ou',
        withoutPriceDefined: 'sem preço definido',
        forAtLeast: 'para pelo menos',
        forExactly: 'para exatamente',
        guestSingular: 'hóspede',
        guestPlural: 'hóspedes',
        withServicesLike: 'com serviços como',
        withAmenitiesLike: 'com comodidades como',
        withMinRating: 'com avaliação mínima de',
        withoutRating: 'sem avaliação',
        withAtLeast: 'com pelo menos',
        withExactly: 'com exatamente',
        bedroomSingular: 'quarto',
        bedroomPlural: 'quartos',
        bathroomSingular: 'banheiro',
        bathroomPlural: 'banheiros',
        onlyFeatured: 'somente destacados',
        onlyNotFeatured: 'somente não destacados',
        noResultsFound: 'Nenhum resultado encontrado para'
    }
} as const;

// ---------------------------------------------------------------------------
// Phrase helper
// ---------------------------------------------------------------------------

/** Input for {@link getPhrase}. */
export interface GetPhraseInput {
    /** Output locale. */
    readonly locale: SummaryLocale;
    /** Phrase key from the PHRASES dictionary. */
    readonly key: string;
}

/**
 * Retrieves a phrase from the PHRASES dictionary for the given locale.
 * Returns the key itself as a fallback when the phrase is not found.
 *
 * @param input - {@link GetPhraseInput} containing `locale` and `key`
 * @returns Localised phrase string
 *
 * @example
 * ```ts
 * getPhrase({ locale: 'es', key: 'showing' }) // 'Mostrando'
 * getPhrase({ locale: 'en', key: 'of' })       // 'of'
 * ```
 */
export function getPhrase({ locale, key }: GetPhraseInput): string {
    return PHRASES[locale][key] ?? key;
}

// ---------------------------------------------------------------------------
// Catalog lookup helpers
// ---------------------------------------------------------------------------

/** Input for {@link lookupTypeEntry}. */
export interface LookupTypeEntryInput {
    /** Type key to look up. */
    readonly key: string;
    /** Available type grammar entries. */
    readonly entries: readonly TypeGrammarEntry[];
}

/**
 * Finds a type grammar entry by key.
 * Returns `undefined` when the key is not found.
 *
 * @param input - {@link LookupTypeEntryInput}
 * @returns Matching {@link TypeGrammarEntry} or `undefined`
 */
export function lookupTypeEntry({
    key,
    entries
}: LookupTypeEntryInput): TypeGrammarEntry | undefined {
    return entries.find((e) => e.key === key);
}

/** Input for {@link lookupCatalogLabel}. */
export interface LookupCatalogLabelInput {
    /** Entry key to look up. */
    readonly key: string;
    /** Available catalog entries. */
    readonly entries: readonly CatalogEntry[] | undefined;
    /** Output locale. */
    readonly locale: SummaryLocale;
}

/**
 * Resolves a catalog key to its human-readable label.
 * Falls back to the raw key when the catalog is empty or the key is not found.
 *
 * @param input - {@link LookupCatalogLabelInput}
 * @returns Human-readable label string
 *
 * @example
 * ```ts
 * lookupCatalogLabel({ key: 'colon', entries: destinations, locale: 'es' }) // 'Colón'
 * lookupCatalogLabel({ key: 'unknown', entries: undefined, locale: 'es' })  // 'unknown'
 * ```
 */
export function lookupCatalogLabel({ key, entries, locale }: LookupCatalogLabelInput): string {
    if (!entries) return key;
    const entry = entries.find((e) => e.key === key);
    return entry ? entry.label[locale] : key;
}
