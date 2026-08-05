/**
 * @file i18n-asset-endpoint.test.ts
 * @description Tests for `GET /i18n/[file].js`, the endpoint that serves a
 * locale's translation dictionary as a hashed immutable asset (HOS-369 Wave D).
 *
 * `getInlineLocaleMessages` is mocked for the same reason as in
 * `test/lib/i18n-asset.test.ts`: under vitest `import.meta.env.SSR` is false, so
 * the real one returns `{}` and there would be no content to serve.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { i18nAssetUrl } from '@/lib/i18n-asset';
import { GET, prerender } from '../../src/pages/i18n/[file].js';

/** `vi.hoisted` — the mock factory below runs before any plain declaration. */
const FIXTURES = vi.hoisted<Record<string, Record<string, string>>>(() => ({
    es: { 'nav.home': 'Inicio' },
    en: { 'nav.home': 'Home' },
    pt: { 'nav.home': 'Início' }
}));

vi.mock('@/lib/i18n', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getInlineLocaleMessages: (locale: string) => FIXTURES[locale] ?? {}
    };
});

const PAGES_I18N_DIR = resolve(__dirname, '../../src/pages/i18n');

/** Invokes the route with just the params it reads. */
function get(file: string | undefined): Response | Promise<Response> {
    return GET({ params: { file } } as never) as Response | Promise<Response>;
}

/**
 * What Astro actually puts in `params.file` for a locale's current URL.
 *
 * The route is `[file].js`, so the `.js` is part of the ROUTE and Astro strips
 * it from the param — `/i18n/es.9f3a1c07.js` arrives as `es.9f3a1c07`. Deriving
 * it from the real URL (rather than hard-coding a stem) keeps this test honest
 * if the URL shape ever changes.
 */
function param(locale: 'es' | 'en' | 'pt'): string {
    return i18nAssetUrl(locale).replace('/i18n/', '').replace(/\.js$/, '');
}

describe('the route file name', () => {
    it('carries the .js in the ROUTE, not inside the dynamic param', () => {
        // Not cosmetic. With `[file].ts` the route path has no file extension,
        // so Astro applies `trailingSlash: 'always'` to it and compiles the
        // pattern `^\/i18n\/([^/]+?)\/$` — which `/i18n/es.abc.js` never
        // matches. Astro's trailing-slash redirect does not rescue it either:
        // that handler skips any request pathname that already has an
        // extension. Every dictionary request would 404, in production only,
        // and nothing else in this suite would notice.
        expect(existsSync(resolve(PAGES_I18N_DIR, '[file].js.ts'))).toBe(true);
        expect(
            existsSync(resolve(PAGES_I18N_DIR, '[file].ts')),
            'a bare [file].ts route serves nothing under trailingSlash: "always"'
        ).toBe(false);
    });
});

describe('GET /i18n/[file].js', () => {
    it('is server-rendered — a prerendered route would never see a request', () => {
        expect(prerender).toBe(false);
    });

    it('serves the dictionary for the current filename', async () => {
        const response = await get(param('es'));

        expect(response.status).toBe(200);
        expect(await response.text()).toContain('(window.__HOSPEDA_I18N__||={})["es"]=');
    });

    it('serves the locale the filename names, not a default one', async () => {
        const response = await get(param('pt'));

        expect(await response.text()).toContain('"nav.home":"Início"');
    });

    it('declares an executable JavaScript content type', async () => {
        // Anything else and the browser refuses to run it, so the global is
        // never assigned and every island falls back to its key.
        const response = await get(param('es'));

        expect(response.headers.get('Content-Type')).toBe('application/javascript; charset=utf-8');
    });

    it('is cacheable forever and immutable', async () => {
        const response = await get(param('es'));

        expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    });

    it('404s on a stale hash instead of serving fresh content under it', async () => {
        // Load-bearing: the response is `immutable` for a year. Serving THIS
        // deployment's dictionary under a PREVIOUS deployment's URL would pin
        // the wrong content in every browser and edge cache that asked, and
        // nothing could invalidate it.
        const response = await get('es.deadbeef');

        expect(response.status).toBe(404);
    });

    it('404s on an unknown locale', async () => {
        const response = await get(`fr.${param('es').slice('es.'.length)}`);

        expect(response.status).toBe(404);
    });

    it('404s on a missing or malformed filename', async () => {
        for (const file of [undefined, '', 'es', 'es.deadbeef.m']) {
            expect((await get(file)).status, String(file)).toBe(404);
        }
    });

    it('never marks a 404 immutable', async () => {
        // A cached 404 for a filename a later deployment DOES serve would
        // outlive the mistake by a year.
        const response = await get('es.deadbeef');

        expect(response.headers.get('Cache-Control')).toBeNull();
    });
});
