import type { DestinationModel } from '@repo/db';
import type { Destination, DestinationWeatherCacheInput } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenMeteoClient } from '../../../src/services/weather/clients/open-meteo.client.js';
import { WeatherFetcher } from '../../../src/services/weather/weather-fetcher.js';

const WEATHER: DestinationWeatherCacheInput = {
    current: {
        temperatureC: 20,
        apparentTemperatureC: 19,
        weatherCode: 0,
        condition: 'clear',
        windSpeedKmh: 5,
        humidityPct: 60,
        isDay: true
    },
    daily: [],
    fetchedAt: '2026-06-15T12:00:00.000Z'
};

const destination = (id: string, lat?: string, long?: string): Destination =>
    ({
        id,
        location: lat && long ? { coordinates: { lat, long } } : {}
    }) as unknown as Destination;

const makeModel = (items: Destination[]) => {
    const update = vi.fn().mockResolvedValue(null);
    const findAll = vi.fn().mockResolvedValue({ items, total: items.length });
    return { model: { findAll, update } as unknown as DestinationModel, update, findAll };
};

const makeClient = (weather: DestinationWeatherCacheInput | null, error?: string) => {
    const fetchForecast = vi.fn().mockResolvedValue({ weather, error, fetchedAt: new Date() });
    return { client: { fetchForecast } as unknown as OpenMeteoClient, fetchForecast };
};

describe('WeatherFetcher.fetchAndStoreAll', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('fetches and stores for each published destination with coordinates', async () => {
        const { model, update } = makeModel([
            destination('a', '-32.4', '-58.2'),
            destination('b', '-31.0', '-60.0')
        ]);
        const { client } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const summary = await fetcher.fetchAndStoreAll({ dryRun: false });

        expect(summary.processed).toBe(2);
        expect(summary.updated).toBe(2);
        expect(summary.errors).toHaveLength(0);
        expect(update).toHaveBeenCalledTimes(2);
        expect(update).toHaveBeenCalledWith({ id: 'a' }, { weatherCurrent: WEATHER });
    });

    it('does not persist in dry-run mode', async () => {
        const { model, update } = makeModel([destination('a', '-32.4', '-58.2')]);
        const { client } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const summary = await fetcher.fetchAndStoreAll({ dryRun: true });

        expect(summary.processed).toBe(1);
        expect(summary.updated).toBe(1);
        expect(update).not.toHaveBeenCalled();
    });

    it('skips destinations without coordinates', async () => {
        const { model } = makeModel([destination('a'), destination('b', '-31', '-60')]);
        const { client, fetchForecast } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const summary = await fetcher.fetchAndStoreAll({ dryRun: false });

        expect(summary.processed).toBe(1);
        expect(fetchForecast).toHaveBeenCalledTimes(1);
    });

    it('tolerates a per-destination fetch failure and continues', async () => {
        const { model, update } = makeModel([
            destination('a', '-32.4', '-58.2'),
            destination('b', '-31.0', '-60.0')
        ]);
        const fetchForecast = vi
            .fn()
            .mockResolvedValueOnce({ weather: null, error: 'timeout', fetchedAt: new Date() })
            .mockResolvedValueOnce({ weather: WEATHER, fetchedAt: new Date() });
        const client = { fetchForecast } as unknown as OpenMeteoClient;
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const summary = await fetcher.fetchAndStoreAll({ dryRun: false });

        expect(summary.processed).toBe(2);
        expect(summary.updated).toBe(1);
        expect(summary.errors).toEqual([{ destinationId: 'a', error: 'timeout' }]);
        expect(update).toHaveBeenCalledTimes(1);
    });
});
