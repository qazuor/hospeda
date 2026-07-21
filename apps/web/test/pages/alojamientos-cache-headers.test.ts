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
const indexSrc = readFileSync(resolve(__dirname, `${PAGES}/index.astro`), 'utf8');
const mapaSrc = readFileSync(resolve(__dirname, `${PAGES}/mapa.astro`), 'utf8');
const tipoSrc = readFileSync(resolve(__dirname, `${PAGES}/tipo/[type]/index.astro`), 'utf8');

/** The three pages all import the shared cache helper and set the header. */
describe.each([
    ['index.astro', () => indexSrc],
    ['mapa.astro', () => mapaSrc],
    ['tipo/[type]/index.astro', () => tipoSrc]
])('%s — shared Cache-Control wiring', (_name, getSrc) => {
    it('imports the shared listing-cache helper', () => {
        const src = getSrc();
        expect(src).toContain("from '@/lib/cache/listing-cache'");
        expect(src).toContain('resolveListingCacheControl');
        expect(src).toContain('hasActiveAccommodationListingFilters');
    });

    it('sets Cache-Control on Astro.response.headers via the helper', () => {
        const src = getSrc();
        expect(src).toContain('Astro.response.headers.set(');
        expect(src).toContain("'Cache-Control'");
        expect(src).toContain('resolveListingCacheControl({');
    });

    it('gates the shareable decision on the anonymous case (!isAuthenticated)', () => {
        expect(getSrc()).toContain('!isAuthenticated');
    });

    it('computes isAuthenticated BEFORE setting the header (no personalised leak)', () => {
        const src = getSrc();
        const authIdx = src.search(/const isAuthenticated\s*=/);
        const headerIdx = src.indexOf("'Cache-Control'");
        expect(authIdx).toBeGreaterThan(-1);
        expect(headerIdx).toBeGreaterThan(-1);
        expect(authIdx).toBeLessThan(headerIdx);
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
        const headerIdx = tipoSrc.indexOf("'Cache-Control'");
        expect(guardIdx).toBeGreaterThan(-1);
        expect(headerIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(headerIdx);
    });
});
