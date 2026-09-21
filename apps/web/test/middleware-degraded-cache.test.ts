/**
 * @file middleware-degraded-cache.test.ts
 * @description Regression test for HOS-1154: an SSR response that rendered its
 * error state must not leave the origin shared-cacheable.
 *
 * ## The bug this file exists for
 *
 * Every listing page calls `applyCacheHeaders()` in its frontmatter BEFORE the
 * data fetch, and computes `hasError` a hundred lines later. Measured on
 * `pages/[lang]/gastronomia/index.astro`: line 52 applies the headers, line 148
 * derives `hasError`, line 401 renders the `ErrorBanner`. Nothing between them
 * downgrades the decision, so the response that draws "No pudimos cargar…"
 * shipped `public, s-maxage=3600, stale-while-revalidate=3600` and Cloudflare
 * stored it as good content — for up to 2h (1h fresh + 1h SWR) AFTER the API
 * was fixed, because tag purges fire on entity WRITES and fixing an API is not
 * a write.
 *
 * ## Why the assertions live at the middleware, not at the page
 *
 * The fix is middleware-side by design (issue option 3): a page cannot forget
 * to degrade, because the degradation is signalled by the very component that
 * draws the error. This suite therefore exercises the REAL `onRequest`, with a
 * real `Response` and real headers, and asserts on what actually goes on the
 * wire — the page's own source could not prove any of it.
 *
 * Both directions are asserted here, because HOS-1154 AC-4 is the half that
 * breaks silently: the healthy response must still be cached EXACTLY as it is
 * today. A fix that demoted one response too many would cost the edge cache
 * HOS-369 built and nothing would report it.
 */

import { describe, expect, it, vi } from 'vitest';

const { parseSessionUserMock } = vi.hoisted(() => ({
    parseSessionUserMock: vi.fn().mockResolvedValue(null)
}));

// Mock only `parseSessionUser`; every other helper (route classification, CSP
// building) runs for real, exactly as `test/middleware.test.ts` does.
vi.mock('../src/lib/middleware-helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/middleware-helpers')>();
    return {
        ...actual,
        parseSessionUser: parseSessionUserMock
    };
});

import { LISTING_PRIVATE_CONTROL } from '../src/lib/cache/listing-cache';
// Imported statically rather than inside a test body: `src/middleware` pulls a
// large module graph, and charging that one-time cost to the first test's own
// timeout is what made `test/middleware.test.ts` flake on CI (see its import
// comment). Collection-time import is not measured against a test timeout.
import { onRequest } from '../src/middleware';

/** Minimal Astro `APIContext` double for the pipeline paths exercised here. */
function createContext({ pathname }: { readonly pathname: string }) {
    const locals: Record<string, unknown> = {};
    return {
        url: new URL(`https://hospeda.test${pathname}`),
        locals,
        isPrerendered: false,
        request: { headers: new Headers() },
        redirect: vi.fn(
            (url: string, status = 302) =>
                new Response(null, { status, headers: { location: url } })
        ),
        rewrite: vi.fn(),
        cookies: { get: vi.fn() }
    };
}

/**
 * Render a listing response through the real `onRequest`, letting the "page"
 * act from inside `next()` — i.e. while its frontmatter would be running, which
 * is the only moment a page or one of its components can reach `locals`.
 *
 * @param params.cacheControl - What the page's `applyCacheHeaders` decided.
 * @param params.tags - Tags collected during the render.
 * @param params.degraded - Whether the render marked the response degraded, the
 *   way `ErrorBanner.astro` does when it is actually drawn.
 */
async function runListing({
    cacheControl,
    tags = ['list-accom'],
    degraded = false
}: {
    readonly cacheControl: string;
    readonly tags?: readonly string[];
    readonly degraded?: boolean;
}): Promise<Response> {
    const context = createContext({ pathname: '/es/alojamientos/' });
    const next = vi.fn().mockImplementation(() => {
        const locals = context.locals as {
            cacheTags: Set<string>;
            responseDegraded?: boolean;
        };
        for (const tag of tags) locals.cacheTags.add(tag);
        // Set LAST, mirroring reality: the error state is known only after the
        // fetch resolves, long after `applyCacheHeaders` ran.
        if (degraded) locals.responseDegraded = true;

        const headers = new Headers({ 'content-type': 'text/html' });
        headers.set('Cache-Control', cacheControl);
        return Promise.resolve(new Response('<html>listing</html>', { headers }));
    });

    return (await onRequest(context as never, next)) as Response;
}

const CATALOG_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=3600';

describe('HOS-1154 — a degraded render is never left shared-cacheable', () => {
    it('AC-1: replaces the public Cache-Control of a response that drew its error state', async () => {
        const response = await runListing({ cacheControl: CATALOG_CONTROL, degraded: true });

        expect(response.headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
    });

    it('AC-1: the demoted value is not merely "different" — it is unshareable', async () => {
        // A value that dropped `s-maxage` but kept `public` would pass a
        // not-equal assertion while still being stored by a shared cache.
        const response = await runListing({ cacheControl: CATALOG_CONTROL, degraded: true });
        const value = (response.headers.get('Cache-Control') ?? '').toLowerCase();

        expect(value).toContain('private');
        expect(value).not.toContain('s-maxage');
        expect(value).not.toContain('stale-while-revalidate');
    });

    it('AC-1: withholds the Cache-Tag header, so nothing is filed under a purge key', async () => {
        // Emitting tags for a response the edge must not store is at best noise
        // and at worst a purge that reports success against an entry that was
        // never there.
        const response = await runListing({ cacheControl: CATALOG_CONTROL, degraded: true });

        expect(response.headers.get('Cache-Tag')).toBeNull();
    });

    it('demotes across the CSP branch, which REPLACES the response object', async () => {
        // Step 9 rebuilds `response` to hash the body. A header written before
        // that point is dropped for every SSR HTML page — which is every page
        // this fix is for. This asserts the ordering, not the CSP.
        const response = await runListing({ cacheControl: CATALOG_CONTROL, degraded: true });

        expect(response.headers.get('content-security-policy')).toBeTruthy();
        expect(response.headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
    });

    it('demotes a response whose page had already decided it was private', async () => {
        // Nothing to rescue here, but the invariant must hold unconditionally:
        // a degraded response is never shareable, whatever it started as.
        const response = await runListing({
            cacheControl: LISTING_PRIVATE_CONTROL,
            degraded: true
        });

        expect(response.headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
        expect(response.headers.get('Cache-Tag')).toBeNull();
    });
});

describe('HOS-1154 AC-4 — the healthy response is cached exactly as before', () => {
    it('keeps the page’s own Cache-Control byte-for-byte', async () => {
        const response = await runListing({ cacheControl: CATALOG_CONTROL });

        expect(response.headers.get('Cache-Control')).toBe(CATALOG_CONTROL);
    });

    it('still emits the collected purge tags', async () => {
        const response = await runListing({
            cacheControl: CATALOG_CONTROL,
            tags: ['list-accom', 'home']
        });

        expect(response.headers.get('Cache-Tag')).toBe('list-accom,home');
    });

    it('an explicitly NOT-degraded render is treated exactly like an unmarked one', async () => {
        // Guards against a truthiness slip (`'false'`, `0`, a missing default)
        // turning the flag into "always degraded".
        const context = createContext({ pathname: '/es/alojamientos/' });
        const next = vi.fn().mockImplementation(() => {
            const locals = context.locals as {
                cacheTags: Set<string>;
                responseDegraded?: boolean;
            };
            locals.cacheTags.add('list-accom');
            locals.responseDegraded = false;
            return Promise.resolve(
                new Response('<html>listing</html>', {
                    headers: {
                        'content-type': 'text/html',
                        'Cache-Control': CATALOG_CONTROL
                    }
                })
            );
        });

        const response = (await onRequest(context as never, next)) as Response;

        expect(response.headers.get('Cache-Control')).toBe(CATALOG_CONTROL);
        expect(response.headers.get('Cache-Tag')).toBe('list-accom');
    });

    it('opens the flag before next(), so a component can only ever flip it', async () => {
        // Same contract as `locals.cacheTags`: present from Step 0, so no
        // consumer ever reads `undefined` and no page has to initialise it.
        const context = createContext({ pathname: '/es/alojamientos/' });
        let seen: unknown = 'not-read';
        const next = vi.fn().mockImplementation(() => {
            seen = (context.locals as { responseDegraded?: unknown }).responseDegraded;
            return Promise.resolve(new Response('ok'));
        });

        await onRequest(context as never, next);

        expect(seen).toBe(false);
    });
});
