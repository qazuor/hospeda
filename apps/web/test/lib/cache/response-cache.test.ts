/**
 * @file response-cache.test.ts
 * @description Unit tests for the single gate that may declare a response
 * edge-cacheable (HOS-369 W1-1).
 *
 * The property under test is not "the right header is set" but "a cacheable
 * response always carries something that can purge it". Once selective purge
 * replaces `purge_everything`, an untagged cacheable response is content no
 * write can invalidate — stale for the whole TTL, with nothing reporting it.
 *
 * Every expected tag below carries the `test:` namespace (HOS-369 W1-2): under
 * vitest `NODE_ENV=test`, so `resolveCacheTagEnvironment` yields `test`. The
 * prefix is asserted literally rather than derived from the same helper the
 * code under test uses — a test that recomputes the value cannot fail when the
 * value changes.
 *
 * Every tagged response also leads with `test:all`, the environment catch-all
 * that turns "purge everything" into a scoped tag purge (HOS-369). It is
 * asserted here as part of each expected tag LIST rather than in a separate
 * case, so an emitter that stopped adding it — or added it in the wrong
 * position — fails these tests too, not only the dedicated guard.
 *
 * `CACHEABLE_CONTROL` below is a literal, not `resolveCacheableControl({
 * cacheClass: 'catalog' })` — a fixture computed by the code under test cannot
 * fail when that code changes (HOS-426). `'catalog'` is the class these tests
 * exercise: their tags (`list-accom`) are the accommodation collection tag.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheTagEnvironment } from '../../../src/lib/cache/cache-tag-environment';
import { LISTING_PRIVATE_CONTROL } from '../../../src/lib/cache/listing-cache';
import {
    applyCacheHeaders,
    buildStaticCacheHeaders,
    declareCacheTags,
    isEdgeCacheableControl
} from '../../../src/lib/cache/response-cache';

/** The `catalog` cache class's `Cache-Control`, pinned as a literal (HOS-426). */
const CACHEABLE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

/** Minimal stand-in for the request-scoped locals the helpers touch. */
function makeLocals(): App.Locals {
    return { cacheTags: new Set<string>() } as unknown as App.Locals;
}

afterEach(() => {
    vi.unstubAllEnvs();
    _resetCacheTagEnvironment();
});

describe('declareCacheTags', () => {
    it('registers tags on the request-scoped collector, namespaced by deployment', () => {
        const locals = makeLocals();

        const result = declareCacheTags({ locals, tags: ['list-accom', 'home'] });

        expect(result.tagCount).toBe(2);
        expect([...locals.cacheTags]).toEqual(['test:all', 'test:list-accom', 'test:home']);
    });

    it('normalizes case, matching Cloudflare case-insensitive purge semantics', () => {
        const locals = makeLocals();

        declareCacheTags({ locals, tags: ['List-Accom'] });

        expect([...locals.cacheTags]).toEqual(['test:all', 'test:list-accom']);
    });

    it('drops tags Cloudflare would reject instead of registering them', () => {
        const locals = makeLocals();

        const result = declareCacheTags({ locals, tags: ['ok-tag', 'has space', 'has,comma'] });

        expect(result.tagCount).toBe(1);
        expect([...locals.cacheTags]).toEqual(['test:all', 'test:ok-tag']);
    });

    it('counts only the tags it was given, not the accumulated set', () => {
        // Load-bearing: applyCacheHeaders demotes a response from this number.
        // A tag some other component contributed does not make THIS response
        // purgeable, so counting the set size would defeat the fail-closed path.
        const locals = makeLocals();
        declareCacheTags({ locals, tags: ['from-elsewhere'] });

        const result = declareCacheTags({ locals, tags: ['bad tag'] });

        expect(result.tagCount).toBe(0);
        // The catch-all plus the one tag the earlier call contributed. The
        // rejected call added nothing of its own — not even a second catch-all.
        expect([...locals.cacheTags]).toEqual(['test:all', 'test:from-elsewhere']);
    });

    it('follows HOSPEDA_DEPLOY_ENV, so staging never emits production tags', () => {
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', 'preview');
        _resetCacheTagEnvironment();
        const locals = makeLocals();

        declareCacheTags({ locals, tags: ['list-accom'] });

        expect([...locals.cacheTags]).toEqual(['preview:all', 'preview:list-accom']);
    });

    it('registers NOTHING when the deployment namespace cannot be resolved', () => {
        // The measured staging-web configuration before this change: NODE_ENV
        // production, HOSPEDA_DEPLOY_ENV unset. Emitting bare (or guessed
        // `prod:`) tags there would let staging evict production, so nothing is
        // emitted at all and every caller demotes.
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();
        const locals = makeLocals();

        const result = declareCacheTags({ locals, tags: ['list-accom'] });

        expect(result.tagCount).toBe(0);
        expect(locals.cacheTags.size).toBe(0);
    });
});

describe('buildStaticCacheHeaders', () => {
    it('pairs the requested Cache-Control with a namespaced Cache-Tag', () => {
        expect(
            buildStaticCacheHeaders({
                cacheControl: 'public, max-age=3600',
                tags: ['site-config']
            })
        ).toEqual({
            'Cache-Control': 'public, max-age=3600',
            'Cache-Tag': 'test:all,test:site-config'
        });
    });

    it('serializes several tags into one comma-separated header', () => {
        expect(
            buildStaticCacheHeaders({
                cacheControl: 'public, max-age=86400',
                tags: ['list-post', 'list-event']
            })['Cache-Tag']
        ).toBe('test:all,test:list-post,test:list-event');
    });

    it('deduplicates repeated tags', () => {
        expect(
            buildStaticCacheHeaders({
                cacheControl: 'public, max-age=86400',
                tags: ['list-post', 'list-post']
            })['Cache-Tag']
        ).toBe('test:all,test:list-post');
    });

    it('DEMOTES to private and emits NO Cache-Tag when the namespace is unresolved', () => {
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();

        const headers = buildStaticCacheHeaders({
            cacheControl: 'public, max-age=3600',
            tags: ['site-config']
        });

        expect(headers).toEqual({ 'Cache-Control': LISTING_PRIVATE_CONTROL });
        expect(headers['Cache-Tag']).toBeUndefined();
    });

    it('DEMOTES to private when no supplied tag survives (fail-closed)', () => {
        expect(
            buildStaticCacheHeaders({ cacheControl: 'public, max-age=3600', tags: ['bad tag'] })
        ).toEqual({ 'Cache-Control': LISTING_PRIVATE_CONTROL });
    });
});

describe('applyCacheHeaders', () => {
    it('marks a cacheable response public and registers its tags', () => {
        const locals = makeLocals();
        const headers = new Headers();

        const result = applyCacheHeaders({
            locals,
            headers,
            cacheable: true,
            cacheClass: 'catalog',
            tags: ['list-accom']
        });

        expect(headers.get('Cache-Control')).toBe(CACHEABLE_CONTROL);
        expect(result).toEqual({
            cacheControl: CACHEABLE_CONTROL,
            cacheable: true,
            tagCount: 1
        });
        expect([...locals.cacheTags]).toEqual(['test:all', 'test:list-accom']);
    });

    it('DEMOTES to private when the deployment namespace is unresolved (fail-closed)', () => {
        // Without a namespace there is no tag that could purge this response,
        // so it must not be offered to the shared cache — the same rule as an
        // empty tag list, reached by a different route (HOS-369 W1-2).
        vi.stubEnv('HOSPEDA_DEPLOY_ENV', '');
        vi.stubEnv('NODE_ENV', 'production');
        _resetCacheTagEnvironment();
        const locals = makeLocals();
        const headers = new Headers();

        const result = applyCacheHeaders({
            locals,
            headers,
            cacheable: true,
            cacheClass: 'catalog',
            tags: ['list-accom']
        });

        expect(headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
        expect(result.cacheable).toBe(false);
        expect(locals.cacheTags.size).toBe(0);
    });

    it('marks a non-cacheable response private and registers nothing', () => {
        const locals = makeLocals();
        const headers = new Headers();

        const result = applyCacheHeaders({
            locals,
            headers,
            cacheable: false,
            cacheClass: 'catalog',
            tags: ['list-accom']
        });

        expect(headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
        expect(result.cacheable).toBe(false);
        expect(locals.cacheTags.size).toBe(0);
    });

    it('DEMOTES to private when no supplied tag is usable (fail-closed)', () => {
        // The tuple type makes an empty array unreachable from well-typed code,
        // so this covers the runtime case: tags built from data that turned out
        // to be missing. Serving an unpurgeable cached page is worse than not
        // caching at all, so the response loses its cacheability, not its tags.
        const locals = makeLocals();
        const headers = new Headers();

        const result = applyCacheHeaders({
            locals,
            headers,
            cacheable: true,
            cacheClass: 'catalog',
            tags: ['']
        });

        expect(headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
        expect(result.cacheable).toBe(false);
        expect(result.tagCount).toBe(0);
    });
});

describe('isEdgeCacheableControl', () => {
    it.each([
        [CACHEABLE_CONTROL, true],
        ['public, max-age=3600', true],
        ['s-maxage=300, stale-while-revalidate=60', true],
        [LISTING_PRIVATE_CONTROL, false],
        ['private, no-store', false],
        ['no-store', false],
        ['max-age=60', false],
        [null, false]
    ])('%s -> %s', (value, expected) => {
        expect(isEdgeCacheableControl({ cacheControl: value })).toBe(expected);
    });

    it('treats an explicitly private response as non-shareable even with s-maxage', () => {
        // `private` wins: it is the directive that forbids the shared cache.
        expect(isEdgeCacheableControl({ cacheControl: 'private, s-maxage=300' })).toBe(false);
    });

    it('is case-insensitive, since header values are not normalized upstream', () => {
        expect(isEdgeCacheableControl({ cacheControl: 'PUBLIC, S-MAXAGE=300' })).toBe(true);
    });
});
