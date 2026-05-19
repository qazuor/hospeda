/**
 * Phrase dictionary and default catalogs for the event listing summary builder.
 *
 * Mirrors `accommodation-listing-summary/summary.catalogs` in structure but
 * scoped to the event domain. The phrase table is intentionally a superset of
 * what the descriptors need — extra keys are harmless and keep the file
 * extensible.
 */

import type { CatalogEntry, SummaryLocale } from './summary.types';

/** Default event category labels (mirror the FilterSidebar config). */
export const DEFAULT_EVENT_CATEGORIES: readonly CatalogEntry[] = [
    { key: 'MUSIC', label: { es: 'música', en: 'music' } },
    { key: 'CULTURE', label: { es: 'cultura', en: 'culture' } },
    { key: 'SPORTS', label: { es: 'deportes', en: 'sports' } },
    { key: 'GASTRONOMY', label: { es: 'gastronomía', en: 'gastronomy' } },
    { key: 'FESTIVAL', label: { es: 'festival', en: 'festival' } },
    { key: 'NATURE', label: { es: 'naturaleza', en: 'nature' } },
    { key: 'THEATER', label: { es: 'teatro', en: 'theater' } },
    { key: 'WORKSHOP', label: { es: 'taller', en: 'workshop' } },
    { key: 'OTHER', label: { es: 'otros', en: 'other' } }
] as const;

/**
 * Sort phrase per encoded sort key (matches `SORT_OPTION_MAP` in the events
 * page). The key is the URL-friendly sort identifier; the value is the prose
 * describing it ("ordenados por ..."). Extending this requires keeping the
 * keys in sync with the page.
 */
export const SORT_KEY_PHRASES: Readonly<Record<string, Record<SummaryLocale, string>>> = {
    upcoming: { es: 'por fecha más próxima', en: 'by closest date' },
    farthest: { es: 'por última fecha primero', en: 'by latest date first' },
    newest: { es: 'por publicación más reciente', en: 'by most recently added' },
    oldest: { es: 'por publicación más antigua', en: 'by oldest first' },
    featured: { es: 'con los destacados primero', en: 'with featured first' },
    nameAsc: { es: 'por nombre, A a Z', en: 'by name, A to Z' },
    nameDesc: { es: 'por nombre, Z a A', en: 'by name, Z to A' },
    mostSaved: { es: 'por más guardados', en: 'by most saved' }
};

/**
 * Phrase dictionary for templated assembly. Keys are referenced by both the
 * builder and the individual descriptors.
 */
const PHRASES: Readonly<Record<SummaryLocale, Readonly<Record<string, string>>>> = {
    es: {
        showing: 'Mostrando',
        of: 'de',
        eventSingular: 'evento',
        eventPlural: 'eventos',
        noFiltersActive: 'sin filtros activos',
        sortedBy: 'ordenados',
        in: 'en',
        containing: 'que contienen',
        inNameOrDescription: 'en el nombre o la descripción',
        and: 'y',
        or: 'o',
        ofCategory: 'de',
        priceFrom: 'con precio desde',
        priceUpTo: 'con precio de hasta',
        priceBetween: 'con precio entre',
        onlyFree: 'gratuitos',
        excludingUnpriced: 'sin contar eventos sin precio definido',
        onlyFeatured: 'solo destacados',
        dateFrom: 'desde el',
        dateTo: 'hasta el',
        dateBetween: 'entre el',
        when_today: 'que ocurren hoy',
        when_week: 'durante esta semana',
        when_month: 'durante este mes',
        when_next60: 'en los próximos 60 días',
        when_past: 'ya finalizados',
        noResultsFound: 'No se encontraron'
    },
    en: {
        showing: 'Showing',
        of: 'of',
        eventSingular: 'event',
        eventPlural: 'events',
        noFiltersActive: 'no active filters',
        sortedBy: 'sorted',
        in: 'in',
        containing: 'containing',
        inNameOrDescription: 'in name or description',
        and: 'and',
        or: 'or',
        ofCategory: 'of',
        priceFrom: 'with price from',
        priceUpTo: 'with price up to',
        priceBetween: 'with price between',
        onlyFree: 'free',
        excludingUnpriced: 'excluding events without defined price',
        onlyFeatured: 'featured only',
        dateFrom: 'from',
        dateTo: 'up to',
        dateBetween: 'between',
        when_today: 'happening today',
        when_week: 'during this week',
        when_month: 'during this month',
        when_next60: 'in the next 60 days',
        when_past: 'already finished',
        noResultsFound: 'No results found for'
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
