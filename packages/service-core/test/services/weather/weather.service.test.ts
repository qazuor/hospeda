import type { Destination, DestinationWeatherCacheInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { DestinationService } from '../../../src/services/destination/destination.service.js';
import { WeatherService } from '../../../src/services/weather/weather.service.js';
import type { Actor } from '../../../src/types/index.js';

const ACTOR = { id: 'guest', role: 'GUEST', permissions: [] } as unknown as Actor;

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

const makeService = (getById: ReturnType<typeof vi.fn>) =>
    new WeatherService({
        destinationService: { getById } as unknown as DestinationService
    });

describe('WeatherService.getCachedWeather', () => {
    it('returns the cached weather when present', async () => {
        const getById = vi
            .fn()
            .mockResolvedValue({ data: { weatherCurrent: WEATHER } as Destination });
        const service = makeService(getById);

        const result = await service.getCachedWeather(ACTOR, { destinationId: 'd1' });

        expect(result).toEqual(WEATHER);
        expect(getById).toHaveBeenCalledWith(ACTOR, 'd1');
    });

    it('returns null when the destination has no cached weather', async () => {
        const getById = vi
            .fn()
            .mockResolvedValue({ data: { weatherCurrent: null } as Destination });
        const service = makeService(getById);

        const result = await service.getCachedWeather(ACTOR, { destinationId: 'd1' });

        expect(result).toBeNull();
    });

    it('throws when the destination is not visible (error surfaced by getById)', async () => {
        const getById = vi.fn().mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' }
        });
        const service = makeService(getById);

        await expect(service.getCachedWeather(ACTOR, { destinationId: 'x' })).rejects.toThrow(
            /not found/i
        );
    });
});
