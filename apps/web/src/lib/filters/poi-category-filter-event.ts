/**
 * @file poi-category-filter-event.ts
 * @description Shared contract for the client-side thematic POI filter (HOS-147)
 * broadcast. Lives in a component-free module so the filter chip island and the
 * map island can both reference it without importing each other's bundle.
 */

/** `window` CustomEvent name dispatched when the active POI category selection changes. */
export const POI_CATEGORY_FILTER_EVENT = 'hospeda:poi-category-filter';

/** Payload of {@link POI_CATEGORY_FILTER_EVENT}. */
export interface PoiCategoryFilterEventDetail {
    /** The currently active category slugs (empty = no filter). */
    readonly categories: string[];
}
