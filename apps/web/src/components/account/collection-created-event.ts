/**
 * @file collection-created-event.ts
 * @description Shared contract for the `hospeda:collection-created` broadcast
 * (HOS-999). Lives in a component-free module -- same pattern as
 * `POI_CATEGORY_FILTER_EVENT` (`@/lib/filters/poi-category-filter-event.ts`) --
 * so `CreateCollectionCTA`, `MoveToCollectionModal`, `CollectionUsageMeter` and
 * `UserFavoritesList` can all reference it without importing each other's bundle.
 *
 * Dispatched by the two places a bookmark collection is created: the header
 * "+ Crear colección" CTA (`CreateCollectionCTA.handleSaved`) and the inline
 * "+ Crear nueva colección" trigger inside `MoveToCollectionModal`
 * (`handleCreateModalSaved`). Consumed by `CollectionUsageMeter` (refreshes the
 * "X / max" counter) and `UserFavoritesList` (refetches the "Mis colecciones"
 * section) so both reflect the new collection without a full page reload --
 * the previous `window.location.reload()` lost scroll position and the active
 * tab, and killed the success toast before it could render.
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
