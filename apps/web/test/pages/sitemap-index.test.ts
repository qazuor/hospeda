/**
 * @fileoverview
 * Tests for `/sitemap-index.xml` and `/sitemap-static.xml`.
 *
 * These two endpoints replace the `@astrojs/sitemap` integration. The bugs they
 * exist to fix are both regressions worth pinning:
 *
 *  1. The index listed only a `<urlset>` that contained no pages, because the
 *     integration enumerates build-time static routes and this app has none.
 *  2. `/sitemap-dynamic.xml` was referenced through `customPages`, which appends
 *     to a `<urlset>` — so it was advertised as a crawlable PAGE, never
 *     registered as a child sitemap, and its ~924 URLs were never submitted.
 *
 * The `<sitemap>`-vs-`<url>` distinction is therefore the single most important
 * assertion in this file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATIC_SITEMAP_PAGES } from '../../src/lib/seo/static-sitemap-pages.js';
import * as indexMod from '../../src/pages/sitemap-index.xml.js';
import * as staticMod from '../../src/pages/sitemap-static.xml.js';

vi.mock('../../src/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test'),
    getSiteUrl: vi.fn(() => 'https://hospeda.test/')
}));

type Handler = (request: unknown) => Promise<Response>;

const getIndex = indexMod.GET as unknown as Handler;
const getStatic = staticMod.GET as unknown as Handler;

describe('sitemap-index.xml', () => {
    let xml: string;
    let response: Response;

    beforeEach(async () => {
        response = await getIndex({});
        xml = await response.text();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('responds 200 with XML and a 24h cache', () => {
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
        expect(response.headers.get('Cache-Control')).toBe(
            'public, max-age=86400, stale-while-revalidate=86400'
        );
    });

    it('is a sitemapindex, not a urlset', () => {
        expect(xml).toContain('<sitemapindex');
        expect(xml).not.toContain('<urlset');
    });

    it('registers the dynamic sitemap as a CHILD SITEMAP, never as a page URL', () => {
        // The exact regression: `customPages` emitted `<url><loc>…dynamic.xml`,
        // which makes a crawler fetch the file as content instead of parsing it
        // as a sitemap.
        expect(xml).toContain('<sitemap>\n    <loc>https://hospeda.test/sitemap-dynamic.xml</loc>');
        expect(xml).not.toContain('<url>');
    });

    it('lists both child sitemaps, static first', () => {
        const staticAt = xml.indexOf('/sitemap-static.xml');
        const dynamicAt = xml.indexOf('/sitemap-dynamic.xml');

        expect(staticAt).toBeGreaterThan(-1);
        expect(dynamicAt).toBeGreaterThan(-1);
        expect(staticAt).toBeLessThan(dynamicAt);
    });

    it('never doubles the slash when the site URL has a trailing one', () => {
        expect(xml).not.toContain('hospeda.test//');
    });

    it('stamps every child with a lastmod date', () => {
        const lastmods = xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) ?? [];

        expect(lastmods).toHaveLength(2);
    });
});

describe('sitemap-static.xml', () => {
    let xml: string;
    let response: Response;

    beforeEach(async () => {
        response = await getStatic({});
        xml = await response.text();
    });

    it('responds 200 with XML and a 24h cache', () => {
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
        expect(response.headers.get('Cache-Control')).toBe(
            'public, max-age=86400, stale-while-revalidate=86400'
        );
    });

    it('emits one <url> per curated page per locale', () => {
        const urls = xml.match(/<loc>/g) ?? [];

        expect(urls).toHaveLength(STATIC_SITEMAP_PAGES.length * 3);
    });

    it('emits the home page for all three locales', () => {
        expect(xml).toContain('<loc>https://hospeda.test/es/</loc>');
        expect(xml).toContain('<loc>https://hospeda.test/en/</loc>');
        expect(xml).toContain('<loc>https://hospeda.test/pt/</loc>');
    });

    it('never emits the unprefixed root, which 301-redirects (SPEC-157 REQ-2)', () => {
        expect(xml).not.toContain('<loc>https://hospeda.test/</loc>');
    });

    it('emits the informational pages the old sitemap silently dropped', () => {
        for (const path of [
            '/nosotros/',
            '/contacto/',
            '/legal/terminos/',
            '/preguntas-frecuentes/'
        ]) {
            expect(xml, `${path} missing`).toContain(`<loc>https://hospeda.test/es${path}</loc>`);
        }
    });

    it('carries reciprocal hreflang alternates with an es x-default', () => {
        expect(xml).toContain(
            '<xhtml:link rel="alternate" hreflang="x-default" href="https://hospeda.test/es/nosotros/"/>'
        );
        expect(xml).toContain(
            '<xhtml:link rel="alternate" hreflang="pt" href="https://hospeda.test/pt/nosotros/"/>'
        );
    });

    it('never doubles a locale prefix', () => {
        expect(xml).not.toMatch(/\/(es|en|pt)\/(es|en|pt)\//);
    });

    it('omits lastmod rather than claiming a fake edit date', () => {
        expect(xml).not.toContain('<lastmod>');
    });

    it('contains no page excluded from crawling', () => {
        for (const prefix of ['/mi-cuenta/', '/auth/', '/feedback/', '/checkout/']) {
            expect(xml, `${prefix} leaked into the sitemap`).not.toContain(prefix);
        }
    });
});
