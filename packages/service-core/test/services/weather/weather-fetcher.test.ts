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
        // Third arg is the optional `tx` passthrough — undefined here since
        // fetchAndStoreAll() (unlike persist() called directly) never opens one.
        expect(update).toHaveBeenCalledWith({ id: 'a' }, { weatherCurrent: WEATHER }, undefined);
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

    it('completes ALL remote fetches before performing any DB write (two-phase, no interleaving)', async () => {
        // Arrange: record the order of operations. If fetch and persist were
        // still interleaved (one destination at a time, as before the fix),
        // this would record fetch/update/fetch/update instead of
        // fetch/fetch/update/update — the pattern that allowed a transaction
        // wrapped around the whole call to sit idle across each remote fetch.
        const callOrder: string[] = [];
        const { model, update } = makeModel([
            destination('a', '-32.4', '-58.2'),
            destination('b', '-31.0', '-60.0')
        ]);
        update.mockImplementation(async () => {
            callOrder.push('update');
        });
        const fetchForecast = vi.fn().mockImplementation(async () => {
            callOrder.push('fetch');
            return { weather: WEATHER, fetchedAt: new Date() };
        });
        const client = { fetchForecast } as unknown as OpenMeteoClient;
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        await fetcher.fetchAndStoreAll({ dryRun: false });

        expect(callOrder).toEqual(['fetch', 'fetch', 'update', 'update']);
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

describe('WeatherFetcher.fetchAll / persist (two-phase public API)', () => {
    beforeEach(() => vi.restoreAllMocks());

    it('fetchAll() performs no DB writes — only the read used to list destinations', async () => {
        const { model, update } = makeModel([destination('a', '-32.4', '-58.2')]);
        const { client } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const results = await fetcher.fetchAll();

        expect(results).toEqual([
            { destination: destination('a', '-32.4', '-58.2'), weather: WEATHER }
        ]);
        expect(update).not.toHaveBeenCalled();
    });

    it('persist() forwards the given tx to every DestinationModel.update call', async () => {
        const { model, update } = makeModel([
            destination('a', '-32.4', '-58.2'),
            destination('b', '-31.0', '-60.0')
        ]);
        const { client } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });
        const fakeTx = { __isTx: true } as unknown as Parameters<typeof fetcher.persist>[1]['tx'];

        const results = await fetcher.fetchAll();
        const summary = await fetcher.persist(results, { dryRun: false, tx: fakeTx });

        expect(summary.updated).toBe(2);
        expect(update).toHaveBeenCalledWith({ id: 'a' }, { weatherCurrent: WEATHER }, fakeTx);
        expect(update).toHaveBeenCalledWith({ id: 'b' }, { weatherCurrent: WEATHER }, fakeTx);
    });

    it('persist() with dryRun never calls DestinationModel.update, even with a tx provided', async () => {
        const { model, update } = makeModel([destination('a', '-32.4', '-58.2')]);
        const { client } = makeClient(WEATHER);
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });
        const fakeTx = { __isTx: true } as unknown as Parameters<typeof fetcher.persist>[1]['tx'];

        const results = await fetcher.fetchAll();
        const summary = await fetcher.persist(results, { dryRun: true, tx: fakeTx });

        expect(summary.updated).toBe(1);
        expect(update).not.toHaveBeenCalled();
    });

    it('fetchAll() completes fully before persist() is ever invoked (caller-controlled phase separation)', async () => {
        // This is the invariant the cron job relies on: it calls fetchAll()
        // with no transaction open, THEN opens a short transaction and calls
        // persist() inside it. Demonstrated here by awaiting fetchAll() to
        // completion (recording every fetch call) before persist() runs at all.
        const callOrder: string[] = [];
        const { model, update } = makeModel([
            destination('a', '-32.4', '-58.2'),
            destination('b', '-31.0', '-60.0')
        ]);
        update.mockImplementation(async () => {
            callOrder.push('update');
        });
        const fetchForecast = vi.fn().mockImplementation(async () => {
            callOrder.push('fetch');
            return { weather: WEATHER, fetchedAt: new Date() };
        });
        const client = { fetchForecast } as unknown as OpenMeteoClient;
        const fetcher = new WeatherFetcher({ openMeteoClient: client, destinationModel: model });

        const results = await fetcher.fetchAll();
        expect(callOrder).toEqual(['fetch', 'fetch']);

        await fetcher.persist(results, { dryRun: false });
        expect(callOrder).toEqual(['fetch', 'fetch', 'update', 'update']);
    });
});
