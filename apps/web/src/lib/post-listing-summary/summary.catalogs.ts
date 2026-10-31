/**
 * Phrase dictionary and default catalogs for the post listing summary builder.
 *
 * Mirrors `event-listing-summary/summary.catalogs` in structure but scoped to
 * the post (blog) domain. The category catalog matches the FilterSidebar
 * options in `publicaciones/index.astro`.
 */

import type { CatalogEntry, SummaryLocale } from './summary.types';

/** Default post category labels (mirror the FilterSidebar config). */
export const DEFAULT_POST_CATEGORIES: readonly CatalogEntry[] = [
    { key: 'CULTURE', label: { es: 'cultura', en: 'culture', pt: 'cultura' } },
    { key: 'GASTRONOMY', label: { es: 'gastronomía', en: 'gastronomy', pt: 'gastronomia' } },
    { key: 'NATURE', label: { es: 'naturaleza', en: 'nature', pt: 'natureza' } },
    { key: 'TOURISM', label: { es: 'turismo', en: 'tourism', pt: 'turismo' } },
    { key: 'SPORT', label: { es: 'deporte', en: 'sport', pt: 'esporte' } },
    { key: 'HISTORY', label: { es: 'historia', en: 'history', pt: 'história' } },
    { key: 'EVENTS', label: { es: 'eventos', en: 'events', pt: 'eventos' } },
    { key: 'CARNIVAL', label: { es: 'carnaval', en: 'carnival', pt: 'carnaval' } },
    { key: 'WELLNESS', label: { es: 'bienestar', en: 'wellness', pt: 'bem-estar' } },
    { key: 'FAMILY', label: { es: 'familia', en: 'family', pt: 'família' } },
    { key: 'TIPS', label: { es: 'consejos', en: 'tips', pt: 'dicas' } }
] as const;

/**
 * Sort phrase per encoded sort key (matches `SORT_OPTION_MAP` in the
 * publicaciones page). The key is the URL-friendly sort identifier; the value
 * is the prose describing it ("ordenados por ..."). Extending this requires
 * keeping the keys in sync with the page.
 */
export const SORT_KEY_PHRASES: Readonly<Record<string, Record<SummaryLocale, string>>> = {
    newest: {
        es: 'por publicación más reciente',
        en: 'by most recently published',
        pt: 'por publicação mais recente'
    },
    oldest: {
        es: 'por publicación más antigua',
        en: 'by oldest first',
        pt: 'por publicação mais antiga'
    },
    mostSaved: { es: 'por más guardadas', en: 'by most saved', pt: 'por mais salvas' },
    featured: {
        es: 'con las destacadas primero',
        en: 'with featured first',
        pt: 'com as destacadas primeiro'
    },
    titleAsc: { es: 'por título, A a Z', en: 'by title, A to Z', pt: 'por título, de A a Z' },
    titleDesc: { es: 'por título, Z a A', en: 'by title, Z to A', pt: 'por título, de Z a A' }
};

/**
 * Phrase dictionary for templated assembly. Keys are referenced by both the
 * builder and the individual descriptors.
 */
const PHRASES: Readonly<Record<SummaryLocale, Readonly<Record<string, string>>>> = {
    es: {
        showing: 'Mostrando',
        of: 'de',
        postSingular: 'publicación',
        postPlural: 'publicaciones',
        noFiltersActive: 'sin filtros activos',
        sortedBy: 'ordenadas',
        in: 'sobre',
        containing: 'que contienen',
        inTitleOrContent: 'en el título o el contenido',
        and: 'y',
        ofCategory: 'de',
        onlyFeatured: 'solo destacadas',
        dateFrom: 'publicadas desde el',
        dateTo: 'publicadas hasta el',
        dateBetween: 'publicadas entre el',
        noResultsFound: 'No se encontraron'
    },
    en: {
        showing: 'Showing',
        of: 'of',
        postSingular: 'post',
        postPlural: 'posts',
        noFiltersActive: 'no active filters',
        sortedBy: 'sorted',
        in: 'about',
        containing: 'containing',
        inTitleOrContent: 'in title or content',
        and: 'and',
        ofCategory: 'of',
        onlyFeatured: 'featured only',
        dateFrom: 'published from',
        dateTo: 'published up to',
        dateBetween: 'published between',
        noResultsFound: 'No results found for'
    },
    pt: {
        showing: 'Mostrando',
        of: 'de',
        postSingular: 'publicação',
        postPlural: 'publicações',
        noFiltersActive: 'sem filtros ativos',
        sortedBy: 'ordenadas',
        in: 'sobre',
        containing: 'que contêm',
        inTitleOrContent: 'no título ou no conteúdo',
        and: 'e',
        ofCategory: 'de',
        onlyFeatured: 'somente destacadas',
        dateFrom: 'publicadas desde',
        dateTo: 'publicadas até',
        dateBetween: 'publicadas entre',
        noResultsFound: 'Nenhum resultado encontrado para'
    }
} as const;

/** Look up a phrase by locale and key. Falls back to the key when not found. */
export function getPhrase({ locale, key }: { locale: SummaryLocale; key: string }): string {
    return PHRASES[locale][key] ?? key;
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
