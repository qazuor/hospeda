import type { WeatherCondition } from '@repo/schemas';

/**
 * Maps the documented Open-Meteo WMO `weather_code` values to the internal
 * {@link WeatherCondition} enum.
 *
 * Reference: WMO code table published at https://open-meteo.com/en/docs
 * (verified 2026-06-10). Codes not present in this table fall back to
 * `'unknown'` via {@link mapWmoCodeToCondition} so the UI always has a label.
 */
const WMO_CODE_TO_CONDITION: Readonly<Record<number, WeatherCondition>> = {
    0: 'clear',
    1: 'mainlyClear',
    2: 'partlyCloudy',
    3: 'overcast',
    45: 'fog',
    48: 'fog',
    51: 'drizzle',
    53: 'drizzle',
    55: 'drizzle',
    56: 'freezingRain',
    57: 'freezingRain',
    61: 'rain',
    63: 'rain',
    65: 'rain',
    66: 'freezingRain',
    67: 'freezingRain',
    71: 'snow',
    73: 'snow',
    75: 'snow',
    77: 'snowGrains',
    80: 'rainShowers',
    81: 'rainShowers',
    82: 'rainShowers',
    85: 'snowShowers',
    86: 'snowShowers',
    95: 'thunderstorm',
    96: 'thunderstormHail',
    99: 'thunderstormHail'
} as const;

/**
 * Resolves an Open-Meteo WMO `weather_code` to an internal weather condition.
 *
 * @param input - Object carrying the raw WMO `weatherCode`.
 * @returns The mapped {@link WeatherCondition}, or `'unknown'` for unmapped codes.
 */
export const mapWmoCodeToCondition = (input: { weatherCode: number }): WeatherCondition => {
    return WMO_CODE_TO_CONDITION[input.weatherCode] ?? 'unknown';
};
