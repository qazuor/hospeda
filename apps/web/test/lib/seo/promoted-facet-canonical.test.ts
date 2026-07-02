import { describe, expect, it } from 'vitest';
import { resolvePromotedFacetCanonical } from '../../../src/lib/seo/promoted-facet-canonical';

describe('resolvePromotedFacetCanonical (SPEC-306 OQ-3)', () => {
    it('resolves the single active facet value when no other filter is active', () => {
        const result = resolvePromotedFacetCanonical({
            facetValues: ['HOTEL'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE']
        });
        expect(result).toBe('HOTEL');
    });

    it('falls back to undefined when another filter is also active', () => {
        const result = resolvePromotedFacetCanonical({
            facetValues: ['HOTEL'],
            hasOtherFilters: true,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE']
        });
        expect(result).toBeUndefined();
    });

    it('falls back to undefined when no facet value is active', () => {
        const result = resolvePromotedFacetCanonical({
            facetValues: [],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE']
        });
        expect(result).toBeUndefined();
    });

    it('falls back to undefined when more than one facet value is active (a union, not one landing)', () => {
        const result = resolvePromotedFacetCanonical({
            facetValues: ['HOTEL', 'CABIN'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE']
        });
        expect(result).toBeUndefined();
    });

    it('falls back to undefined for a value outside the enum, avoiding a link to a 404', () => {
        const result = resolvePromotedFacetCanonical({
            facetValues: ['BOGUS'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE']
        });
        expect(result).toBeUndefined();
    });
});
