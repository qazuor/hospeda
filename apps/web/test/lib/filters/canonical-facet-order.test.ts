/**
 * @file canonical-facet-order.test.ts
 * @description Regression tests for `canonicalizeFacetValues` — the single
 * ordering rule every multi-select facet CSV param is serialized through
 * (HOS-524).
 *
 * The bug this pins: while the CSV preserved click order, `?types=HOTEL,CABIN`
 * and `?types=CABIN,HOTEL` were two DIFFERENT URLs serving identical content,
 * so the reachable URL space was the set of PERMUTATIONS of the enum (~10^10
 * for 13 accommodation types) instead of its subsets (8.192). A crawler that
 * ignores `rel="nofollow"` walked that space at ~3 req/s against an origin
 * that cannot cache filtered listings.
 */

import { describe, expect, it } from 'vitest';
import { canonicalizeFacetValues } from '../../../src/lib/filters/canonical-facet-order';

describe('canonicalizeFacetValues', () => {
    it('collapses every permutation of the same selection onto ONE serialization (HOS-524)', () => {
        const permutations = [
            ['HOTEL', 'CABIN', 'APARTMENT'],
            ['CABIN', 'APARTMENT', 'HOTEL'],
            ['APARTMENT', 'HOTEL', 'CABIN'],
            ['HOTEL', 'APARTMENT', 'CABIN'],
            ['CABIN', 'HOTEL', 'APARTMENT'],
            ['APARTMENT', 'CABIN', 'HOTEL']
        ];
        const serialized = new Set(
            permutations.map((values) => canonicalizeFacetValues({ values }).join(','))
        );
        expect(serialized.size).toBe(1);
        expect([...serialized][0]).toBe('APARTMENT,CABIN,HOTEL');
    });

    it('de-duplicates repeated members', () => {
        expect(canonicalizeFacetValues({ values: ['HOTEL', 'HOTEL', 'CABIN'] })).toEqual([
            'CABIN',
            'HOTEL'
        ]);
    });

    it('is idempotent — canonicalizing an already-canonical list changes nothing', () => {
        const once = canonicalizeFacetValues({ values: ['ROOM', 'CABIN', 'HOTEL'] });
        expect(canonicalizeFacetValues({ values: once })).toEqual(once);
    });

    it('returns an empty array for an empty selection', () => {
        expect(canonicalizeFacetValues({ values: [] })).toEqual([]);
    });

    it('does not mutate the input array', () => {
        const input = ['HOTEL', 'CABIN'];
        canonicalizeFacetValues({ values: input });
        expect(input).toEqual(['HOTEL', 'CABIN']);
    });

    it('orders non-enum values (slugs, ids) deterministically too', () => {
        // POI category slugs and destination attraction UUIDs are not enums —
        // the same total order must still apply, or those facets keep emitting
        // permutations.
        expect(canonicalizeFacetValues({ values: ['playas', 'termas', 'gastronomia'] })).toEqual([
            'gastronomia',
            'playas',
            'termas'
        ]);
    });
});
