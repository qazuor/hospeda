/**
 * @file cacheable-responses-carry-catch-all.test.ts
 * @description Every cacheable response carries the environment catch-all
 * (`<env>:all`), and no source file can produce one that does not (HOS-369).
 *
 * `RevalidationService.purgeEverything` no longer flushes the Cloudflare zone —
 * staging and production share it, so a zone flush from either emptied the
 * other's cache. It purges ONE tag instead, `<env>:all`, which works only for
 * as long as every cacheable response actually carries that tag. A response
 * that does not is invisible to the flush and stays cached for its whole TTL,
 * with nothing reporting it: the same silent, delayed failure profile the
 * sibling `cacheable-responses-declare-tags` guard exists for.
 *
 * Two halves, deliberately of different kinds:
 *
 *   1. MEMBERSHIP, at runtime. Every emitter entry point is CALLED and its
 *      output tag set is inspected. This is what the previous text-matching
 *      guard could not do: the miss it once had (`SITEMAP_RESPONSE_HEADERS`,
 *      aliased into a `Response` init where no scan could see the header name
 *      next to its value) is impossible against a set the code actually
 *      produced.
 *   2. CLOSURE, over the source tree. Membership can only test the emitters
 *      that exist today; the closure check is what stops a NEW one appearing.
 *      It asserts that any file declaring a response shared-cacheable gets its
 *      tags from `lib/cache/response-cache.ts`, which is where the catch-all is
 *      injected — so "carries the catch-all" follows from "compiled at all"
 *      rather than from anyone remembering.
 *
 * The `test:` namespace is written as a literal rather than derived from
 * `resolveCacheTagEnvironment`: a fixture computed by the code under test
 * cannot fail when that code changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheTagEnvironment } from '../../src/lib/cache/cache-tag-environment';
import { LISTING_PRIVATE_CONTROL } from '../../src/lib/cache/listing-cache';
import {
    applyCacheHeaders,
    buildStaticCacheHeaders,
    declareCacheTags
} from '../../src/lib/cache/response-cache';
import { buildEventsFeed, buildPostsFeed } from '../../src/lib/feeds';
import { getSitemapResponseHeaders } from '../../src/lib/seo/sitemap-xml';
import {
    classifyCacheControl,
    routesThroughCacheChokePoint,
    violatesCatchAllRule
} from './cacheable-responses-declare-tags';

vi.mock('@/lib/env', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getSiteUrl: () => 'https://hospeda.com.ar',
        getNoindexHosts: () => undefined
    };
});

/** The catch-all as it appears on the wire under vitest's `NODE_ENV=test`. */
const CATCH_ALL = 'test:all';

const WEB_SRC = path.resolve(__dirname, '../../src');

/** File extensions this guard inspects. */
const SCANNED_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);

/**
 * Files allowed to declare a response shared-cacheable without routing through
 * the choke point.
 *
 * Every entry must be load-bearing: removing it has to make the guard fail. The
 * honesty test below asserts exactly that, so an exemption that protects
 * nothing cannot quietly accumulate and turn the guard fail-open.
 */
const EXEMPT: ReadonlyArray<{ readonly file: string; readonly why: string }> = [
    {
        file: 'pages/api/og.ts',
        why: 'Content-addressed by construction: every input that changes the image is a query param, and the query string is part of the Cloudflare cache key. Nothing to purge, so nothing to flush it out of either.'
    },
    {
        file: 'pages/i18n/[file].js.ts',
        why: 'Content-addressed by construction (HOS-369 Wave D): the filename carries sha256 of the body served, so a dictionary change ships a NEW URL rather than needing the old one flushed — and the endpoint 404s any hash it does not currently serve. Nothing to purge, so nothing for the catch-all to reach either.'
    },
    {
        file: 'middleware.ts',
        why: 'The `Cache-Control` it writes belongs to `/_image`, which Astro content-addresses by transform query string — the same reasoning as og.ts. Its OTHER caching responsibility, writing the `Cache-Tag` header at Step 11, only ever serializes what the choke point already collected into `locals.cacheTags`; it never invents a tag.'
    }
    // `lib/cache/response-cache.ts` needs NO exemption, and must not be given
    // one: it writes the cacheable `Cache-Control` and calls `declareCacheTags`
    // in the same function, so it satisfies the rule on its own terms. An
    // exemption there would be the one place a fail-open could hide unnoticed.
];

/** Recursively collect every scannable file under `dir`. */
function collectFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            files.push(...collectFiles(full));
            continue;
        }
        if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
    }
    return files;
}

const ALL_FILES = collectFiles(WEB_SRC);
const EXEMPT_PATHS = new Set(EXEMPT.map((entry) => path.join(WEB_SRC, entry.file)));

/** Minimal stand-in for the request-scoped locals the emitter writes into. */
function makeLocals(): App.Locals {
    return { cacheTags: new Set<string>() } as unknown as App.Locals;
}

/** Every `Cache-Tag` value on a response, split on the list separator. */
function tagsOf(response: Response): readonly string[] {
    const header = response.headers.get('Cache-Tag');
    return header === null ? [] : header.split(',');
}

/** Every `Cache-Tag` value in a plain header record, split the same way. */
function tagsIn(headers: Readonly<Record<string, string>>): readonly string[] {
    const header = headers['Cache-Tag'];
    return header === undefined ? [] : header.split(',');
}

afterEach(() => {
    vi.unstubAllEnvs();
    _resetCacheTagEnvironment();
});

// ---------------------------------------------------------------------------
// 1. MEMBERSHIP — every emitter, called for real
// ---------------------------------------------------------------------------

describe('every emitter puts the catch-all on the response', () => {
    it('declareCacheTags registers it, at the HEAD of the collected set', () => {
        const locals = makeLocals();

        declareCacheTags({ locals, tags: ['list-accom', 'home'] });

        expect([...locals.cacheTags]).toEqual([CATCH_ALL, 'test:list-accom', 'test:home']);
    });

    it('applyCacheHeaders registers it on a cacheable page', () => {
        const locals = makeLocals();

        applyCacheHeaders({
            locals,
            headers: new Headers(),
            cacheable: true,
            tags: ['list-accom']
        });

        expect([...locals.cacheTags][0]).toBe(CATCH_ALL);
    });

    it('buildStaticCacheHeaders puts it first in the header it builds', () => {
        const headers = buildStaticCacheHeaders({
            cacheControl: 'public, max-age=3600',
            tags: ['site-config']
        });

        expect(tagsIn(headers)).toEqual([CATCH_ALL, 'test:site-config']);
    });

    it('robots.txt carries it', async () => {
        const { GET } = await import('../../src/pages/robots.txt.js');
        const response = await GET({
            request: new Request('https://hospeda.com.ar/robots.txt', {
                headers: { host: 'hospeda.com.ar' }
            })
        } as never);

        expect(tagsOf(response)).toEqual([CATCH_ALL, 'test:site-config']);
    });

    it('llms.txt carries it', async () => {
        const { GET } = await import('../../src/pages/llms.txt.js');
        const response = await GET({
            request: new Request('https://hospeda.com.ar/llms.txt', {
                headers: { host: 'hospeda.com.ar' }
            })
        } as never);

        expect(tagsOf(response)).toEqual([CATCH_ALL, 'test:site-config']);
    });

    it('the sitemaps carry it, ahead of every collection tag', () => {
        // Enumerated rather than derived from `CACHE_TAG_COLLECTIONS`, so that
        // adding a collection has to be acknowledged here. `list-gastro` and
        // `list-exp` arrived with HOS-369 W2-4 and belong: `sitemap-dynamic`
        // really does list gastronomy and experience entries, so a write to
        // either changes the document.
        expect(tagsIn(getSitemapResponseHeaders())).toEqual([
            CATCH_ALL,
            'test:list-accom',
            'test:list-dest',
            'test:list-event',
            'test:list-post',
            'test:list-gastro',
            'test:list-exp'
        ]);
    });

    it('the RSS feeds carry it', async () => {
        const posts = await buildPostsFeed({
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar',
            posts: []
        });
        const events = await buildEventsFeed({
            locale: 'es',
            siteUrl: 'https://hospeda.com.ar',
            events: []
        });

        expect(tagsOf(posts)).toEqual([CATCH_ALL, 'test:list-post']);
        expect(tagsOf(events)).toEqual([CATCH_ALL, 'test:list-event']);
    });

    it('emits NO catch-all when the deployment namespace is unresolved', () => {
        // Fail-closed is unchanged by this feature: without a namespace there is
        // no `<env>:all` either, so the response is demoted rather than tagged
        // with something the purger could not address — and certainly not with
        // a bare `all` both environments would match.
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();
        const locals = makeLocals();

        const headers = buildStaticCacheHeaders({
            cacheControl: 'public, max-age=3600',
            tags: ['site-config']
        });
        declareCacheTags({ locals, tags: ['list-accom'] });

        expect(headers).toEqual({ 'Cache-Control': LISTING_PRIVATE_CONTROL });
        expect(locals.cacheTags.size).toBe(0);
    });

    it('emits NO catch-all when every supplied tag is unusable', () => {
        // A response the catch-all ALONE could purge is a response no content
        // write can purge. It must still be demoted, so the catch-all must not
        // be able to rescue an otherwise-untaggable response.
        const locals = makeLocals();

        const headers = buildStaticCacheHeaders({
            cacheControl: 'public, max-age=3600',
            tags: ['bad tag']
        });
        const { tagCount } = declareCacheTags({ locals, tags: ['bad tag'] });

        expect(headers).toEqual({ 'Cache-Control': LISTING_PRIVATE_CONTROL });
        expect(tagCount).toBe(0);
        expect(locals.cacheTags.size).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 2. CLOSURE — no new emitter can appear outside the choke point
// ---------------------------------------------------------------------------

describe('no cacheable response is built outside the choke point', () => {
    it('scans a non-trivial number of files (the scan itself is not vacuous)', () => {
        expect(ALL_FILES.length).toBeGreaterThan(100);
    });

    it('finds at least one file that genuinely routes through the choke point', () => {
        const routed = ALL_FILES.filter((file) =>
            routesThroughCacheChokePoint({ source: fs.readFileSync(file, 'utf8') })
        );
        expect(routed.length).toBeGreaterThan(0);
    });

    it('every shared-cacheable response gets its tags from response-cache.ts', () => {
        const violations = ALL_FILES.filter((file) => {
            if (EXEMPT_PATHS.has(file)) return false;
            return violatesCatchAllRule({ source: fs.readFileSync(file, 'utf8') });
        }).map((file) => path.relative(WEB_SRC, file));

        expect(violations).toEqual([]);
    });

    it('every exemption is load-bearing — removing it makes the guard fail', () => {
        for (const entry of EXEMPT) {
            const full = path.join(WEB_SRC, entry.file);
            expect(fs.existsSync(full), `exempt file no longer exists: ${entry.file}`).toBe(true);
            expect(
                violatesCatchAllRule({ source: fs.readFileSync(full, 'utf8') }),
                `exemption for ${entry.file} protects nothing and should be deleted`
            ).toBe(true);
        }
    });
});

describe('choke-point detector behaviour (non-vacuity)', () => {
    it('FAILS a cacheable response that hand-rolls its own Cache-Tag', () => {
        // The exact shape the sibling guard PASSES and this one must not: tags
        // are produced, but not by the function that adds the catch-all.
        const source = `
            const header = serializeCacheTags({ tags: ['prod:list-accom'] }).header;
            return new Response(body, {
                headers: { 'Cache-Control': 'public, s-maxage=300', 'Cache-Tag': header }
            });
        `;
        expect(classifyCacheControl({ source }).kind).toBe('cacheable');
        expect(routesThroughCacheChokePoint({ source })).toBe(false);
        expect(violatesCatchAllRule({ source })).toBe(true);
    });

    it('PASSES the same response once it delegates to buildStaticCacheHeaders', () => {
        const source = `
            return new Response(body, {
                headers: { ...buildStaticCacheHeaders({
                    cacheControl: 'public, s-maxage=300', tags: [CACHE_TAG_SITE_CONFIG]
                }) }
            });
        `;
        expect(violatesCatchAllRule({ source })).toBe(false);
    });

    it('PASSES a private response, which is never cached and needs no catch-all', () => {
        const source = `headers.set('Cache-Control', 'private, no-cache');`;
        expect(violatesCatchAllRule({ source })).toBe(false);
    });

    it('does not read prose as code', () => {
        const source = `<!-- headers.set('Cache-Control', 'public, s-maxage=300') -->`;
        expect(violatesCatchAllRule({ source })).toBe(false);
    });
});
