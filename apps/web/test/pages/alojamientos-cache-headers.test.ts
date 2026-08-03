/**
 * @file alojamientos-cache-headers.test.ts
 * @description Source-reading tests that lock in the HOS-218 Cloudflare
 * edge-cache wiring on the three accommodation listing/map SSR pages.
 *
 * Astro pages cannot be rendered in Vitest/jsdom (sealed pattern — see
 * apps/web/CLAUDE.md "Testing"), so assertions target the page source text.
 * The pure decision logic is covered separately in
 * `test/lib/cache/listing-cache.test.ts`; these tests guard the wiring the
 * helper depends on — the gate composition, and the ordering invariants that
 * keep a personalised response from ever being marked shareable.
 *
 * Mirrors the established `pricing-ssr-runtime.test.ts` precedent.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = '../../src/pages/[lang]/alojamientos';

/**
 * Read a page with its comments stripped.
 *
 * These are substring assertions, so prose counts as code unless it is removed
 * first: the pages now carry a comment explaining that the `!isAuthenticated`
 * gate was REMOVED (HOS-369 WB0-5), and a raw `toContain` would read that as
 * the gate still being there.
 */
function readPage(relative: string): string {
    return readFileSync(resolve(__dirname, `${PAGES}/${relative}`), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

const indexSrc = readPage('index.astro');
const mapaSrc = readPage('mapa.astro');
const tipoSrc = readPage('tipo/[type]/index.astro');

/** The three pages all import the shared cache helper and set the header. */
describe.each([
    ['index.astro', () => indexSrc],
    ['mapa.astro', () => mapaSrc],
    ['tipo/[type]/index.astro', () => tipoSrc]
])('%s — shared Cache-Control wiring', (_name, getSrc) => {
    it('imports the shared cache helpers', () => {
        const src = getSrc();
        expect(src).toContain("from '@/lib/cache/listing-cache'");
        expect(src).toContain('hasActiveAccommodationListingFilters');
        expect(src).toContain("from '@/lib/cache/response-cache'");
        expect(src).toContain('applyCacheHeaders');
    });

    it('sets Cache-Control through applyCacheHeaders, never by hand', () => {
        // HOS-369 W1-1 inverted this assertion. Setting the header directly is
        // now the defect: `applyCacheHeaders` is the only thing that may declare
        // a response cacheable, because it cannot do so without being handed the
        // cache tags that will purge it. A hand-set header would produce a
        // cacheable response nothing can invalidate before its TTL expires.
        const src = getSrc();
        expect(src).toContain('applyCacheHeaders({');
        expect(src).toContain('headers: Astro.response.headers');
        expect(src).not.toContain('resolveListingCacheControl');
        expect(src).not.toMatch(/headers\.set\(\s*'Cache-Control'/);
    });

    it('declares the accommodation collection tag so a write can purge it', () => {
        const src = getSrc();
        expect(src).toContain("from '@repo/cache-tags'");
        expect(src).toContain('CACHE_TAG_COLLECTIONS.accommodation');
    });

    it('does NOT gate the shareable decision on the session (HOS-369 WB0-5)', () => {
        // The `!isAuthenticated` term is gone by construction: the response no
        // longer varies by visitor, so there is no personalised variant to
        // withhold from the cache. D-8 replaces "the origin promises not to
        // mark it shareable" with "there is nothing personal in it".
        const src = getSrc();
        expect(src).not.toContain('!isAuthenticated');
        expect(src).not.toContain('Astro.locals.user');
    });

    it('gates on the absence of active filters', () => {
        expect(getSrc()).toContain(
            'hasActiveAccommodationListingFilters({ searchParams: url.searchParams })'
        );
    });
});

describe('index.astro — indexable gate', () => {
    it('excludes noindex (2+ facet) combinations from the shared cache', () => {
        // The base listing must not edge-cache a noindexed multi-type combination.
        expect(indexSrc).toContain('!facetSeoDecision.noindex');
    });
});

describe('mapa.astro — type gate', () => {
    it('excludes any ?types= combination (the map has no noindex-facet guard)', () => {
        // The map forwards `types` to the API but has no facetSeoDecision guard,
        // so it must exclude type-filtered maps explicitly.
        expect(mapaSrc).toContain("!url.searchParams.has('types')");
    });
});

describe('tipo/[type]/index.astro — header placement', () => {
    it('sets the header AFTER the invalid-type 404 guard', () => {
        const guardIdx = tipoSrc.indexOf('status: 404');
        const headerIdx = tipoSrc.indexOf('applyCacheHeaders({');
        expect(guardIdx).toBeGreaterThan(-1);
        expect(headerIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(headerIdx);
    });
});
