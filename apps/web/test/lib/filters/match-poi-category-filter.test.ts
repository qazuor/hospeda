/**
 * @file match-poi-category-filter.test.ts
 * @description Unit tests for the HOS-147 shared thematic-filter predicate
 * (`matchesActivePoiCategories`) — OR / any-of semantics, multi-category
 * membership, and the empty-selection "show all" behavior (spec AC-3, AC-4,
 * AC-6, R-3).
 */
import { describe, expect, it } from 'vitest';
import { matchesActivePoiCategories } from '../../../src/lib/filters/match-poi-category-filter';

describe('matchesActivePoiCategories', () => {
    it('matches every POI when no category is selected (unfiltered)', () => {
        expect(
            matchesActivePoiCategories({
                poiCategorySlugs: ['termas', 'gastronomia'],
                activeCategorySlugs: []
            })
        ).toBe(true);
        // Even a POI with no categories is shown when the filter is inactive.
        expect(matchesActivePoiCategories({ poiCategorySlugs: [], activeCategorySlugs: [] })).toBe(
            true
        );
    });

    it('matches a POI whose (non-primary) category is the selected one', () => {
        // A POI primary=beach that also belongs to gastronomy must match a
        // "gastronomia" selection — the filter checks ALL categories, not just
        // the primary (spec AC-3).
        expect(
            matchesActivePoiCategories({
                poiCategorySlugs: ['playas', 'gastronomia'],
                activeCategorySlugs: ['gastronomia']
            })
        ).toBe(true);
    });

    it('applies OR semantics across multiple selected categories (union)', () => {
        // POI in "museos" is shown when the selection is beach OR museum.
        expect(
            matchesActivePoiCategories({
                poiCategorySlugs: ['museos'],
                activeCategorySlugs: ['playas', 'museos']
            })
        ).toBe(true);
    });

    it('excludes a POI that belongs to none of the selected categories', () => {
        expect(
            matchesActivePoiCategories({
                poiCategorySlugs: ['termas'],
                activeCategorySlugs: ['playas', 'museos']
            })
        ).toBe(false);
    });

    it('excludes a POI with no categories when a filter is active', () => {
        expect(
            matchesActivePoiCategories({
                poiCategorySlugs: [],
                activeCategorySlugs: ['playas']
            })
        ).toBe(false);
    });
});
