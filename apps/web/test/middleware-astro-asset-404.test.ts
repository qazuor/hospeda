/**
 * @file middleware-astro-asset-404.test.ts
 * @description Regression coverage for HOS-2578: a 404 for a content-addressed
 * `/_astro/*` asset must never be cacheable.
 *
 * During a Coolify rollout two containers coexist. New HTML references
 * `/_astro/<new-hash>.js`; if the OLD container answers it, the 404 leaves with
 * no Cache-Control, Cloudflare stores it and hands the browser its zone default
 * (`max-age=14400`). A shared chunk (`react.<hash>.js`) then keeps every React
 * island un-hydrated for 4h. Same mechanism as HOS-2080 (`/i18n/[file].js`).
 */

import { describe, expect, it, vi } from 'vitest';

const { parseSessionUserMock } = vi.hoisted(() => ({
    parseSessionUserMock: vi.fn().mockResolvedValue(null)
}));

vi.mock('../src/lib/middleware-helpers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/lib/middleware-helpers')>();
    return { ...actual, parseSessionUser: parseSessionUserMock };
});

import { onRequest } from '../src/middleware';

/** Stand-in for the rendered `/404` error page, as Astro returns it from `rewrite`. */
const errorPage = (): Response =>
    new Response('<html><body>not found</body></html>', {
        status: 404,
        headers: { 'content-type': 'text/html' }
    });

/** Run the middleware for `pathname`, with `downstream` standing in for Astro's router. */
async function run({
    pathname,
    downstream,
    rewritten
}: {
    readonly pathname: string;
    readonly downstream: () => Response;
    readonly rewritten?: () => Response;
}): Promise<Response> {
    const context = {
        url: new URL(`https://hospeda.test${pathname}`),
        locals: {},
        request: { headers: new Headers() },
        isPrerendered: false,
        redirect: (target: string, status = 302) =>
            new Response(null, { status, headers: { location: target } }),
        cookies: { get: vi.fn() },
        rewrite: async () => (rewritten ?? downstream)()
    };
    const handler = onRequest as unknown as (
        ctx: unknown,
        next: () => Promise<Response>
    ) => Promise<Response>;
    return handler(context, async () => downstream());
}

describe('middleware: /_astro/* 404 (HOS-2578)', () => {
    it('forbids every cache from keeping a 404 for a missing chunk', async () => {
        for (const pathname of ['/_astro/react.ABCDEFGH.js', '/_astro/missing.12345678.css']) {
            const response = await run({
                pathname,
                downstream: () => new Response('Not Found', { status: 404 })
            });

            expect(response.status, pathname).toBe(404);
            expect(response.headers.get('Cache-Control'), pathname).toBe('no-store');
        }
    });

    it('overrides a Cache-Control already present on the 404', async () => {
        const response = await run({
            pathname: '/_astro/react.ABCDEFGH.js',
            downstream: () =>
                new Response('Not Found', {
                    status: 404,
                    headers: { 'Cache-Control': 'public, max-age=14400' }
                })
        });

        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('leaves a successful chunk response untouched', async () => {
        const immutable = 'public, max-age=31536000, immutable';
        const response = await run({
            pathname: '/_astro/react.ABCDEFGH.js',
            downstream: () =>
                new Response('console.log(1)', {
                    status: 200,
                    headers: { 'Cache-Control': immutable }
                })
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe(immutable);
    });
});

describe('middleware: other 404s (HOS-2578)', () => {
    it('forbids caching a 404 from the image endpoint', async () => {
        // Arrange
        const downstream = () => new Response('Not Found', { status: 404 });

        // Act
        const response = await run({ pathname: '/_image', downstream });

        // Assert
        expect(response.status).toBe(404);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('forbids caching a 404 from a content-addressed endpoint (icons sprite)', async () => {
        const downstream = () => new Response('Not Found', { status: 404 });

        const response = await run({ pathname: '/icons/sprite.deadbeef.svg', downstream });

        expect(response.status).toBe(404);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it.each([
        '/es/nope-xyz/',
        '/es/alojamientos/slug-not-published-yet/'
    ])('forbids caching the rendered 404 page for %s', async (pathname) => {
        // Arrange: the page answers a body-less 404, middleware rewrites to /404
        const downstream = () => new Response(null, { status: 404 });

        // Act
        const response = await run({ pathname, downstream, rewritten: errorPage });

        // Assert
        expect(response.status).toBe(404);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('Cache-Tag')).toBeNull();
    });

    it('replaces a shared Cache-Control the 404 page might carry, and drops its Cache-Tag', async () => {
        const downstream = () => new Response(null, { status: 404 });
        const rewritten = () =>
            new Response('<html></html>', {
                status: 404,
                headers: {
                    'content-type': 'text/html',
                    'Cache-Control': 'public, s-maxage=3600',
                    'Cache-Tag': 'x'
                }
            });

        const response = await run({ pathname: '/es/nope-xyz/', downstream, rewritten });

        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('leaves a 200 page cache header untouched', async () => {
        const downstream = () =>
            new Response('<html></html>', {
                status: 200,
                headers: { 'content-type': 'text/html', 'Cache-Control': 'private, no-cache' }
            });

        const response = await run({ pathname: '/es/alojamientos/', downstream });

        expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    });

    it('keeps 410 semantics: status 410 and no forced no-store', async () => {
        const downstream = () => new Response(null, { status: 410 });

        const response = await run({
            pathname: '/es/partners/gone/',
            downstream,
            rewritten: errorPage
        });

        expect(response.status).toBe(410);
        expect(response.headers.get('Cache-Control')).not.toBe('no-store');
    });
});
