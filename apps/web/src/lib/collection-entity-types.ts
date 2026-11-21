/**
 * @file collection-entity-types.ts
 * @description Single source of the entity types a bookmark collection can hold,
 * shared by the collection detail page (`mi-cuenta/favoritos/colecciones/[id]`).
 * Keeps the filter-tab set, the URL path segments and the i18n keys in one place
 * so a new bookmarkable type cannot be missing from the page (HOS-2423).
 */

/** Entity types that can be filtered inside a collection, in tab order. */
export const COLLECTION_ENTITY_TYPES = [
    'ACCOMMODATION',
    'DESTINATION',
    'VENUE',
    'EXPERIENCE',
    'EVENT',
    'POST',
    'ATTRACTION'
] as const;

/** One of the entity types a collection can hold. */
export type CollectionEntityType = (typeof COLLECTION_ENTITY_TYPES)[number];

/** Label i18n key (`account.favorites.tabs.*`, shared with the favorites list) and Spanish fallback per type. */
export const COLLECTION_FILTER_LABELS: Readonly<
    Record<CollectionEntityType, { readonly key: string; readonly fallback: string }>
> = {
    ACCOMMODATION: { key: 'account.favorites.tabs.accommodation', fallback: 'Alojamientos' },
    DESTINATION: { key: 'account.favorites.tabs.destination', fallback: 'Destinos' },
    VENUE: { key: 'account.favorites.tabs.venue', fallback: 'Comer y salir' },
    EXPERIENCE: { key: 'account.favorites.tabs.experience', fallback: 'Experiencias' },
    EVENT: { key: 'account.favorites.tabs.event', fallback: 'Eventos' },
    POST: { key: 'account.favorites.tabs.post', fallback: 'Blog' },
    ATTRACTION: { key: 'account.favorites.tabs.attraction', fallback: 'Atracciones' }
};

/** Public URL path segment per type, used to link a bookmark to its entity. */
export const COLLECTION_ENTITY_PATH_SEGMENTS: Readonly<Record<CollectionEntityType, string>> = {
    ACCOMMODATION: 'alojamientos',
    DESTINATION: 'destinos',
    VENUE: 'comer-y-salir',
    EXPERIENCE: 'experiencias',
    EVENT: 'eventos',
    POST: 'publicaciones',
    ATTRACTION: 'atracciones'
};

/**
 * Type guard for a raw `entityType` query value.
 *
 * @param params - Object receiving the raw value (`null` when absent)
 * @returns `true` when the value is a supported collection entity type
 */
export function isCollectionEntityType({
    value
}: {
    readonly value: string | null;
}): value is CollectionEntityType {
    return (COLLECTION_ENTITY_TYPES as readonly string[]).includes(value ?? '');
}
