/**
 * @file icon-sprite-endpoint.test.ts
 * @description Tests for `GET /icons/[file].svg`, the endpoint that serves the
 * hashed immutable icon sprite (HOS-369 W3-6).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconSpriteUrl } from '@/lib/icon-sprite';
import { GET, prerender } from '../../src/pages/icons/[file].svg';

const PAGES_ICONS_DIR = resolve(__dirname, '../../src/pages/icons');

/** Invokes the route with just the params it reads. */
function get(file: string | undefined): Response | Promise<Response> {
    return GET({ params: { file } } as never) as Response | Promise<Response>;
}

/**
 * What Astro actually puts in `params.file` for the sprite's current URL.
 *
 * The route is `[file].svg`, so the `.svg` is part of the ROUTE and Astro strips
 * it from the param — `/icons/sprite.9f3a1c07.svg` arrives as `sprite.9f3a1c07`.
 * Deriving it from the real URL (rather than hard-coding a stem) keeps this test
 * honest if the URL shape ever changes.
 */
function param(): string {
    return iconSpriteUrl()
        .replace('/icons/', '')
        .replace(/\.svg$/, '');
}

describe('the route file name', () => {
    it('carries the .svg in the ROUTE, not inside the dynamic param', () => {
        // Not cosmetic. With `[file].ts` the route path has no file extension,
        // so Astro applies `trailingSlash: 'always'` to it and compiles the
        // pattern `^\/icons\/([^/]+?)\/$` — which `/icons/sprite.abc.svg` never
        // matches. Astro's trailing-slash redirect does not rescue it either:
        // that handler skips any request pathname that already has an
        // extension. Every sprite request would 404 — so every icon on the site
        // would render as nothing — in production only, and nothing else in
        // this suite would notice.
        expect(
            existsSync(resolve(PAGES_ICONS_DIR, '[file].svg.ts')),
            'src/pages/icons/[file].svg.ts is missing — the .svg must be in the ROUTE file name, or every sprite request 404s in production only'
        ).toBe(true);
        expect(
            existsSync(resolve(PAGES_ICONS_DIR, '[file].ts')),
            'a bare [file].ts route serves nothing under trailingSlash: "always"'
        ).toBe(false);
    });
});

describe('GET /icons/[file].svg', () => {
    it('is server-rendered — a prerendered route would never see a request', () => {
        expect(prerender).toBe(false);
    });

    it('serves the sprite for the current filename', async () => {
        const response = await get(param());

        expect(response.status).toBe(200);
        expect(await response.text()).toContain('<symbol id="StarIcon-duotone"');
    });

    it('declares an SVG content type', async () => {
        // Anything else and the browser refuses to treat the document as SVG,
        // so every `<use href>` pointing into it resolves to nothing.
        const response = await get(param());

        expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    });

    it('is cacheable forever and immutable', async () => {
        const response = await get(param());

        expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    });

    it('404s on a stale hash instead of serving fresh content under it', async () => {
        // Load-bearing: the response is `immutable` for a year. Serving THIS
        // deployment's sprite under a PREVIOUS deployment's URL would pin the
        // wrong symbol set in every browser and edge cache that asked, and
        // nothing could invalidate it.
        const response = await get('sprite.deadbeef');

        expect(response.status).toBe(404);
    });

    it('404s on a missing or malformed filename', async () => {
        for (const file of [undefined, '', 'sprite', `${param()}.svg`, 'icons.deadbeef']) {
            expect((await get(file)).status, String(file)).toBe(404);
        }
    });

    it('never marks a 404 immutable', async () => {
        // A cached 404 for a filename a later deployment DOES serve would
        // outlive the mistake by a year.
        const response = await get('sprite.deadbeef');

        expect(response.headers.get('Cache-Control')).toBeNull();
    });
});
