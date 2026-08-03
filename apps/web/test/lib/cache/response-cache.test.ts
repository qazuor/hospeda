/**
 * @file response-cache.test.ts
 * @description Unit tests for the single gate that may declare a response
 * edge-cacheable (HOS-369 W1-1).
 *
 * The property under test is not "the right header is set" but "a cacheable
 * response always carries something that can purge it". Once selective purge
 * replaces `purge_everything`, an untagged cacheable response is content no
 * write can invalidate — stale for the whole TTL, with nothing reporting it.
 */

import { describe, expect, it } from 'vitest';
import {
    LISTING_CACHEABLE_CONTROL,
    LISTING_PRIVATE_CONTROL
} from '../../../src/lib/cache/listing-cache';
import {
    applyCacheHeaders,
    declareCacheTags,
    isEdgeCacheableControl
} from '../../../src/lib/cache/response-cache';

/** Minimal stand-in for the request-scoped locals the helpers touch. */
function makeLocals(): App.Locals {
    return { cacheTags: new Set<string>() } as unknown as App.Locals;
}

describe('declareCacheTags', () => {
    it('registers tags on the request-scoped collector', () => {
        const locals = makeLocals();

        const result = declareCacheTags({ locals, tags: ['list-accom', 'home'] });

        expect(result.tagCount).toBe(2);
        expect([...locals.cacheTags]).toEqual(['list-accom', 'home']);
    });

    it('normalizes case, matching Cloudflare case-insensitive purge semantics', () => {
        const locals = makeLocals();

        declareCacheTags({ locals, tags: ['List-Accom'] });

        expect([...locals.cacheTags]).toEqual(['list-accom']);
    });

    it('drops tags Cloudflare would reject instead of registering them', () => {
        const locals = makeLocals();

        const result = declareCacheTags({ locals, tags: ['ok-tag', 'has space', 'has,comma'] });

        expect(result.tagCount).toBe(1);
        expect([...locals.cacheTags]).toEqual(['ok-tag']);
    });

    it('counts only the tags it was given, not the accumulated set', () => {
        // Load-bearing: applyCacheHeaders demotes a response from this number.
        // A tag some other component contributed does not make THIS response
        // purgeable, so counting the set size would defeat the fail-closed path.
        const locals = makeLocals();
        declareCacheTags({ locals, tags: ['from-elsewhere'] });

        const result = declareCacheTags({ locals, tags: ['bad tag'] });

        expect(result.tagCount).toBe(0);
        expect(locals.cacheTags.size).toBe(1);
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
            tags: ['list-accom']
        });

        expect(headers.get('Cache-Control')).toBe(LISTING_CACHEABLE_CONTROL);
        expect(result).toEqual({
            cacheControl: LISTING_CACHEABLE_CONTROL,
            cacheable: true,
            tagCount: 1
        });
        expect([...locals.cacheTags]).toEqual(['list-accom']);
    });

    it('marks a non-cacheable response private and registers nothing', () => {
        const locals = makeLocals();
        const headers = new Headers();

        const result = applyCacheHeaders({
            locals,
            headers,
            cacheable: false,
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
            tags: ['']
        });

        expect(headers.get('Cache-Control')).toBe(LISTING_PRIVATE_CONTROL);
        expect(result.cacheable).toBe(false);
        expect(result.tagCount).toBe(0);
    });
});

describe('isEdgeCacheableControl', () => {
    it.each([
        [LISTING_CACHEABLE_CONTROL, true],
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
