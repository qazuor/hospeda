/**
 * @file publicaciones-facet-seo.test.ts
 * @description HOS-96 T-019 — NET-NEW wiring of the shared
 * `resolveFacetSeoDecision` predicate into the blog base listing's `<head>`
 * (robots meta + canonical). Unlike accommodations/events, this page called
 * NEITHER `resolvePromotedFacetCanonical` NOR emitted any `noindex` before
 * this task — there was no canonical/noindex logic at all beyond
 * `ListingLayout`'s plain `canonicalPath = baseUrl` default. `hasOtherPostFilters`
 * is new, mirroring the accommodations/events `hasOther*Filters` pattern
 * (search/destination/date/featured, excluding the facet itself, sort, and
 * page).
 *
 * `.astro` frontmatter cannot render in Vitest — assertions are source-based,
 * paired with logic tests that exercise `resolveFacetSeoDecision` with the
 * exact param shapes the page constructs.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FACET_CONFIG_BY_ID } from '../../src/lib/filters/facet-config';
import { readFacetActiveValues } from '../../src/lib/filters/read-facet-active-values';
import { resolvePostCategorySlug } from '../../src/lib/post-category';
import { resolveFacetSeoDecision } from '../../src/lib/seo/promoted-facet-canonical';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/index.astro'),
    'utf8'
);

describe('publicaciones/index.astro — facet SEO wiring, NET-NEW (HOS-96 T-019)', () => {
    it('imports resolveFacetSeoDecision and PostCategoryEnum', () => {
        expect(src).toContain(
            "import { resolveFacetSeoDecision } from '@/lib/seo/promoted-facet-canonical'"
        );
        expect(src).toContain('PostCategoryEnum');
    });

    it('reads postCategoryActiveValues exactly once (already hoisted by T-012, reused here)', () => {
        const occurrences = src.match(/readFacetActiveValues\(\{/g) ?? [];
        expect(occurrences.length).toBe(1);
    });

    it('declares a hasOtherPostFilters boolean mirroring the accommodations/events hasOther*Filters pattern (excludes the facet itself, sort, and page)', () => {
        expect(src).toContain('const hasOtherPostFilters = Boolean(');
    });

    it('calls resolveFacetSeoDecision with postCategoryActiveValues, hasOtherPostFilters, PostCategoryEnum, and the postCategory dedicatedLandingPattern', () => {
        expect(src).toMatch(
            /resolveFacetSeoDecision\(\{[^}]*facetValues:\s*postCategoryActiveValues/
        );
        expect(src).toContain('hasOtherFilters: hasOtherPostFilters');
        expect(src).toContain('validEnumValues: Object.values(PostCategoryEnum)');
        expect(src).toContain(
            'dedicatedLandingPattern: FACET_CONFIG_BY_ID.postCategory.dedicatedLandingPattern'
        );
    });

    it('builds the dedicated-landing canonical from facetSeoDecision.canonical.kind', () => {
        expect(src).toContain("facetSeoDecision.canonical.kind === 'dedicatedLanding'");
    });

    it('passes facetSeoDecision.noindex to ListingLayout', () => {
        expect(src).toContain('noindex={facetSeoDecision.noindex}');
    });

    it('preserves the pagination-aware canonical (?page=N -> /page/N/) using the NEW canonicalBaseUrl (not the plain baseUrl it used before this task)', () => {
        expect(src).toMatch(
            /const canonicalPath = page > 1 \? `\$\{canonicalBaseUrl\}page\/\$\{page\}\/` : canonicalBaseUrl;/
        );
    });

    it('postCategoryActiveValues is computed with the legacy singular fallback (HOS-96 pre-merge review, Option A)', () => {
        const activeValuesBlock = src.slice(
            src.indexOf('const postCategoryActiveValues = readFacetActiveValues({'),
            src.indexOf('const postCategoryActiveValues = readFacetActiveValues({') + 250
        );
        expect(activeValuesBlock).toContain(
            'singularParamKey: FACET_CONFIG_BY_ID.postCategory.singularParamKey'
        );
    });
});

describe('blog facet SEO — composed resolveFacetSeoDecision behavior (HOS-96 T-019)', () => {
    const dedicatedLandingPattern = FACET_CONFIG_BY_ID.postCategory.dedicatedLandingPattern;
    const validEnumValues = Object.values(PostCategoryEnum);

    it('0 active values -> indexable, base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: [],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: false, canonical: { kind: 'base' } });
    });

    it('1 active value, no other filter -> indexable, dedicated-landing canonical /publicaciones/categoria/{slug}/', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['CULTURE'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision.noindex).toBe(false);
        expect(decision.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'culture' });
    });

    it('2 active values -> noindex,follow + base canonical', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['CULTURE', 'GASTRONOMY'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });

    it('3+ active values behaves identically to 2', () => {
        const decision = resolveFacetSeoDecision({
            facetValues: ['CULTURE', 'GASTRONOMY', 'NATURE'],
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });
});

describe('blog facet SEO — legacy singular-only URL regression (HOS-96 pre-merge review, Option A)', () => {
    const dedicatedLandingPattern = FACET_CONFIG_BY_ID.postCategory.dedicatedLandingPattern;
    const validEnumValues = Object.values(PostCategoryEnum);

    it('?category=CULTURE (singular-only, no ?categories=) resolves the dedicated-landing canonical /publicaciones/categoria/culture/', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('category=CULTURE'),
            paramKey: FACET_CONFIG_BY_ID.postCategory.paramKey,
            singularParamKey: FACET_CONFIG_BY_ID.postCategory.singularParamKey
        });
        const decision = resolveFacetSeoDecision({
            facetValues: activeValues,
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision.noindex).toBe(false);
        expect(decision.canonical).toEqual({ kind: 'dedicatedLanding', slug: 'culture' });
    });

    it('?categories=CULTURE,GASTRONOMY (plural, 2 values) still correctly resolves noindex+base', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('categories=CULTURE,GASTRONOMY'),
            paramKey: FACET_CONFIG_BY_ID.postCategory.paramKey,
            singularParamKey: FACET_CONFIG_BY_ID.postCategory.singularParamKey
        });
        const decision = resolveFacetSeoDecision({
            facetValues: activeValues,
            hasOtherFilters: false,
            validEnumValues,
            dedicatedLandingPattern
        });
        expect(decision).toEqual({ noindex: true, canonical: { kind: 'base' } });
    });
});

describe('blog chip active state — legacy singular-only URL (HOS-96 pre-merge review, chip-active regression)', () => {
    it('?category=CULTURE (singular-only) resolves CULTURE as active via the fallback, ready to drive aria-pressed="true"', () => {
        const activeValues = readFacetActiveValues({
            searchParams: new URLSearchParams('category=CULTURE'),
            paramKey: FACET_CONFIG_BY_ID.postCategory.paramKey,
            singularParamKey: FACET_CONFIG_BY_ID.postCategory.singularParamKey
        });
        expect(activeValues.includes('CULTURE')).toBe(true);
        expect(activeValues.includes('GASTRONOMY')).toBe(false);
    });
});

describe('blog dedicated landing slug match — every PostCategoryEnum member (HOS-96 T-019 critical verification)', () => {
    it("every PostCategoryEnum member's predicate-generated slug resolves back to the SAME enum value via the route's own resolvePostCategorySlug", () => {
        for (const value of Object.values(PostCategoryEnum)) {
            const decision = resolveFacetSeoDecision({
                facetValues: [value],
                hasOtherFilters: false,
                validEnumValues: Object.values(PostCategoryEnum),
                dedicatedLandingPattern: FACET_CONFIG_BY_ID.postCategory.dedicatedLandingPattern
            });
            if (decision.canonical.kind !== 'dedicatedLanding') {
                throw new Error(`Expected a dedicatedLanding decision for ${value}`);
            }
            expect(resolvePostCategorySlug({ slug: decision.canonical.slug })).toBe(value);
        }
    });
});
