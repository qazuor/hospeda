/**
 * Unit tests for WeatherFetcher.persist — HOS-154 per-destination error surfacing.
 *
 * Asserts that a failed fetch is reported with BOTH the destinationId and the
 * human-readable slug (the slug is what makes the soft-failure diagnosable), and
 * that dry-run never writes.
 */

import type { DestinationModel } from '@repo/db';
import type { Destination, DestinationWeatherCacheInput } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { OpenMeteoClient } from '../../src/services/weather/clients/open-meteo.client.js';
import type { DestinationFetchResult } from '../../src/services/weather/weather-fetcher.js';
import { WeatherFetcher } from '../../src/services/weather/weather-fetcher.js';

// persist() with dryRun touches neither dependency, so a minimal stub cast
// through `unknown` is enough — no `any` needed.
const stubClient = {} as unknown as OpenMeteoClient;
const stubModel = (update?: unknown): DestinationModel =>
    ({ update }) as unknown as DestinationModel;

const makeDestination = (id: string, slug: string): Destination =>
    ({ id, slug }) as unknown as Destination;

const validWeather: DestinationWeatherCacheInput = {
    current: {
        temperatureC: 20,
        apparentTemperatureC: 19,
        weatherCode: 0,
        condition: 'clear',
        windSpeedKmh: 10,
        humidityPct: 80,
        isDay: true
    },
    daily: [],
    fetchedAt: new Date().toISOString()
};

function makeFetcher() {
    return new WeatherFetcher({ openMeteoClient: stubClient, destinationModel: stubModel() });
}

describe('WeatherFetcher.persist per-destination error surfacing (HOS-154)', () => {
    it('reports a failed destination with its id AND slug', async () => {
        const results: DestinationFetchResult[] = [
            { destination: makeDestination('d1', 'colon'), weather: null, error: 'timeout' }
        ];

        const summary = await makeFetcher().persist(results, { dryRun: true });

        expect(summary.processed).toBe(1);
        expect(summary.updated).toBe(0);
        expect(summary.errors).toEqual([{ destinationId: 'd1', slug: 'colon', error: 'timeout' }]);
    });

    it('falls back to "unknown error" when a failure carries no error string', async () => {
        const results: DestinationFetchResult[] = [
            { destination: makeDestination('d2', 'chajari'), weather: null }
        ];

        const summary = await makeFetcher().persist(results, { dryRun: true });

        expect(summary.errors[0]).toEqual({
            destinationId: 'd2',
            slug: 'chajari',
            error: 'unknown error'
        });
    });

    it('counts successful fetches as updated and never writes on dry-run', async () => {
        const updateSpy = vi.fn();
        const fetcher = new WeatherFetcher({
            openMeteoClient: stubClient,
            destinationModel: stubModel(updateSpy)
        });
        const results: DestinationFetchResult[] = [
            { destination: makeDestination('d3', 'concordia'), weather: validWeather },
            { destination: makeDestination('d4', 'federacion'), weather: null, error: 'boom' }
        ];

        const summary = await fetcher.persist(results, { dryRun: true });

        expect(summary.processed).toBe(2);
        expect(summary.updated).toBe(1);
        expect(summary.errors).toHaveLength(1);
        expect(summary.errors[0]?.slug).toBe('federacion');
        expect(updateSpy).not.toHaveBeenCalled();
    });
});
