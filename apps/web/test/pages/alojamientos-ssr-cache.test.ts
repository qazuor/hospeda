/**
 * @file alojamientos-ssr-cache.test.ts
 * @description HOS-299 — the three accommodation listing surfaces each issued
 * three bounded catalog GETs per SSR render (destinations, amenities, features)
 * without opting into the short-TTL SSR cache, unlike the home page.
 *
 * They are byte-identical across the three pages, so they share cache keys: one
 * opt-in serves `/alojamientos/`, `/alojamientos/mapa/` and
 * `/alojamientos/tipo/[type]/` alike.
 *
 * The listing QUERY itself deliberately does NOT opt in — see the note in the
 * page frontmatter and the JSDoc on `accommodationsApi.list`. These tests pin
 * that exclusion too, because it is the part most likely to be "helpfully"
 * added back.
 *
 * `.astro` frontmatter cannot render in Vitest, so page assertions are
 * source-based — the established pattern here (see `alojamientos-facet-seo.test.ts`).
 * The querystring assertions at the bottom are real fetch-level tests.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PAGES = {
    listing: resolve(__dirname, '../../src/pages/[lang]/alojamientos/index.astro'),
    map: resolve(__dirname, '../../src/pages/[lang]/alojamientos/mapa.astro'),
    byType: resolve(__dirname, '../../src/pages/[lang]/alojamientos/tipo/[type]/index.astro')
} as const;

/**
 * Extracts the argument text of a call, anchored on `object.method(` so it can
 * never match the import statement instead (that mistake made an earlier version
 * of the bookmarks assertion inspect a block of imports and pass vacuously).
 *
 * Naive paren matching: adequate because no argument here contains a paren
 * inside a string literal, and the walk is bounded to the enclosing statement.
 */
function callArgsOf(source: string, apiCall: string): string {
    const start = source.indexOf(`${apiCall}(`);
    expect(start, `${apiCall}( not found`).toBeGreaterThan(-1);

    let depth = 0;
    for (let i = start + apiCall.length; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        if (char === ')') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`Unbalanced parentheses after ${apiCall}(`);
}

describe('HOS-299 — bounded catalog reads opt into the SSR cache', () => {
    it.each([
        ['listing', PAGES.listing],
        ['map', PAGES.map],
        ['byType', PAGES.byType]
    ])('%s page caches all three catalog reads', (_name, path) => {
        const source = readFileSync(path, 'utf8');

        for (const apiCall of ['destinationsApi.list', 'amenitiesApi.list', 'featuresApi.list']) {
            expect(callArgsOf(source, apiCall)).toContain('cacheTtlMs: SSR_PUBLIC_CACHE_TTL_MS');
        }
    });

    it.each([
        ['listing', PAGES.listing],
        ['map', PAGES.map],
        ['byType', PAGES.byType]
    ])('%s page imports the shared constant rather than a local literal', (_name, path) => {
        const source = readFileSync(path, 'utf8');
        expect(source).toMatch(
            /import \{[^}]*SSR_PUBLIC_CACHE_TTL_MS[^}]*\} from '@\/lib\/api\/endpoints'/
        );
    });
});

describe('HOS-299 — the high-cardinality reads stay OUT of the cache', () => {
    const listingSource = readFileSync(PAGES.listing, 'utf8');

    /**
     * The listing query is page/filter/sort-dependent. Caching it would starve
     * the catalog entries it shares a store with: `ssr-cache.ts` evicts
     * oldest-first and `Map.set` on an existing key keeps its position, so the
     * periodically-refreshed catalog keys sit permanently in the oldest slots and
     * would be evicted FIRST under listing churn. The cap also bounds entry
     * count, not bytes, and `POST /api/revalidate` never clears this cache.
     */
    it('does not cache the accommodations listing query', () => {
        expect(callArgsOf(listingSource, 'accommodationsApi.list')).not.toContain('cacheTtlMs');
    });

    /**
     * The single security-relevant assertion in this file. Anchored on the CALL,
     * not the identifier: `indexOf('userBookmarksApi')` matches the import line
     * ~9 KB earlier and inspects a block of imports instead.
     */
    it('does not cache the per-user bookmarks read', () => {
        expect(callArgsOf(listingSource, 'userBookmarksApi.checkBulk')).not.toContain('cacheTtlMs');
    });
});

describe('HOS-299 — cacheTtlMs never reaches the API', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ success: true, data: { items: [], pagination: {} } }),
                    {
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    }
                )
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    /**
     * `cacheTtlMs` is a client-side directive, not a query param. If it were not
     * destructured out it would be serialised into the querystring, which both
     * fragments the cache key and makes the listing endpoint reject the request
     * with INVALID_PAGINATION_PARAMS — the page frontmatter already documents
     * that unknown params are rejected there.
     */
    it.each([
        'amenitiesApi',
        'featuresApi'
    ])('%s.list strips cacheTtlMs from the querystring', async (apiName) => {
        const endpoints = await import('../../src/lib/api/endpoints');
        const api = (endpoints as unknown as Record<string, { list: (p: unknown) => unknown }>)[
            apiName
        ];

        await api.list({ pageSize: 100, cacheTtlMs: 60_000 });

        expect(fetchMock).toHaveBeenCalled();
        const url = String(fetchMock.mock.calls[0]?.[0]);
        expect(url).toContain('pageSize=100');
        expect(url).not.toContain('cacheTtlMs');
    });
});
