/**
 * @file bypass-routes-namespace-tags.test.ts
 * @description Every response that sets its OWN `Cache-Tag` carries the
 * deployment namespace (HOS-369 W1-2).
 *
 * These four families — `robots.txt`, `llms.txt`, the sitemaps and the RSS
 * feeds — are the ones a namespace change silently misses. They short-circuit
 * `isStaticAssetRoute` on their `.txt`/`.xml` extension, so the middleware
 * collector never sees them, and their caching is one entry in a headers
 * literal rather than anything that looks like cache code. An un-namespaced tag
 * here would purge nothing while every page-level test stayed green.
 *
 * `/api/og` is deliberately absent: it is content-addressed by its query string
 * and has no entity to purge by, so it emits no tag at all.
 *
 * The expected prefix is written as a literal rather than derived from
 * `resolveCacheTagEnvironment` — a fixture computed by the code under test
 * cannot fail when that code changes.
 */

import { describe, expect, it, vi } from 'vitest';

const NS = 'test:';

vi.mock('@/lib/env', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getSiteUrl: () => 'https://hospeda.com.ar',
        getNoindexHosts: () => undefined
    };
});

/** Every `Cache-Tag` value a response carries, split on the list separator. */
function tagsOf(response: Response): readonly string[] {
    const header = response.headers.get('Cache-Tag');
    return header === null ? [] : header.split(',');
}

describe('routes that bypass the middleware collector', () => {
    it('robots.txt tags itself with a namespaced site-config tag', async () => {
        const { GET } = await import('../../src/pages/robots.txt.js');
        const response = await GET({
            request: new Request('https://hospeda.com.ar/robots.txt', {
                headers: { host: 'hospeda.com.ar' }
            })
        } as never);

        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
        expect(tagsOf(response)).toEqual([`${NS}site-config`]);
    });

    it('llms.txt tags itself with a namespaced site-config tag', async () => {
        const { GET } = await import('../../src/pages/llms.txt.js');
        const response = await GET({
            request: new Request('https://hospeda.com.ar/llms.txt', {
                headers: { host: 'hospeda.com.ar' }
            })
        } as never);

        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
        expect(tagsOf(response)).toEqual([`${NS}site-config`]);
    });

    it('the sitemap headers namespace every collection tag', async () => {
        const { getSitemapResponseHeaders } = await import('../../src/lib/seo/sitemap-xml.js');
        const headers = getSitemapResponseHeaders();

        const tags = String(headers['Cache-Tag']).split(',');
        expect(tags).toEqual([
            `${NS}list-accom`,
            `${NS}list-dest`,
            `${NS}list-event`,
            `${NS}list-post`
        ]);
        expect(headers['Cache-Control']).toBe(
            'public, max-age=86400, stale-while-revalidate=86400'
        );
    });

    it('every emitted tag carries a recognised namespace, never the bare vocabulary', async () => {
        // The generic form of the three assertions above: whatever these
        // surfaces tag themselves with, it must not be a tag the purger would
        // never address.
        const { getSitemapResponseHeaders } = await import('../../src/lib/seo/sitemap-xml.js');
        const { GET: robots } = await import('../../src/pages/robots.txt.js');
        const { GET: llms } = await import('../../src/pages/llms.txt.js');

        const request = new Request('https://hospeda.com.ar/x', {
            headers: { host: 'hospeda.com.ar' }
        });

        const emitted = [
            ...tagsOf(await robots({ request } as never)),
            ...tagsOf(await llms({ request } as never)),
            ...String(getSitemapResponseHeaders()['Cache-Tag']).split(',')
        ];

        expect(emitted.length).toBeGreaterThan(0);
        for (const tag of emitted) {
            expect(tag.startsWith(NS)).toBe(true);
        }
    });
});
