/**
 * @file facet-seo-decision.test.ts
 * @description Unit tests for `resolveFacetSeoDecision` (HOS-96 T-016) — the
 * ONE shared predicate every affected listing (`alojamientos/`, `eventos/`,
 * `publicaciones/`) must consume to decide `noindex`/canonical for a
 * multi-select facet's active values, per spec US-6/US-7/OQ-1:
 *
 * - 0 values (or another filter active) -> indexable, base-listing canonical.
 * - exactly 1 value, valid enum, no other filter -> indexable; canonical is
 *   the facet's dedicated landing when it has one, else base listing.
 * - 2+ values -> `noindex,follow` + base-listing canonical (no facet params).
 */

import { describe, expect, it } from 'vitest';
import { FACET_CONFIG_BY_ID } from '../../../src/lib/filters/facet-config';
import { resolveFacetSeoDecision } from '../../../src/lib/seo/promoted-facet-canonical';

describe('resolveFacetSeoDecision (HOS-96 US-6/US-7/OQ-1)', () => {
    it('is indexable with the base-listing canonical when no facet value is active', () => {
        const result = resolveFacetSeoDecision({
            facetValues: [],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE'],
            dedicatedLandingPattern: '/alojamientos/tipo/{slug}/'
        });

        expect(result).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('resolves the dedicated-landing canonical (slug derived from the value) for exactly one value on a facet with a landing', () => {
        const result = resolveFacetSeoDecision({
            facetValues: ['COUNTRY_HOUSE'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'COUNTRY_HOUSE'],
            dedicatedLandingPattern: '/alojamientos/tipo/{slug}/'
        });

        expect(result).toEqual({
            noindex: false,
            canonical: { kind: 'dedicatedLanding', slug: 'country-house' }
        });
    });

    it('falls back to the base-listing canonical for exactly one value on a facet WITHOUT a dedicated landing (generic case — e.g. a future facet declared with no landing; every current facet HAS one as of HOS-96 T-017/18/19)', () => {
        const result = resolveFacetSeoDecision({
            facetValues: ['MUSIC'],
            hasOtherFilters: false,
            validEnumValues: ['MUSIC', 'SPORTS'],
            dedicatedLandingPattern: undefined
        });

        expect(result).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('emits noindex + base-listing canonical for exactly two active values', () => {
        const result = resolveFacetSeoDecision({
            facetValues: ['HOTEL', 'CABIN'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE'],
            dedicatedLandingPattern: '/alojamientos/tipo/{slug}/'
        });

        expect(result).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });

    it('behaves identically for three or more active values — not a special 3-case', () => {
        const result = resolveFacetSeoDecision({
            facetValues: ['HOTEL', 'CABIN', 'HOUSE'],
            hasOtherFilters: false,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE'],
            dedicatedLandingPattern: '/alojamientos/tipo/{slug}/'
        });

        expect(result).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });

    it('does not treat a single value as promotable when another filter is also active', () => {
        const result = resolveFacetSeoDecision({
            facetValues: ['HOTEL'],
            hasOtherFilters: true,
            validEnumValues: ['HOTEL', 'CABIN', 'HOUSE'],
            dedicatedLandingPattern: '/alojamientos/tipo/{slug}/'
        });

        expect(result).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('is the single shared predicate: the same imported function decides the accommodation-type, event-category, AND post-category facets straight from FACET_CONFIG_BY_ID (HOS-96 T-017/18/19: all three now have a dedicated landing — the owner decision that events KEEPS its SPEC-306 landing means there is no more "one facet has none" contrast among the three)', () => {
        const accommodationConfig = FACET_CONFIG_BY_ID.accommodationType;
        const eventConfig = FACET_CONFIG_BY_ID.eventCategory;
        const postConfig = FACET_CONFIG_BY_ID.postCategory;

        // No per-facet copy of resolveFacetSeoDecision exists — all three calls
        // below go through the identical imported symbol.
        const accommodationResult = resolveFacetSeoDecision({
            facetValues: ['HOTEL'],
            hasOtherFilters: false,
            validEnumValues: Object.values(accommodationConfig.enum ?? {}),
            dedicatedLandingPattern: accommodationConfig.dedicatedLandingPattern
        });
        const eventResult = resolveFacetSeoDecision({
            facetValues: ['MUSIC'],
            hasOtherFilters: false,
            validEnumValues: Object.values(eventConfig.enum ?? {}),
            dedicatedLandingPattern: eventConfig.dedicatedLandingPattern
        });
        const postResult = resolveFacetSeoDecision({
            facetValues: ['CULTURE'],
            hasOtherFilters: false,
            validEnumValues: Object.values(postConfig.enum ?? {}),
            dedicatedLandingPattern: postConfig.dedicatedLandingPattern
        });

        expect(accommodationConfig.dedicatedLandingPattern).toBe('/alojamientos/tipo/{slug}/');
        expect(eventConfig.dedicatedLandingPattern).toBe('/eventos/categoria/{slug}/');
        expect(postConfig.dedicatedLandingPattern).toBe('/publicaciones/categoria/{slug}/');
        expect(accommodationResult.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'hotel' });
        expect(eventResult.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'music' });
        expect(postResult.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'culture' });
    });
});
