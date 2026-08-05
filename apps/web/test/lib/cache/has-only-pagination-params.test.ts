/**
 * @file has-only-pagination-params.test.ts
 * @description HOS-369 W2-3 — the pagination-only cacheability predicate.
 *
 * This exists because `/…/page/N/` is not the URL the listing page sees. Those
 * routes are `Astro.rewrite`s into the parent listing with `?page=N` appended,
 * so the naive `Astro.url.search === ''` check would mark every paginated page
 * non-cacheable while looking perfectly correct on page 1 — a regression that
 * surfaces as a cache-hit-rate nobody is watching, not as a broken page.
 *
 * Cloudflare and the origin deliberately look at DIFFERENT urls here: the rule
 * matches the clean `/…/page/N/` path (empty query, so it is eligible), while
 * the origin sees the rewritten `?page=N`. Both checks are needed; neither is
 * redundant with the other.
 */

import { describe, expect, it } from 'vitest';
import { hasOnlyPaginationParams } from '../../../src/lib/cache/listing-cache';

/** Terser than building a `URLSearchParams` at every call site. */
function check(query: string): boolean {
    return hasOnlyPaginationParams({ searchParams: new URLSearchParams(query) });
}

describe('hasOnlyPaginationParams (HOS-369 W2-3)', () => {
    it('accepts a bare url', () => {
        expect(check('')).toBe(true);
    });

    it('accepts the rewritten pagination param', () => {
        // The whole reason this predicate exists — see the file docblock.
        expect(check('page=2')).toBe(true);
        expect(check('page=17')).toBe(true);
    });

    it('rejects any real filter', () => {
        expect(check('q=colon')).toBe(false);
        expect(check('categories=MUSIC')).toBe(false);
        expect(check('destinationId=abc')).toBe(false);
        expect(check('isFeatured=true')).toBe(false);
    });

    it('rejects a filter that arrives alongside pagination', () => {
        // Order must not matter: a filtered page 2 is still filtered.
        expect(check('page=2&q=colon')).toBe(false);
        expect(check('q=colon&page=2')).toBe(false);
    });

    it('rejects sort, which these listings do not promise to share', () => {
        // Unlike the accommodation listing (which accepts `sortBy` through its
        // own richer predicate), the catalog listings using this helper treat
        // anything but `page` as private. Fail-closed is the point: a param
        // added later is excluded until somebody decides otherwise.
        expect(check('sortBy=newest')).toBe(false);
    });

    it('rejects an empty-valued unknown param', () => {
        // `?q=` still means the visitor submitted the filter form. The value
        // being empty does not make the response the plain listing.
        expect(check('q=')).toBe(false);
    });

    it('accepts a repeated page param without treating it as a filter', () => {
        // Degenerate but reachable via a hand-written URL; the key is what
        // matters, not how many times it appears.
        expect(check('page=2&page=3')).toBe(true);
    });
});
