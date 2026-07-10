/**
 * @file eventos-facet-seo.test.ts
 * @description HOS-96 T-018 — wires the shared `resolveFacetSeoDecision`
 * predicate into the events base listing's `<head>` (robots meta +
 * canonical). Owner decision: events KEEPS its dedicated
 * `/eventos/categoria/{slug}/` landing (SPEC-306) as the 1-value canonical —
 * `facet-config.ts`'s `eventCategory.dedicatedLandingPattern` was corrected
 * from `undefined` to that pattern as part of this task. Replaces the
 * pre-existing inline `resolvePromotedFacetCanonical` call (which — a latent
 * gap predating this task — used the SINGULAR `category` value, not the
 * plural `activeCategories` array) with the shared predicate driven by
 * `activeCategories`.
 *
 * `.astro` frontmatter cannot render in Vitest — assertions are source-based,
 * paired with logic tests that exercise `resolveFacetSeoDecision` with the
 * exact param shapes the page constructs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FACET_CONFIG_BY_ID } from '../../src/lib/filters/facet-config';
import { resolveFacetSeoDecision } from '../../src/lib/seo/promoted-facet-canonical';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/eventos/index.astro'), 'utf8');

describe('eventos/index.astro — facet SEO wiring (HOS-96 T-018)', () => {
    it('imports resolveFacetSeoDecision (the shared predicate), not the lower-level resolvePromotedFacetCanonical directly', () => {
        expect(src).toContain(
            "import { resolveFacetSeoDecision } from '@/lib/seo/promoted-facet-canonical'"
        );
        expect(src).not.toContain('resolvePromotedFacetCanonical');
    });

    it('reads activeCategories exactly once (hoisted, reused by fetch/chips/SEO)', () => {
        const occurrences = src.match(/readFacetActiveValues\(\{/g) ?? [];
        expect(occurrences.length).toBe(1);
    });

    it('calls resolveFacetSeoDecision with activeCategories (the plural array, NOT the singular category), hasOtherEventFilters, EventCategoryEnum, and the eventCategory dedicatedLandingPattern', () => {
        expect(src).toMatch(/resolveFacetSeoDecision\(\{[^}]*facetValues:\s*activeCategories/);
        expect(src).toContain('hasOtherFilters: hasOtherEventFilters');
        expect(src).toContain('validEnumValues: Object.values(EventCategoryEnum)');
        expect(src).toContain(
            'dedicatedLandingPattern: FACET_CONFIG_BY_ID.eventCategory.dedicatedLandingPattern'
        );
        // The old, buggy single-value-only call is gone.
        expect(src).not.toMatch(/facetValues:\s*category\s*\?\s*\[category\]\s*:\s*\[\]/);
    });

    it('builds the dedicated-landing canonical from facetSeoDecision.canonical.kind, not a re-derived inline slug transform', () => {
        expect(src).toContain("facetSeoDecision.canonical.kind === 'dedicatedLanding'");
        expect(src).not.toMatch(/singlePromotedCategory\.toLowerCase\(\)\.replace/);
        // The superseded inline block is fully removed, not left dangling.
        expect(src).not.toContain('const singlePromotedCategory');
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

describe('events facet SEO — composed resolveFacetSeoDecision behavior (HOS-96 T-018)', () => {
    const dedicatedLandingPattern = FACET_CONFIG_BY_ID.eventCategory.dedicatedLandingPattern;
    const validEnumValues = Object.values(EventCategoryEnum);

    it('0 active values -> indexable, base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: [],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('1 active value, no other filter -> indexable, dedicated-landing canonical /eventos/categoria/{slug}/ (SPEC-306 preserved)', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['MUSIC'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision.noindex).toBe(false);
        expect(decision.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'music' });
    });

    it('2 active values -> noindex,follow + base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['MUSIC', 'CULTURE'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });

    it('3+ active values behaves identically to 2', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['MUSIC', 'CULTURE', 'SPORTS'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });
});

describe('events dedicated landing slug match — every EventCategoryEnum member (HOS-96 T-018 critical verification)', () => {
    /**
     * Mirrors `eventos/categoria/[category]/index.astro`'s own
     * `VALID_CATEGORIES` slug->enum dictionary EXACTLY (hand-verified against
     * the route source, not re-derived) so this test fails loudly if the
     * route's dictionary and the predicate's generic transform ever diverge.
     */
    const ROUTE_VALID_CATEGORIES: Record<string, string> = {
        music: 'MUSIC',
        culture: 'CULTURE',
        sports: 'SPORTS',
        gastronomy: 'GASTRONOMY',
        festival: 'FESTIVAL',
        nature: 'NATURE',
        theater: 'THEATER',
        workshop: 'WORKSHOP',
        other: 'OTHER'
    };

    it("every EventCategoryEnum member's predicate-generated slug resolves back to the SAME enum value via the route's own dictionary", () => {
        for (const value of Object.values(EventCategoryEnum)) {
            const decision = resolveFacetSeoDecision({
                facetValues: [value],
                hasOtherFilters: false,
                validEnumValues: Object.values(EventCategoryEnum),
                dedicatedLandingPattern: FACET_CONFIG_BY_ID.eventCategory.dedicatedLandingPattern
            });
            if (decision.canonical.kind !== 'dedicatedLanding') {
                throw new Error(`Expected a dedicatedLanding decision for ${value}`);
            }
            const slug = decision.canonical.slug;
            expect(ROUTE_VALID_CATEGORIES[slug]).toBe(value);
        }
    });

    it('the route dictionary and EventCategoryEnum have the same cardinality (no member silently unmapped)', () => {
        expect(Object.keys(ROUTE_VALID_CATEGORIES)).toHaveLength(
            Object.values(EventCategoryEnum).length
        );
    });
});
