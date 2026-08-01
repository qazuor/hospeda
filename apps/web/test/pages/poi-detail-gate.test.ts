/**
 * @fileoverview
 * Guards the `hasOwnPage` gate on point-of-interest detail pages.
 *
 * The gate is the entire reason `/destinos/lugar/{slug}/` is safe to ship. The
 * catalog holds 842 POIs; only a curated handful carry `hasOwnPage`. If either
 * the page or the sitemap stops honouring the flag, the site starts publishing
 * ~839 near-duplicate pages that restate their destination's accommodation
 * listing — the doorway-content failure the flag exists to prevent.
 *
 * Two independent enforcement points, so both are tested:
 *  - the page itself must 404 a POI without the flag;
 *  - the sitemap must not advertise one.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sitemapMod from '../../src/pages/sitemap-dynamic.xml.js';

vi.mock('../../src/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test'),
    getSiteUrl: vi.fn(() => 'https://hospeda.test')
}));

const PAGE_SOURCE = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/lugar/[slug]/index.astro'),
    'utf8'
);

/** POIs the fake API returns: one curated, two ordinary catalog rows. */
const POI_ITEMS = [
    { id: 'poi-1', slug: 'palacio_san_jose', hasOwnPage: true, updatedAt: '2026-01-02' },
    { id: 'poi-2', slug: 'hospital_paranacito', hasOwnPage: false },
    { id: 'poi-3', slug: 'kiosco_de_la_esquina' }
];

function jsonResponse(items: readonly unknown[]): Response {
    return new Response(
        JSON.stringify({
            success: true,
            data: {
                items,
                pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

/** Only the points-of-interest fetch returns rows; every other entity is empty. */
function stubApi(): void {
    vi.stubGlobal(
        'fetch',
        vi
            .fn()
            .mockImplementation(async (url: string) =>
                url.includes('/points-of-interest') ? jsonResponse(POI_ITEMS) : jsonResponse([])
            )
    );
}

describe('POI detail page — hasOwnPage gate', () => {
    it('404s a point of interest that does not carry the flag', () => {
        // The page reads the flag off the payload and refuses anything but an
        // explicit `true` — a POI whose payload omits the key must not slip
        // through on a truthy-ish value.
        expect(PAGE_SOURCE).toContain('poi.hasOwnPage !== true');
        expect(PAGE_SOURCE).toContain('status: 404');
    });

    it('resolves the POI by slug before gating (no id-based lookup)', () => {
        expect(PAGE_SOURCE).toContain('pointOfInterestApi.getBySlug');
    });

    it('asks for accommodations by proximity to the POI, not by destination', () => {
        // `poiSlug` is what makes the block "nearby"; swapping it for a plain
        // destination filter would silently turn the page into a copy of
        // /destinos/{slug}/alojamientos/.
        expect(PAGE_SOURCE).toContain('poiSlug: slug');
    });

    it('labels the destination fallback honestly instead of claiming proximity', () => {
        // When nothing is within the radius the heading must change too — a
        // "nearby" heading over destination-wide results is a false claim.
        expect(PAGE_SOURCE).toContain('destinationFallbackTitle');
        expect(PAGE_SOURCE).toContain('useDestinationFallback');
    });
});

describe('sitemap — POI landings', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('emits only the points of interest carrying hasOwnPage', async () => {
        stubApi();

        const response = await (sitemapMod.GET as unknown as (r: unknown) => Promise<Response>)({});
        const xml = await response.text();

        expect(xml).toContain(
            '<loc>https://hospeda.test/es/destinos/lugar/palacio_san_jose/</loc>'
        );
        expect(xml).not.toContain('hospital_paranacito');
        expect(xml).not.toContain('kiosco_de_la_esquina');
    });

    it('emits the curated POI in all three locales', async () => {
        stubApi();

        const response = await (sitemapMod.GET as unknown as (r: unknown) => Promise<Response>)({});
        const xml = await response.text();

        for (const prefix of ['es', 'en', 'pt']) {
            expect(xml).toContain(
                `<loc>https://hospeda.test/${prefix}/destinos/lugar/palacio_san_jose/</loc>`
            );
        }
    });

    it('treats a missing hasOwnPage key as not-published', async () => {
        // `kiosco_de_la_esquina` has no `hasOwnPage` key at all. An `!== false`
        // style check would publish it; the strict `=== true` check must not.
        stubApi();

        const response = await (sitemapMod.GET as unknown as (r: unknown) => Promise<Response>)({});
        const xml = await response.text();
        const poiLandings = xml.match(/\/destinos\/lugar\//g) ?? [];

        // 1 curated POI × 3 locales, each appearing once in <loc> and 4 times
        // in its hreflang block (es/en/pt/x-default) = 3 × 5.
        expect(poiLandings).toHaveLength(15);
    });
});
