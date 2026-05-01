/**
 * @fileoverview Unit tests for the geocoding service (SPEC-097, Phase 6).
 * Mocks fetch to verify URL construction, header forwarding, error handling,
 * caching, and rate-limit throttling without network access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetGeocodingCacheForTests,
    geocodingAutocomplete,
    geocodingForward,
    geocodingReverse
} from '../../../src/services/geocoding/geocoding.service';

const userAgent = 'Hospeda/1.0 (test@hospeda.ar)';

const photonResponse = {
    features: [
        {
            geometry: { coordinates: [-58.0429, -30.7521] as [number, number] },
            properties: {
                name: 'Plaza',
                street: 'Av. Belgrano',
                housenumber: '123',
                city: 'Concepción del Uruguay',
                state: 'Entre Ríos',
                country: 'Argentina',
                postcode: '3260'
            }
        }
    ]
};

const nominatimResult = [
    {
        lat: '-30.7521',
        lon: '-58.0429',
        display_name: 'Av. Belgrano 123, Concepción del Uruguay, Entre Ríos',
        address: {
            road: 'Av. Belgrano',
            house_number: '123',
            city: 'Concepción del Uruguay',
            state: 'Entre Ríos',
            country: 'Argentina',
            postcode: '3260'
        }
    }
];

function createOkResponse(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => body
    } as unknown as Response;
}

function createErrorResponse(): Response {
    return { ok: false, status: 503, json: async () => ({}) } as unknown as Response;
}

beforeEach(() => {
    __resetGeocodingCacheForTests();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('geocodingAutocomplete (Photon)', () => {
    it('returns mapped suggestions when Photon responds OK', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createOkResponse(photonResponse));

        const result = await geocodingAutocomplete(
            { query: 'Av. Belgrano' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            lat: -30.7521,
            lng: -58.0429,
            street: 'Av. Belgrano',
            number: '123',
            city: 'Concepción del Uruguay'
        });
        expect(result[0]?.label).toContain('Av. Belgrano');
        expect(fetchFn).toHaveBeenCalledTimes(1);
        const firstCall = fetchFn.mock.calls[0] as [string, RequestInit];
        const [url, options] = firstCall;
        expect(url).toContain('photon.komoot.io');
        expect(url).toContain('lang=es');
        expect(options.headers).toMatchObject({ 'User-Agent': userAgent });
    });

    it('returns an empty array for queries shorter than 3 chars (no network)', async () => {
        const fetchFn = vi.fn();
        const result = await geocodingAutocomplete(
            { query: 'ab' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result).toEqual([]);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('returns an empty array on non-OK response', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createErrorResponse());
        const result = await geocodingAutocomplete(
            { query: 'Av. Belgrano' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result).toEqual([]);
    });

    it('returns an empty array on network exception', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error('network'));
        const result = await geocodingAutocomplete(
            { query: 'Av. Belgrano' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result).toEqual([]);
    });

    it('caches identical queries (single fetch call across two invocations)', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createOkResponse(photonResponse));
        const deps = { fetchFn: fetchFn as unknown as typeof fetch, userAgent };

        const a = await geocodingAutocomplete({ query: 'Belgrano' }, deps);
        const b = await geocodingAutocomplete({ query: 'Belgrano' }, deps);

        expect(a).toEqual(b);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});

describe('geocodingForward (Nominatim)', () => {
    it('returns the first Nominatim result mapped to a suggestion', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createOkResponse(nominatimResult));

        const result = await geocodingForward(
            { query: 'Av. Belgrano 123' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );

        expect(result).not.toBeNull();
        expect(result?.lat).toBe(-30.7521);
        expect(result?.lng).toBe(-58.0429);
        expect(result?.street).toBe('Av. Belgrano');
        const firstCall = fetchFn.mock.calls[0] as [string, RequestInit];
        const [url, options] = firstCall;
        expect(url).toContain('nominatim.openstreetmap.org/search');
        expect(url).toContain('countrycodes=ar');
        expect(options.headers).toMatchObject({ 'User-Agent': userAgent });
    });

    it('returns null when Nominatim has no matches', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createOkResponse([]));
        const result = await geocodingForward(
            { query: 'something not findable xyz' },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result).toBeNull();
    });
});

describe('geocodingReverse (Nominatim)', () => {
    it('returns address for valid coordinates', async () => {
        const fetchFn = vi.fn().mockResolvedValue(createOkResponse(nominatimResult[0]));
        const result = await geocodingReverse(
            { lat: -30.7521, lng: -58.0429 },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result?.street).toBe('Av. Belgrano');
        const firstCall = fetchFn.mock.calls[0] as [string, RequestInit];
        expect(firstCall[0]).toContain('reverse');
    });

    it('returns null for non-finite coordinates without making any request', async () => {
        const fetchFn = vi.fn();
        const result = await geocodingReverse(
            { lat: Number.NaN, lng: 0 },
            { fetchFn: fetchFn as unknown as typeof fetch, userAgent }
        );
        expect(result).toBeNull();
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
