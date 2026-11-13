/**
 * @file amenity-catalog-browser.test.ts
 * @description Pure view logic of the accommodation catalog browser
 * (HOS-2123): category list building, cross-category search, the
 * active-category fallback and the selection total.
 */

import { describe, expect, it } from 'vitest';
import {
    buildCatalogBrowserCategories,
    type CatalogBrowserLabeler,
    countCatalogBrowserSelection,
    isCatalogBrowserSearching,
    resolveActiveCatalogCategory,
    searchCatalogBrowserCategories
} from '@/lib/amenity-catalog-browser';
import type { AmenityData } from '@/lib/api/types';
import type { CategoryGroup } from '@/lib/catalog-categories';

const WIFI: AmenityData = { id: 'a1', slug: 'wifi', category: 'CONNECTIVITY' };
const POOL: AmenityData = { id: 'a2', slug: 'pool', category: 'OUTDOORS' };
const GRILL: AmenityData = { id: 'a3', slug: 'grill', category: 'OUTDOORS' };
const RIVER: AmenityData = { id: 'f1', slug: 'river_front', category: 'LOCATION' };

const AMENITY_GROUPS: readonly CategoryGroup<AmenityData>[] = [
    { key: 'CONNECTIVITY', label: 'Conectividad', items: [WIFI] },
    { key: 'OUTDOORS', label: 'Exteriores', items: [POOL, GRILL] },
    { key: 'EMPTY', label: 'Vacía', items: [] }
];
const FEATURE_GROUPS: readonly CategoryGroup<AmenityData>[] = [
    { key: 'LOCATION', label: 'Ubicación', items: [RIVER] }
];

const LABELS: Readonly<Record<string, string>> = {
    wifi: 'Wifi',
    pool: 'Pileta climatizada',
    grill: 'Parrilla',
    river_front: 'Frente al río'
};
const getLabel: CatalogBrowserLabeler = (item) => LABELS[item.slug] ?? item.slug;

function build(
    selectedAmenities: readonly string[] = [],
    selectedFeatures: readonly string[] = []
) {
    return buildCatalogBrowserCategories({
        amenityGroups: AMENITY_GROUPS,
        featureGroups: FEATURE_GROUPS,
        selectedAmenityIds: new Set(selectedAmenities),
        selectedFeatureIds: new Set(selectedFeatures)
    });
}

describe('buildCatalogBrowserCategories', () => {
    it('lists amenity categories before feature categories, dropping empty ones', () => {
        expect(build().map((category) => category.id)).toEqual([
            'amenity:CONNECTIVITY',
            'amenity:OUTDOORS',
            'feature:LOCATION'
        ]);
    });

    it('counts selections per category against the matching catalog only', () => {
        // `a2` selected as a FEATURE id must not count for the amenity category.
        const categories = build(['a2', 'a3'], ['f1', 'a1']);

        expect(categories.map((category) => category.selectedCount)).toEqual([0, 2, 1]);
    });
});

describe('searchCatalogBrowserCategories', () => {
    it('returns the list unchanged for a blank query', () => {
        const categories = build();

        expect(searchCatalogBrowserCategories({ categories, query: '   ', getLabel })).toBe(
            categories
        );
        expect(isCatalogBrowserSearching({ query: '   ' })).toBe(false);
    });

    it('matches across categories, accent-insensitively, keeping only categories with hits', () => {
        const result = searchCatalogBrowserCategories({
            categories: build(),
            query: 'rio',
            getLabel
        });

        expect(result.map((category) => category.id)).toEqual(['feature:LOCATION']);
        expect(result[0]?.items).toEqual([RIVER]);
    });

    it('narrows a category to its matching items', () => {
        const result = searchCatalogBrowserCategories({
            categories: build(),
            query: 'pileta',
            getLabel
        });

        expect(result).toHaveLength(1);
        expect(result[0]?.items).toEqual([POOL]);
    });

    it('passes the category kind to the labeler', () => {
        const kinds: string[] = [];
        searchCatalogBrowserCategories({
            categories: build(),
            query: 'x',
            getLabel: (item, kind) => {
                kinds.push(kind);
                return item.slug;
            }
        });

        expect(new Set(kinds)).toEqual(new Set(['amenity', 'feature']));
    });
});

describe('resolveActiveCatalogCategory', () => {
    it('returns the requested category when it exists', () => {
        expect(
            resolveActiveCatalogCategory({ categories: build(), activeId: 'feature:LOCATION' })?.id
        ).toBe('feature:LOCATION');
    });

    it('falls back to the first category for an unknown or missing id', () => {
        expect(resolveActiveCatalogCategory({ categories: build(), activeId: 'nope' })?.id).toBe(
            'amenity:CONNECTIVITY'
        );
        expect(resolveActiveCatalogCategory({ categories: build(), activeId: null })?.id).toBe(
            'amenity:CONNECTIVITY'
        );
    });

    it('returns undefined for an empty catalog', () => {
        expect(resolveActiveCatalogCategory({ categories: [], activeId: null })).toBeUndefined();
    });
});

describe('countCatalogBrowserSelection', () => {
    it('sums the per-category counts, ignoring ids outside the catalogs', () => {
        expect(
            countCatalogBrowserSelection({ categories: build(['a1', 'a2', 'ghost'], ['f1']) })
        ).toBe(3);
    });
});
