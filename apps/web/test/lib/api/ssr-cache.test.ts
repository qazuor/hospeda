/**
 * @file ssr-cache.test.ts
 * @description Unit tests for the short-TTL SSR request cache (HOS-103).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearSsrCache,
    getOrSetCached,
    SSR_CACHE_MAX_ENTRIES,
    SSR_PUBLIC_CACHE_TTL_MS,
    ssrCacheSize
} from '../../../src/lib/api/ssr-cache';

/** Creates a mutable clock whose value the test controls. */
function makeClock(start = 1_000): { now: () => number; advance: (ms: number) => void } {
    let current = start;
    return {
        now: () => current,
        advance: (ms: number) => {
            current += ms;
        }
    };
}

describe('ssr-cache', () => {
    afterEach(() => {
        clearSsrCache();
    });

    it('exposes a 60s default TTL', () => {
        // Arrange / Act / Assert
        expect(SSR_PUBLIC_CACHE_TTL_MS).toBe(60_000);
    });

    it('runs the loader on a miss and returns its value', async () => {
        // Arrange
        const loader = vi.fn(async () => 'fresh');

        // Act
        const value = await getOrSetCached({ key: 'k', ttlMs: 1000, loader });

        // Assert
        expect(value).toBe('fresh');
        expect(loader).toHaveBeenCalledTimes(1);
        expect(ssrCacheSize()).toBe(1);
    });

    it('serves a cached value within the TTL without re-running the loader', async () => {
        // Arrange
        const clock = makeClock();
        const loader = vi.fn(async () => Math.random());

        // Act
        const first = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, now: clock.now });
        clock.advance(999);
        const second = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, now: clock.now });

        // Assert
        expect(second).toBe(first);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('recomputes once the TTL has elapsed', async () => {
        // Arrange
        const clock = makeClock();
        let counter = 0;
        const loader = vi.fn(async () => ++counter);

        // Act
        const first = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, now: clock.now });
        clock.advance(1001);
        const second = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, now: clock.now });

        // Assert
        expect(first).toBe(1);
        expect(second).toBe(2);
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('de-duplicates concurrent in-flight requests for the same key', async () => {
        // Arrange: a loader that only resolves when we tell it to.
        let resolveLoader: (v: string) => void = () => {};
        const loader = vi.fn(
            () =>
                new Promise<string>((resolve) => {
                    resolveLoader = resolve;
                })
        );

        // Act: two overlapping calls before the loader settles.
        const p1 = getOrSetCached({ key: 'k', ttlMs: 1000, loader });
        const p2 = getOrSetCached({ key: 'k', ttlMs: 1000, loader });
        resolveLoader('shared');
        const [v1, v2] = await Promise.all([p1, p2]);

        // Assert: one fetch, both callers get the same value.
        expect(loader).toHaveBeenCalledTimes(1);
        expect(v1).toBe('shared');
        expect(v2).toBe('shared');
    });

    it('keeps separate entries for different keys', async () => {
        // Arrange
        const loader = vi.fn(async (): Promise<string> => 'v');

        // Act
        await getOrSetCached({ key: 'a', ttlMs: 1000, loader });
        await getOrSetCached({ key: 'b', ttlMs: 1000, loader });

        // Assert
        expect(loader).toHaveBeenCalledTimes(2);
        expect(ssrCacheSize()).toBe(2);
    });

    it('does not cache a result rejected by isCacheable', async () => {
        // Arrange
        const loader = vi.fn(async () => ({ ok: false as const }));

        // Act
        await getOrSetCached({
            key: 'k',
            ttlMs: 1000,
            loader,
            isCacheable: (r) => r.ok === true
        });
        await getOrSetCached({
            key: 'k',
            ttlMs: 1000,
            loader,
            isCacheable: (r) => r.ok === true
        });

        // Assert: nothing stored, loader retried each call.
        expect(loader).toHaveBeenCalledTimes(2);
        expect(ssrCacheSize()).toBe(0);
    });

    it('retries after an in-flight load settles to a non-cacheable value', async () => {
        // Arrange: first result not cacheable, second one cacheable.
        const results = [{ ok: false as const }, { ok: true as const }];
        const loader = vi.fn(async () => results.shift() ?? { ok: true as const });
        const isCacheable = (r: { ok: boolean }) => r.ok === true;

        // Act
        const first = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, isCacheable });
        const second = await getOrSetCached({ key: 'k', ttlMs: 1000, loader, isCacheable });

        // Assert
        expect(first.ok).toBe(false);
        expect(second.ok).toBe(true);
        expect(loader).toHaveBeenCalledTimes(2);
        expect(ssrCacheSize()).toBe(1);
    });

    it('caps the resolved store at SSR_CACHE_MAX_ENTRIES', async () => {
        // Arrange / Act: insert more distinct keys than the cap allows.
        for (let i = 0; i < SSR_CACHE_MAX_ENTRIES + 5; i++) {
            await getOrSetCached({ key: `k${i}`, ttlMs: 60_000, loader: async () => i });
        }

        // Assert: eviction kept the store bounded.
        expect(ssrCacheSize()).toBeLessThanOrEqual(SSR_CACHE_MAX_ENTRIES);
    });

    it('clearSsrCache empties the store', async () => {
        // Arrange
        await getOrSetCached({ key: 'k', ttlMs: 1000, loader: async () => 'v' });
        expect(ssrCacheSize()).toBe(1);

        // Act
        clearSsrCache();

        // Assert
        expect(ssrCacheSize()).toBe(0);
    });
});
