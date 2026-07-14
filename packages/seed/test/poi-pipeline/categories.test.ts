import { describe, expect, it } from 'vitest';
import {
    loadRealCategorySlugs,
    normalizeCategories
} from '../../scripts/poi-pipeline/categories.js';

describe('loadRealCategorySlugs (real HOS-139 fixtures)', () => {
    it('loads the 40 seeded poi_category slugs', () => {
        const slugs = loadRealCategorySlugs();
        expect(slugs.size).toBe(40);
        expect(slugs.has('historic_site')).toBe(true);
        expect(slugs.has('square')).toBe(true);
        expect(slugs.has('natural_area')).toBe(true);
    });
});

describe('normalizeCategories', () => {
    const realSlugs = new Set(['square', 'historic_site', 'park', 'museum']);

    it('lowercases, preserves order, and marks the first as primary', () => {
        // Act
        const result = normalizeCategories({
            raw: 'SQUARE; HISTORIC_SITE; PARK',
            realSlugs,
            rowId: 'cdu__plaza'
        });

        // Assert
        expect(result).toEqual([
            { slug: 'square', isPrimary: true },
            { slug: 'historic_site', isPrimary: false },
            { slug: 'park', isPrimary: false }
        ]);
    });

    it('keeps multiplicity (a single category is just one primary)', () => {
        const result = normalizeCategories({ raw: 'MUSEUM', realSlugs, rowId: 'x' });
        expect(result).toEqual([{ slug: 'museum', isPrimary: true }]);
    });

    it('throws on a category that is not in the seeded catalog', () => {
        expect(() =>
            normalizeCategories({ raw: 'SQUARE; BOGUS_CAT', realSlugs, rowId: 'cdu__plaza' })
        ).toThrow(/not in the seeded catalog: bogus_cat/);
    });

    it('throws on an empty categorySlugs cell', () => {
        expect(() => normalizeCategories({ raw: '', realSlugs, rowId: 'cdu__plaza' })).toThrow(
            /no categorySlugs/
        );
    });
});
