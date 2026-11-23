/**
 * @file i18n-asset-endpoint.test.ts
 * @description Tests for `GET /i18n/[file].js`, the endpoint that serves one
 * part (critical or rest, HOS-2572) of a locale's translation dictionary as a
 * hashed immutable asset (HOS-369 Wave D).
 *
 * `getInlineLocaleMessages` is mocked for the same reason as in
 * `test/lib/i18n-asset.test.ts`: under vitest `import.meta.env.SSR` is false, so
 * the real one returns `{}` and there would be no content to serve.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { type I18nAssetPart, i18nAssetUrl } from '@/lib/i18n-asset';
import { GET, prerender } from '../../src/pages/i18n/[file].js';

/** `vi.hoisted` — the mock factory below runs before any plain declaration. */
const FIXTURES = vi.hoisted<Record<string, Record<string, string>>>(() => ({
    es: { 'nav.signIn': 'Inicio' },
    en: { 'nav.signIn': 'Home' },
    pt: { 'nav.signIn': 'Início' }
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
 * it from the param — `/i18n/es.rest.9f3a1c07.js` arrives as `es.rest.9f3a1c07`.
 * Deriving it from the real URL (rather than hard-coding a stem) keeps this test
 * honest if the URL shape ever changes.
 */
function param(locale: 'es' | 'en' | 'pt', part: I18nAssetPart = 'rest'): string {
    return i18nAssetUrl({ locale, part }).replace('/i18n/', '').replace(/\.js$/, '');
}

/** The 8 hex chars of a part's current URL. */
function hashOf(locale: 'es' | 'en' | 'pt', part: I18nAssetPart): string {
    return param(locale, part).slice(`${locale}.${part}.`.length);
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

    it('serves each part for its current filename', async () => {
        for (const part of ['critical', 'rest'] as const) {
            const response = await get(param('es', part));

            expect(response.status, part).toBe(200);
            expect(await response.text(), part).toContain(
                '(window.__HOSPEDA_I18N__||(window.__HOSPEDA_I18N__={}),"es",'
            );
        }
    });

    it('serves the part the filename names', async () => {
        // `nav.signIn` is a critical key: it ships in the critical part only,
        // and only that part carries the hydration gate.
        const critical = await (await get(param('es', 'critical'))).text();
        const rest = await (await get(param('es', 'rest'))).text();

        expect(critical).toContain('"nav.signIn":"Inicio"');
        expect(critical).toContain('__HOSPEDA_HYDRATION_GATE__');
        expect(rest).not.toContain('nav.signIn');
        expect(rest).not.toContain('__HOSPEDA_HYDRATION_GATE__');
    });

    it('serves the locale the filename names, not a default one', async () => {
        const response = await get(param('pt', 'critical'));

        expect(await response.text()).toContain('"nav.signIn":"Início"');
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
        const response = await get('es.rest.deadbeef');

        expect(response.status).toBe(404);
    });

    it('404s on an unknown locale', async () => {
        const response = await get(`fr.rest.${hashOf('es', 'rest')}`);

        expect(response.status).toBe(404);
    });

    it('404s on a missing or malformed filename', async () => {
        for (const file of [
            undefined,
            '',
            'es',
            `es.${hashOf('es', 'rest')}`,
            `es.rest.${hashOf('es', 'critical')}`,
            'es.rest.deadbeef.m'
        ]) {
            expect((await get(file)).status, String(file)).toBe(404);
        }
    });

    it('forbids every cache from keeping a 404 (HOS-2080)', async () => {
        // A 404 with NO Cache-Control is not "uncached": Cloudflare stores it
        // and hands the browser its zone default (measured on staging:
        // `max-age=14400`, `cf-cache-status: HIT` on the second request).
        // During a rollout the old container answers the NEW hash with a 404,
        // and that 404 then pins every island of that locale to its Spanish
        // fallbacks long after the new container serves the dictionary.
        for (const file of ['es.rest.deadbeef', `fr.rest.${hashOf('es', 'rest')}`, 'es']) {
            const response = await get(file);

            expect(response.status, file).toBe(404);
            expect(response.headers.get('Cache-Control'), file).toBe('no-store');
        }
    });
});
