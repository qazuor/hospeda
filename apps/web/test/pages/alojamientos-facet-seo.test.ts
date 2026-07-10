/**
 * @file alojamientos-facet-seo.test.ts
 * @description HOS-96 T-017 — wires the shared `resolveFacetSeoDecision`
 * predicate into the accommodations base listing's `<head>` (robots meta +
 * canonical), replacing the inline `resolvePromotedFacetCanonical` call +
 * duplicated `.toLowerCase().replace(/_/g, '-')` slug transform with the
 * single shared predicate (which performs that same transform internally).
 *
 * `.astro` frontmatter cannot render in Vitest — assertions are source-based,
 * paired with logic tests that exercise `resolveFacetSeoDecision` with the
 * exact param shapes the page constructs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AccommodationTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FACET_CONFIG_BY_ID } from '../../src/lib/filters/facet-config';
import { resolveFacetSeoDecision } from '../../src/lib/seo/promoted-facet-canonical';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro'),
    'utf8'
);

describe('alojamientos/index.astro — facet SEO wiring (HOS-96 T-017)', () => {
    it('imports resolveFacetSeoDecision (the shared predicate), not the lower-level resolvePromotedFacetCanonical directly', () => {
        expect(src).toContain(
            "import { resolveFacetSeoDecision } from '@/lib/seo/promoted-facet-canonical'"
        );
        expect(src).not.toContain('resolvePromotedFacetCanonical');
    });

    it('computes typeActiveValues exactly once (hoisted, reused by fetch context/chips/SEO — no duplicate readFacetActiveValues call)', () => {
        const occurrences = src.match(/readFacetActiveValues\(\{/g) ?? [];
        expect(occurrences.length).toBe(1);
    });

    it('calls resolveFacetSeoDecision with typeActiveValues, hasOtherAccommodationFilters, AccommodationTypeEnum, and the accommodationType dedicatedLandingPattern', () => {
        expect(src).toMatch(/resolveFacetSeoDecision\(\{[^}]*facetValues:\s*typeActiveValues/);
        expect(src).toContain('hasOtherFilters: hasOtherAccommodationFilters');
        expect(src).toContain('validEnumValues: Object.values(AccommodationTypeEnum)');
        expect(src).toContain(
            'dedicatedLandingPattern: FACET_CONFIG_BY_ID.accommodationType.dedicatedLandingPattern'
        );
    });

    it('builds the dedicated-landing canonical from facetSeoDecision.canonical.kind, not a re-derived inline slug transform', () => {
        expect(src).toContain("facetSeoDecision.canonical.kind === 'dedicatedLanding'");
        // The duplicated inline transform this task removes (T-016 author flagged it).
        expect(src).not.toMatch(/singlePromotedType\.toLowerCase\(\)\.replace/);
    });

    it('passes facetSeoDecision.noindex to ListingLayout', () => {
        expect(src).toContain('noindex={facetSeoDecision.noindex}');
    });

    it('preserves the pagination-aware canonical (?page=N -> /page/N/) for the base case', () => {
        expect(src).toMatch(
            /const canonicalPath = page > 1 \? `\$\{canonicalBaseUrl\}page\/\$\{page\}\/` : canonicalBaseUrl;/
        );
    });
});

describe('accommodations facet SEO — composed resolveFacetSeoDecision behavior (HOS-96 T-017)', () => {
    const dedicatedLandingPattern = FACET_CONFIG_BY_ID.accommodationType.dedicatedLandingPattern;
    const validEnumValues = Object.values(AccommodationTypeEnum);

    it('0 active values -> indexable, base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: [],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('1 active value, no other filter -> indexable, dedicated-landing canonical /alojamientos/tipo/{slug}/', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['HOTEL'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision.noindex).toBe(false);
        expect(decision.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'hotel' });
    });

    it('2 active values -> noindex,follow + base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['HOTEL', 'CABIN'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });

    it('3+ active values behaves identically to 2', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['HOTEL', 'CABIN', 'HOUSE'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });
});
