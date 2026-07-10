/**
 * @file dedicated-landings-unchanged.test.ts
 * @description HOS-96 T-017/18/19, M-5 regression guard — the three
 * dedicated single-value facet landing pages
 * (`alojamientos/tipo/[type]/`, `eventos/categoria/[category]/`,
 * `publicaciones/categoria/[category]/`) are NOT modified by wiring
 * `resolveFacetSeoDecision` into the three BASE listings. They keep
 * resolving and keep emitting their own pre-existing canonical logic,
 * unchanged. None of them needs (or gets) the shared facet SEO predicate —
 * their single value is fixed by the URL path itself, not a query param, so
 * there is no 0/1/2+ decision to make on these pages.
 *
 * `.astro` frontmatter cannot render in Vitest — source-based assertions per
 * the project convention.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = resolve(__dirname, '../../src/pages/[lang]');

function readPage(relativePath: string): string {
    return readFileSync(resolve(PAGES_DIR, relativePath), 'utf8');
}

describe('alojamientos/tipo/[type]/index.astro — unchanged by HOS-96 T-017', () => {
    const src = readPage('alojamientos/tipo/[type]/index.astro');

    it('still resolves (imports ListingLayout, still a real page)', () => {
        expect(src).toContain('ListingLayout');
        expect(src).toContain('@route /{lang}/alojamientos/tipo/{type}/');
    });

    it('still self-canonicalizes via its own pagination-aware canonicalPath (unchanged pattern)', () => {
        expect(src).toMatch(
            /const canonicalPath = page > 1 \? `\$\{baseUrl\}page\/\$\{page\}\/` : baseUrl;/
        );
        expect(src).toContain('canonicalPath={canonicalPath}');
    });

    it('does NOT call resolveFacetSeoDecision (no 0/1/2+ decision on a landing — value is fixed by the URL path)', () => {
        expect(src).not.toContain('resolveFacetSeoDecision');
    });
});

describe('eventos/categoria/[category]/index.astro — unchanged by HOS-96 T-018', () => {
    const src = readPage('eventos/categoria/[category]/index.astro');

    it('still resolves (imports ListingLayout, still a real page)', () => {
        expect(src).toContain('ListingLayout');
        expect(src).toContain('@route /{lang}/eventos/categoria/{category}/');
    });

    it('still self-canonicalizes via its own pagination-aware canonicalPath (unchanged pattern)', () => {
        expect(src).toMatch(
            /const canonicalPath = page > 1 \? `\$\{baseUrl\}page\/\$\{page\}\/` : baseUrl;/
        );
        expect(src).toContain('canonicalPath={canonicalPath}');
    });

    it('does NOT call resolveFacetSeoDecision', () => {
        expect(src).not.toContain('resolveFacetSeoDecision');
    });

    it('still resolves the category slug via its own VALID_CATEGORIES dictionary (unchanged, not delegated to the shared predicate)', () => {
        expect(src).toContain('const VALID_CATEGORIES');
    });
});

describe('publicaciones/categoria/[category]/index.astro — unchanged by HOS-96 T-019', () => {
    const src = readPage('publicaciones/categoria/[category]/index.astro');

    it('still resolves (imports ListingLayout, still a real page)', () => {
        expect(src).toContain('ListingLayout');
        expect(src).toContain('@route /{lang}/publicaciones/categoria/{category}/');
    });

    it("still relies on ListingLayout's default canonicalPath (unchanged — never explicitly set canonicalPath before, still does not)", () => {
        expect(src).not.toContain('canonicalPath={canonicalPath}');
        expect(src).not.toContain('canonicalPath=');
    });

    it('does NOT call resolveFacetSeoDecision', () => {
        expect(src).not.toContain('resolveFacetSeoDecision');
    });

    it('still resolves the category slug via resolvePostCategorySlug (unchanged, not delegated to the shared predicate)', () => {
        expect(src).toContain('resolvePostCategorySlug');
    });
});
