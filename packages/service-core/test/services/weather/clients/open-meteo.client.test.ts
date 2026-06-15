import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoClient } from '../../../../src/services/weather/clients/open-meteo.client.js';

const COORDS = { latitude: -32.48, longitude: -58.23 };

/** Builds a well-formed Open-Meteo forecast payload with `days` daily entries. */
const buildPayload = (days: number) => ({
    current: {
        temperature_2m: 21.4,
        apparent_temperature: 20.1,
        weather_code: 61,
        wind_speed_10m: 12.5,
        relative_humidity_2m: 72,
        is_day: 1
    },
    daily: {
        time: Array.from({ length: days }, (_, i) => `2026-06-${String(15 + i).padStart(2, '0')}`),
        temperature_2m_max: Array.from({ length: days }, () => 25),
        temperature_2m_min: Array.from({ length: days }, () => 14),
        weather_code: Array.from({ length: days }, () => 3),
        precipitation_sum: Array.from({ length: days }, () => 1.2)
    }
});

describe('OpenMeteoClient', () => {
    let client: OpenMeteoClient;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        client = new OpenMeteoClient();
        fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches and maps current + 16-day forecast on success', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => buildPayload(16)
        });

        const result = await client.fetchForecast(COORDS);

        expect(result.error).toBeUndefined();
        expect(result.weather).not.toBeNull();
        expect(result.weather?.daily).toHaveLength(16);
        // current.weather_code 61 -> rain
        expect(result.weather?.current.condition).toBe('rain');
        expect(result.weather?.current.temperatureC).toBe(21.4);
        expect(result.weather?.current.isDay).toBe(true);
        // daily weather_code 3 -> overcast
        expect(result.weather?.daily[0]?.condition).toBe('overcast');
        expect(result.weather?.daily[0]?.date).toBe('2026-06-15');

        // requested the 16-day daily forecast
        const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
        expect(calledUrl).toContain('forecast_days=16');
        expect(calledUrl).toContain('daily=');
    });

    it('returns a null weather with error on non-200', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({})
        });

        const result = await client.fetchForecast(COORDS);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('500');
    });

    it('returns a null weather with error when the request throws (timeout/abort)', async () => {
        fetchMock.mockRejectedValue(new Error('The operation was aborted'));

        const result = await client.fetchForecast(COORDS);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('request failed');
    });

    it('returns a null weather with error on a payload that fails validation', async () => {
        const bad = buildPayload(3);
        bad.current.relative_humidity_2m = 150; // out of 0-100 range

        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => bad
        });

        const result = await client.fetchForecast(COORDS);

        expect(result.weather).toBeNull();
        expect(result.error).toContain('validation');
    });
});
