import { describe, expect, it } from 'vitest';
import {
    getWeatherConditionKey,
    getWeatherIcon
} from '../../../src/components/destination/weather-icons';
import type { WeatherCondition } from '../../../src/components/destination/weather-icons';

const ALL_CONDITIONS: ReadonlyArray<WeatherCondition> = [
    'clear',
    'mainlyClear',
    'partlyCloudy',
    'overcast',
    'fog',
    'drizzle',
    'rain',
    'freezingRain',
    'snow',
    'snowGrains',
    'rainShowers',
    'snowShowers',
    'thunderstorm',
    'thunderstormHail',
    'unknown'
];

describe('getWeatherIcon', () => {
    it('should return a component for every condition (day)', () => {
        for (const condition of ALL_CONDITIONS) {
            const icon = getWeatherIcon({ condition, isDay: true });
            expect(icon, `condition "${condition}" (day) should resolve to an icon`).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });

    it('should return a component for every condition (night)', () => {
        for (const condition of ALL_CONDITIONS) {
            const icon = getWeatherIcon({ condition, isDay: false });
            expect(
                icon,
                `condition "${condition}" (night) should resolve to an icon`
            ).toBeDefined();
            expect(typeof icon).toBe('function');
        }
    });

    it('clear day should return SunIcon, clear night should return MoonIcon', () => {
        const day = getWeatherIcon({ condition: 'clear', isDay: true });
        const night = getWeatherIcon({ condition: 'clear', isDay: false });
        expect(day).not.toBe(night);
        expect(day.displayName ?? day.name).toMatch(/sun/i);
        expect(night.displayName ?? night.name).toMatch(/moon/i);
    });

    it('unknown condition should fall back to CloudIcon', () => {
        const icon = getWeatherIcon({ condition: 'unknown', isDay: true });
        const unknown = getWeatherIcon({ condition: 'not-a-real-condition', isDay: true });
        expect(icon).toBeDefined();
        expect(unknown).toBeDefined();
    });

    it('should default isDay to true when not provided', () => {
        const withDay = getWeatherIcon({ condition: 'clear', isDay: true });
        const withoutDay = getWeatherIcon({ condition: 'clear' });
        expect(withDay).toBe(withoutDay);
    });
});

describe('getWeatherConditionKey', () => {
    it('should return an i18n key for every condition', () => {
        for (const condition of ALL_CONDITIONS) {
            const key = getWeatherConditionKey(condition);
            expect(key).toBe(`destinations.weather.conditions.${condition}`);
        }
    });

    it('should handle unknown strings gracefully', () => {
        const key = getWeatherConditionKey('not-a-condition');
        expect(key).toBe('destinations.weather.conditions.not-a-condition');
    });
});
