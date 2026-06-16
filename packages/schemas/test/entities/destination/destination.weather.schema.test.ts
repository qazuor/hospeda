import { describe, expect, it } from 'vitest';
import {
    DestinationWeatherCacheSchema,
    DestinationWeatherCurrentSchema,
    DestinationWeatherDailySchema,
    WeatherConditionEnum
} from '../../../src/entities/destination/subtypes/destination.weather.schema.js';

const validCurrent = {
    temperatureC: 21.4,
    apparentTemperatureC: 20.1,
    weatherCode: 61,
    condition: 'rain' as const,
    windSpeedKmh: 12.5,
    humidityPct: 72,
    isDay: true
};

const validDay = {
    date: '2026-06-15',
    tempMinC: 14,
    tempMaxC: 25,
    weatherCode: 3,
    condition: 'overcast' as const,
    precipMm: 1.2
};

/**
 * Tests for the SPEC-215 weather schemas: current conditions, daily forecast
 * entries, the WMO-derived condition enum, and the cache wrapper (daily ≤ 16).
 */
describe('weather schemas', () => {
    it('accepts valid current conditions', () => {
        expect(DestinationWeatherCurrentSchema.safeParse(validCurrent).success).toBe(true);
    });

    it('rejects humidity outside 0-100', () => {
        expect(
            DestinationWeatherCurrentSchema.safeParse({ ...validCurrent, humidityPct: 150 }).success
        ).toBe(false);
    });

    it('rejects a daily entry with a malformed date', () => {
        expect(
            DestinationWeatherDailySchema.safeParse({ ...validDay, date: '15/06/2026' }).success
        ).toBe(false);
    });

    it('includes unknown as a fallback condition', () => {
        expect(WeatherConditionEnum.options).toContain('unknown');
        expect(WeatherConditionEnum.options).toHaveLength(15);
    });

    it('accepts a cache with up to 16 daily entries', () => {
        const daily = Array.from({ length: 16 }, (_, i) => ({
            ...validDay,
            date: `2026-06-${String(15 + (i % 15)).padStart(2, '0')}`
        }));
        const result = DestinationWeatherCacheSchema.safeParse({
            current: validCurrent,
            daily,
            fetchedAt: '2026-06-15T12:00:00.000Z'
        });
        expect(result.success).toBe(true);
    });

    it('rejects a cache with more than 16 daily entries', () => {
        const daily = Array.from({ length: 17 }, () => validDay);
        const result = DestinationWeatherCacheSchema.safeParse({
            current: validCurrent,
            daily,
            fetchedAt: '2026-06-15T12:00:00.000Z'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a cache with a non-ISO fetchedAt', () => {
        const result = DestinationWeatherCacheSchema.safeParse({
            current: validCurrent,
            daily: [validDay],
            fetchedAt: 'yesterday'
        });
        expect(result.success).toBe(false);
    });
});
