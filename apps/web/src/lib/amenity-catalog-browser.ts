/**
 * @file amenity-catalog-browser.ts
 * @description Pure view logic of the accommodation editor's catalog browser
 * (HOS-2123, owner-chosen mockup variant B): one flat list of categories —
 * amenity categories first, then feature categories — each carrying its own
 * selected count, and a search that filters across every category at once.
 *
 * Kept out of the component, like `catalog-picker.ts` for the shared picker,
 * so category building, search and the active-category fallback are
 * unit-tested without rendering anything. Grouping and matching are NOT
 * re-implemented here: the categories come from `catalog-categories.ts` and
 * the search uses `matchesCatalogQuery`, so the browser and the shared picker
 * group and search identically.
 *
 * @module lib/amenity-catalog-browser
 */

import type { AmenityData } from '@/lib/api/types';
import type { CategoryGroup } from '@/lib/catalog-categories';
import { matchesCatalogQuery, normalizeCatalogSearchText } from '@/lib/catalog-picker';

/** Which catalog a category belongs to. */
export type CatalogBrowserKind = 'amenity' | 'feature';

/** One category of the browser's category list. */
export interface CatalogBrowserCategory {
    /** Unique across both catalogs: `<kind>:<group key>`. */
    readonly id: string;
    readonly kind: CatalogBrowserKind;
    /** Localized category label. */
    readonly label: string;
    /** Items of the category (all of them, or only the matches while searching). */
    readonly items: readonly AmenityData[];
    /** How many of the category's items are selected. */
    readonly selectedCount: number;
}

/** Resolves the localized label of an item of the given catalog. */
export type CatalogBrowserLabeler = (item: AmenityData, kind: CatalogBrowserKind) => string;

/**
 * Turns the amenity and feature category groups into the browser's single
 * category list, amenity categories first.
 *
 * @param params.amenityGroups - Amenity categories, in display order
 * @param params.featureGroups - Feature categories, in display order
 * @param params.selectedAmenityIds - Selected amenity ids
 * @param params.selectedFeatureIds - Selected feature ids
 * @returns The ordered category list; empty groups are dropped
 */
export function buildCatalogBrowserCategories({
    amenityGroups,
    featureGroups,
    selectedAmenityIds,
    selectedFeatureIds
}: {
    readonly amenityGroups: readonly CategoryGroup<AmenityData>[];
    readonly featureGroups: readonly CategoryGroup<AmenityData>[];
    readonly selectedAmenityIds: ReadonlySet<string>;
    readonly selectedFeatureIds: ReadonlySet<string>;
}): readonly CatalogBrowserCategory[] {
    const toCategories = (
        groups: readonly CategoryGroup<AmenityData>[],
        kind: CatalogBrowserKind,
        selected: ReadonlySet<string>
    ): readonly CatalogBrowserCategory[] =>
        groups
            .filter((group) => group.items.length > 0)
            .map((group) => ({
                id: `${kind}:${group.key}`,
                kind,
                label: group.label,
                items: group.items,
                selectedCount: group.items.filter((item) => selected.has(item.id)).length
            }));

    return [
        ...toCategories(amenityGroups, 'amenity', selectedAmenityIds),
        ...toCategories(featureGroups, 'feature', selectedFeatureIds)
    ];
}

/**
 * Whether a query is active (non-blank once normalized).
 *
 * @param params.query - Raw query typed by the owner
 * @returns `true` when the browser should show search results
 */
export function isCatalogBrowserSearching({ query }: { readonly query: string }): boolean {
    return normalizeCatalogSearchText({ text: query }).length > 0;
}

/**
 * Filters every category down to the items matching the query, dropping the
 * categories left empty. A blank query returns the list unchanged.
 *
 * @param params.categories - The full category list
 * @param params.query - Raw query typed by the owner
 * @param params.getLabel - Localized label resolver
 * @returns The categories holding at least one match, items narrowed to matches
 */
export function searchCatalogBrowserCategories({
    categories,
    query,
    getLabel
}: {
    readonly categories: readonly CatalogBrowserCategory[];
    readonly query: string;
    readonly getLabel: CatalogBrowserLabeler;
}): readonly CatalogBrowserCategory[] {
    if (!isCatalogBrowserSearching({ query })) return categories;

    return categories
        .map((category) => ({
            ...category,
            items: category.items.filter((item) =>
                matchesCatalogQuery({
                    item,
                    query,
                    getLabel: (candidate) => getLabel(candidate, category.kind)
                })
            )
        }))
        .filter((category) => category.items.length > 0);
}

/**
 * Resolves which category the panel shows: the requested one when it still
 * exists, otherwise the first category.
 *
 * @param params.categories - The full category list
 * @param params.activeId - The category the owner picked, if any
 * @returns The category to show, or `undefined` for an empty catalog
 */
export function resolveActiveCatalogCategory({
    categories,
    activeId
}: {
    readonly categories: readonly CatalogBrowserCategory[];
    readonly activeId: string | null;
}): CatalogBrowserCategory | undefined {
    return categories.find((category) => category.id === activeId) ?? categories[0];
}

/**
 * Total selected items across every category. Counts only items present in
 * the catalogs, so an id the vertical no longer offers does not inflate it.
 *
 * @param params.categories - The full category list
 * @returns The sum of every category's selected count
 */
export function countCatalogBrowserSelection({
    categories
}: {
    readonly categories: readonly CatalogBrowserCategory[];
}): number {
    return categories.reduce((total, category) => total + category.selectedCount, 0);
}
