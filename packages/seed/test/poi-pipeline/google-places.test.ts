import { describe, expect, it, vi } from 'vitest';
import {
    createGooglePlacesGeocoder,
    mapPlacesResult
} from '../../scripts/poi-pipeline/google-places.js';

function jsonResponse(status: number, body: unknown): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body
    } as unknown as Response;
}

const IN_REGION = {
    places: [
        {
            location: { latitude: -31.39, longitude: -58.02 },
            formattedAddress: 'Calle 1, Concordia, Entre Ríos, Argentina',
            displayName: { text: 'Museo Judío de Entre Ríos' }
        }
    ]
};

describe('mapPlacesResult', () => {
    it('maps an in-region result to a high-importance hit', () => {
        const hit = mapPlacesResult(IN_REGION.places[0], 'Entre Rios');
        expect(hit).toMatchObject({
            lat: -31.39,
            long: -58.02,
            provider: 'google-places',
            importance: 0.9
        });
    });

    it('rejects a right-name/wrong-province result (province guard)', () => {
        const place = {
            location: { latitude: -34.6, longitude: -58.4 },
            formattedAddress: 'Av. Corrientes 1000, Buenos Aires, Argentina',
            displayName: { text: 'Museo X' }
        };
        expect(mapPlacesResult(place, 'Entre Rios')).toBeNull();
    });

    it('matches the province accent-insensitively', () => {
        const place = {
            location: { latitude: -31.4, longitude: -58 },
            formattedAddress: 'Colón, Entre Ríos', // accented
            displayName: { text: 'X' }
        };
        expect(mapPlacesResult(place, 'Entre Rios')).not.toBeNull(); // guard is unaccented
    });

    it('returns null when the result has no coordinates', () => {
        expect(mapPlacesResult({ formattedAddress: 'Entre Ríos' }, 'Entre Rios')).toBeNull();
    });

    it('returns null for an absent result', () => {
        expect(mapPlacesResult(undefined, 'Entre Rios')).toBeNull();
    });
});

describe('createGooglePlacesGeocoder', () => {
    it('resolves an in-region place via searchText', async () => {
        const fetchFn = vi.fn(async () => jsonResponse(200, IN_REGION));
        const g = createGooglePlacesGeocoder({
            apiKey: 'k',
            maxRequests: 10,
            sleep: async () => {},
            fetchFn: fetchFn as unknown as typeof fetch
        });

        const hit = await g.resolve('Museo Judío, Concordia, Entre Ríos, Argentina');

        expect(hit?.provider).toBe('google-places');
        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('k');
    });

    it('throws when the hard request cap is reached (cost guard)', async () => {
        const fetchFn = vi.fn(async () => jsonResponse(200, { places: [] }));
        const g = createGooglePlacesGeocoder({
            apiKey: 'k',
            maxRequests: 1,
            sleep: async () => {},
            fetchFn: fetchFn as unknown as typeof fetch
        });

        await g.resolve('first'); // consumes the single allowed call
        await expect(g.resolve('second')).rejects.toThrow(/request cap of 1 reached/);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('returns null when Places has no match', async () => {
        const g = createGooglePlacesGeocoder({
            apiKey: 'k',
            maxRequests: 10,
            sleep: async () => {},
            fetchFn: (async () => jsonResponse(200, { places: [] })) as unknown as typeof fetch
        });
        expect(await g.resolve('nowhere')).toBeNull();
    });
});
