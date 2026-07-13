/**
 * Unit tests for OpenMeteoClient — HOS-154 retry/backoff behavior.
 *
 * Key assertions:
 * - Transient failures (network/abort, HTTP 429, HTTP 5xx) are retried up to
 *   `maxRetries` and recover when a later attempt succeeds.
 * - Terminal failures (HTTP 4xx other than 429, empty payload) are NOT retried.
 * - When every attempt fails, `weather` is null and the last error is returned.
 * - Never throws; `weather` is null on any failure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoClient } from '../../src/services/weather/clients/open-meteo.client.js';

// A minimal Open-Meteo forecast payload that passes DestinationWeatherCacheSchema.
const validRaw = {
    current: {
        temperature_2m: 20,
        apparent_temperature: 19,
        weather_code: 0,
        wind_speed_10m: 10,
        relative_humidity_2m: 80,
        is_day: 1
    },
    daily: {
        time: ['2026-07-13'],
        temperature_2m_max: [25],
        temperature_2m_min: [15],
        weather_code: [0],
        precipitation_sum: [0]
    }
};

const okResponse = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => validRaw
});

const statusResponse = (status: number) => ({
    ok: false,
    status,
    statusText: `status ${status}`,
    json: async () => ({}),
    text: async () => ''
});

const emptyPayloadResponse = () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ current: undefined, daily: { time: [] } })
});

const coords = { latitude: -32.4833, longitude: -58.2283 };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('OpenMeteoClient retry behavior (HOS-154)', () => {
    it('returns weather on the first attempt without retrying', async () => {
        fetchMock.mockResolvedValueOnce(okResponse());
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).not.toBeNull();
        expect(result.error).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a network/abort rejection and recovers', async () => {
        fetchMock
            .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            .mockResolvedValueOnce(okResponse());
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).not.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries HTTP 429 (rate limit) and recovers', async () => {
        fetchMock.mockResolvedValueOnce(statusResponse(429)).mockResolvedValueOnce(okResponse());
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).not.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries HTTP 5xx and recovers', async () => {
        fetchMock.mockResolvedValueOnce(statusResponse(503)).mockResolvedValueOnce(okResponse());
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).not.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry a terminal HTTP 4xx (400)', async () => {
        fetchMock.mockResolvedValue(statusResponse(400));
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('400');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry an empty payload (terminal)', async () => {
        fetchMock.mockResolvedValue(emptyPayloadResponse());
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('empty payload');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('exhausts maxRetries and returns the last error when every attempt fails', async () => {
        fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        const client = new OpenMeteoClient({ maxRetries: 2, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('request failed');
        // first attempt + 2 retries
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('honors maxRetries=0 (single attempt, no retry)', async () => {
        fetchMock.mockRejectedValue(new Error('boom'));
        const client = new OpenMeteoClient({ maxRetries: 0, retryBackoffMs: 0 });

        const result = await client.fetchForecast(coords);

        expect(result.weather).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
