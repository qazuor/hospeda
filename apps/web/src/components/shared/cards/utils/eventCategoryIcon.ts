/**
 * @file eventCategoryIcon.ts
 * @description Maps event category slugs to their corresponding icon component
 * names from `@repo/icons`. Used across EventCardFeatured and EventCardHorizontal
 * to avoid duplicating the switch/if-chains in each card component.
 *
 * The map is keyed by the normalised lowercase category slug. Aliases (e.g.
 * "culture" → "cultural") are included so callers do not need to normalise
 * before looking up.
 */

/**
 * Union of icon component names available for event categories.
 * All names match named exports from `@repo/icons`.
 */
export type EventCategoryIconName =
    | 'BallroomIcon'
    | 'SportsCenterIcon'
    | 'CulturalCenterIcon'
    | 'RestaurantIcon'
    | 'FestivalPlazaIcon'
    | 'WellnessCenterIcon'
    | 'MuseumIcon'
    | 'UsersIcon'
    | 'NatureReserveIcon'
    | 'AmphitheaterIcon'
    | 'WorkshopSpaceIcon'
    | 'BooksAndMagazinesIcon'
    | 'EventIcon';

/**
 * Mapping from normalised (lowercase) category slug to icon name.
 * Spanish-language aliases are included for backward compatibility.
 *
 * @example
 * ```ts
 * import { EVENT_CATEGORY_ICON_MAP } from './eventCategoryIcon';
 * const name = EVENT_CATEGORY_ICON_MAP[category.toLowerCase()] ?? 'EventIcon';
 * ```
 */
export const EVENT_CATEGORY_ICON_MAP: Readonly<Record<string, EventCategoryIconName>> = {
    music: 'BallroomIcon',
    musica: 'BallroomIcon',
    sports: 'SportsCenterIcon',
    deporte: 'SportsCenterIcon',
    cultural: 'CulturalCenterIcon',
    culture: 'CulturalCenterIcon',
    cultura: 'CulturalCenterIcon',
    gastronomy: 'RestaurantIcon',
    gastronomia: 'RestaurantIcon',
    festival: 'FestivalPlazaIcon',
    wellness: 'WellnessCenterIcon',
    bienestar: 'WellnessCenterIcon',
    art: 'MuseumIcon',
    arte: 'MuseumIcon',
    family: 'UsersIcon',
    familia: 'UsersIcon',
    nature: 'NatureReserveIcon',
    naturaleza: 'NatureReserveIcon',
    theater: 'AmphitheaterIcon',
    teatro: 'AmphitheaterIcon',
    workshop: 'WorkshopSpaceIcon',
    taller: 'WorkshopSpaceIcon',
    education: 'BooksAndMagazinesIcon',
    educacion: 'BooksAndMagazinesIcon'
} as const;

/**
 * Returns the icon name for the given event category.
 * Falls back to `'EventIcon'` for unknown categories.
 *
 * @param category - Raw category string (case-insensitive).
 * @returns An {@link EventCategoryIconName} to render.
 *
 * @example
 * ```ts
 * getEventCategoryIconName('MUSIC')  // 'BallroomIcon'
 * getEventCategoryIconName('other')  // 'EventIcon'
 * ```
 */
export function getEventCategoryIconName(category: string): EventCategoryIconName {
    return EVENT_CATEGORY_ICON_MAP[category.toLowerCase()] ?? 'EventIcon';
}

/**
 * Localised display label map for event categories.
 * Keys are lowercase API category slugs (with aliases).
 *
 * @example
 * ```ts
 * import { EVENT_CATEGORY_LABELS, getEventCategoryLabel } from './eventCategoryIcon';
 * const label = getEventCategoryLabel('music', 'es'); // 'Música'
 * ```
 */
export const EVENT_CATEGORY_LABELS: Readonly<
    Record<string, Readonly<Record<'es' | 'en' | 'pt', string>>>
> = {
    music: { es: 'Música', en: 'Music', pt: 'Música' },
    musica: { es: 'Música', en: 'Music', pt: 'Música' },
    sports: { es: 'Deportes', en: 'Sports', pt: 'Esportes' },
    deporte: { es: 'Deportes', en: 'Sports', pt: 'Esportes' },
    cultural: { es: 'Cultural', en: 'Cultural', pt: 'Cultural' },
    culture: { es: 'Cultural', en: 'Cultural', pt: 'Cultural' },
    cultura: { es: 'Cultural', en: 'Cultural', pt: 'Cultural' },
    gastronomy: { es: 'Gastronomía', en: 'Gastronomy', pt: 'Gastronomia' },
    gastronomia: { es: 'Gastronomía', en: 'Gastronomy', pt: 'Gastronomia' },
    festival: { es: 'Festival', en: 'Festival', pt: 'Festival' },
    wellness: { es: 'Bienestar', en: 'Wellness', pt: 'Bem-estar' },
    bienestar: { es: 'Bienestar', en: 'Wellness', pt: 'Bem-estar' },
    art: { es: 'Arte', en: 'Art', pt: 'Arte' },
    arte: { es: 'Arte', en: 'Art', pt: 'Arte' },
    family: { es: 'Familia', en: 'Family', pt: 'Família' },
    familia: { es: 'Familia', en: 'Family', pt: 'Família' },
    nature: { es: 'Naturaleza', en: 'Nature', pt: 'Natureza' },
    naturaleza: { es: 'Naturaleza', en: 'Nature', pt: 'Natureza' },
    theater: { es: 'Teatro', en: 'Theater', pt: 'Teatro' },
    teatro: { es: 'Teatro', en: 'Theater', pt: 'Teatro' },
    workshop: { es: 'Taller', en: 'Workshop', pt: 'Oficina' },
    taller: { es: 'Taller', en: 'Workshop', pt: 'Oficina' },
    education: { es: 'Educación', en: 'Education', pt: 'Educação' },
    educacion: { es: 'Educación', en: 'Education', pt: 'Educação' },
    other: { es: 'Evento', en: 'Event', pt: 'Evento' }
} as const;

/**
 * Returns the localised display label for a given event category.
 * Falls back to a capitalised version of the raw category string when no
 * mapping is found.
 *
 * @param category - Raw category string (case-insensitive).
 * @param locale - Active locale (`'es'` | `'en'` | `'pt'`).
 * @returns Human-readable label in the requested locale.
 *
 * @example
 * ```ts
 * getEventCategoryLabel('gastronomy', 'es') // 'Gastronomía'
 * getEventCategoryLabel('MUSIC', 'en')       // 'Music'
 * getEventCategoryLabel('unknown', 'pt')     // 'Unknown'
 * ```
 */
export function getEventCategoryLabel(category: string, locale: 'es' | 'en' | 'pt'): string {
    const labels = EVENT_CATEGORY_LABELS[category.toLowerCase()];
    if (labels) return labels[locale];
    const lower = category.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}
