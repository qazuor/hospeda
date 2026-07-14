import { describe, expect, it, vi } from 'vitest';
import {
    createNominatimGeocoder,
    parseNominatimBody
} from '../../scripts/poi-pipeline/geocoder.js';

/** A minimal fetch Response stand-in. */
function jsonResponse(status: number, body: unknown): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body
    } as unknown as Response;
}

/** A fake clock whose `sleep` advances `now`, so timing is deterministic. */
function fakeClock() {
    let current = 0;
    const sleepCalls: number[] = [];
    return {
        now: () => current,
        sleep: async (ms: number) => {
            sleepCalls.push(ms);
            current += ms;
        },
        sleepCalls,
        advance: (ms: number) => {
            current += ms;
        }
    };
}

const HIT = [
    {
        lat: '-31.392',
        lon: '-58.021',
        importance: 0.65,
        class: 'boundary',
        type: 'administrative',
        display_name: 'Municipalidad de Concordia'
    }
];

describe('parseNominatimBody', () => {
    it('maps the first result into a RawGeocodeHit', () => {
        const hit = parseNominatimBody(HIT);
        expect(hit).toMatchObject({
            lat: -31.392,
            long: -58.021,
            importance: 0.65,
            provider: 'nominatim'
        });
    });

    it('returns null for an empty array', () => {
        expect(parseNominatimBody([])).toBeNull();
    });

    it('returns null for a non-array body', () => {
        expect(parseNominatimBody({ error: 'x' })).toBeNull();
    });

    it('returns null when coordinates are not finite numbers', () => {
        expect(parseNominatimBody([{ lat: 'NaN', lon: 'x' }])).toBeNull();
    });
});

describe('createNominatimGeocoder', () => {
    it('sends a User-Agent header per Nominatim ToS', async () => {
        // Arrange
        const clock = fakeClock();
        const fetchFn = vi.fn(async () => jsonResponse(200, HIT));
        const geocoder = createNominatimGeocoder({
            userAgent: 'hospeda-poi-pipeline/1.0',
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act
        await geocoder.resolve('Municipalidad, Concordia, Entre Rios, Argentina');

        // Assert
        const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>)['User-Agent']).toBe(
            'hospeda-poi-pipeline/1.0'
        );
    });

    it('waits at least minIntervalMs between consecutive requests', async () => {
        // Arrange
        const clock = fakeClock();
        const fetchFn = vi.fn(async () => jsonResponse(200, HIT));
        const geocoder = createNominatimGeocoder({
            userAgent: 'ua',
            minIntervalMs: 1100,
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act — two back-to-back resolves
        await geocoder.resolve('a');
        await geocoder.resolve('b');

        // Assert — the second call slept the full interval; the first did not wait
        expect(clock.sleepCalls).toContain(1100);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('retries with backoff on 429 then succeeds', async () => {
        // Arrange
        const clock = fakeClock();
        const fetchFn = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(429, 'rate limited'))
            .mockResolvedValueOnce(jsonResponse(200, HIT));
        const geocoder = createNominatimGeocoder({
            userAgent: 'ua',
            backoffBaseMs: 1000,
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act
        const hit = await geocoder.resolve('a');

        // Assert
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(clock.sleepCalls).toContain(1000); // backoffBaseMs * 2^0
        expect(hit?.lat).toBe(-31.392);
    });

    it('throws after exhausting retries on persistent 5xx', async () => {
        // Arrange
        const clock = fakeClock();
        const fetchFn = vi.fn(async () => jsonResponse(503, 'down'));
        const geocoder = createNominatimGeocoder({
            userAgent: 'ua',
            maxRetries: 2,
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act & Assert
        await expect(geocoder.resolve('a')).rejects.toThrow(/gave up after 3 attempts/);
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it('returns null when the provider has no match', async () => {
        // Arrange
        const clock = fakeClock();
        const fetchFn = vi.fn(async () => jsonResponse(200, []));
        const geocoder = createNominatimGeocoder({
            userAgent: 'ua',
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act
        const hit = await geocoder.resolve('nowhere');

        // Assert
        expect(hit).toBeNull();
    });

    it('trips the hard run-time cap rather than hanging', async () => {
        // Arrange — cap 500ms; the 1100ms inter-request sleep pushes past it
        const clock = fakeClock();
        const fetchFn = vi.fn(async () => jsonResponse(200, HIT));
        const geocoder = createNominatimGeocoder({
            userAgent: 'ua',
            minIntervalMs: 1100,
            maxTotalRuntimeMs: 500,
            ...clock,
            fetchFn: fetchFn as unknown as typeof fetch
        });

        // Act — first resolve fine (t=0); second sleeps to t=1100; third trips the cap
        await geocoder.resolve('a');
        await geocoder.resolve('b');

        // Assert
        await expect(geocoder.resolve('c')).rejects.toThrow(/run-time cap of 500ms exceeded/);
    });
});
