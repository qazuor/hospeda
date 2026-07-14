import { describe, expect, it, vi } from 'vitest';
import type { CacheIO } from '../../scripts/poi-pipeline/cache.js';
import { createCachedGeocoder } from '../../scripts/poi-pipeline/cache.js';
import type { Geocoder, RawGeocodeHit } from '../../scripts/poi-pipeline/geocoder.js';

const HIT: RawGeocodeHit = {
    lat: -31.4,
    long: -58,
    importance: 0.6,
    featureClass: 'place',
    featureType: 'town',
    displayName: 'X',
    provider: 'nominatim'
};

/** An in-memory CacheIO seam (no filesystem). */
function memoryIO(initial: string | null = null): CacheIO & { contents: string | null } {
    const state = { contents: initial };
    return {
        get contents() {
            return state.contents;
        },
        read: () => state.contents,
        write: (c) => {
            state.contents = c;
        }
    };
}

describe('createCachedGeocoder', () => {
    it('makes ZERO network calls when every address is already warm (idempotency)', async () => {
        // Arrange — pre-warmed cache file
        const io = memoryIO(JSON.stringify({ 'plaza, entre rios': HIT }));
        const inner: Geocoder = { resolve: vi.fn(async () => HIT) };
        const cached = createCachedGeocoder({ geocoder: inner, io });

        // Act
        const hit = await cached.resolve('plaza, entre rios');

        // Assert
        expect(hit).toEqual(HIT);
        expect(inner.resolve).not.toHaveBeenCalled();
        expect(cached.networkCalls).toBe(0);
    });

    it('resolves a miss once, persists it, and never re-queries it', async () => {
        // Arrange
        const io = memoryIO();
        const inner: Geocoder = { resolve: vi.fn(async () => HIT) };
        const cached = createCachedGeocoder({ geocoder: inner, io });

        // Act — same address twice
        await cached.resolve('museo, entre rios');
        await cached.resolve('museo, entre rios');

        // Assert — provider hit exactly once; entry persisted
        expect(inner.resolve).toHaveBeenCalledTimes(1);
        expect(cached.networkCalls).toBe(1);
        expect(io.contents).toContain('museo, entre rios');
    });

    it('caches a null (no-match) result so a known-empty address is not re-queried', async () => {
        // Arrange
        const io = memoryIO();
        const inner: Geocoder = { resolve: vi.fn(async () => null) };
        const cached = createCachedGeocoder({ geocoder: inner, io });

        // Act
        const first = await cached.resolve('nowhere');
        const second = await cached.resolve('nowhere');

        // Assert
        expect(first).toBeNull();
        expect(second).toBeNull();
        expect(inner.resolve).toHaveBeenCalledTimes(1);
    });

    it('round-trips a persisted cache into a fresh instance (no re-query)', async () => {
        // Arrange — first instance resolves and persists
        const io = memoryIO();
        const inner1: Geocoder = { resolve: vi.fn(async () => HIT) };
        const first = createCachedGeocoder({ geocoder: inner1, io });
        await first.resolve('costanera, entre rios');

        // Act — a fresh instance reading the same persisted contents
        const inner2: Geocoder = { resolve: vi.fn(async () => HIT) };
        const second = createCachedGeocoder({ geocoder: inner2, io });
        const hit = await second.resolve('costanera, entre rios');

        // Assert
        expect(hit).toEqual(HIT);
        expect(inner2.resolve).not.toHaveBeenCalled();
        expect(second.networkCalls).toBe(0);
    });
});
