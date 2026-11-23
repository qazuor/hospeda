/**
 * @file collection-created-event.ts
 * @description Shared contract for the `hospeda:collection-created` broadcast
 * (HOS-999). Lives in a component-free module -- same pattern as
 * `POI_CATEGORY_FILTER_EVENT` (`@/lib/filters/poi-category-filter-event.ts`) --
 * so the favorites islands can all reference it without importing each
 * other's bundle.
 *
 * Dispatched by the two places a bookmark collection is created (HOS-2480):
 * the header «Crear colección» (`favorites/CreateCollectionAction`) and the
 * inline «+ Crear nueva colección» inside `MoveToCollectionModal`. Consumed by
 * `favorites/use-collections`, which re-reads the collections and the gate, so
 * the list, the usage line and every create entry point move together without
 * a page reload (a reload lost scroll position and the active tab, and killed
 * the success toast before it could render).
 */

/** `window` CustomEvent name dispatched when a bookmark collection is created. */
export const COLLECTION_CREATED_EVENT = 'hospeda:collection-created';

/** Payload of {@link COLLECTION_CREATED_EVENT}. */
export interface CollectionCreatedEventDetail {
    /** ID of the newly created collection. */
    readonly id: string;
    /** Name of the newly created collection. */
    readonly name: string;
}
