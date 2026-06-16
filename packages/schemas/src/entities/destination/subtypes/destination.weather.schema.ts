import { z } from 'zod';

/**
 * Internal weather condition, derived from Open-Meteo WMO `weather_code` values.
 *
 * Groups the documented WMO code set into a small, renderable enum. `unknown`
 * is the fallback for unmapped codes so the UI always has a label + icon.
 */
export const WeatherConditionEnum = z.enum([
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
]);
export type WeatherCondition = z.infer<typeof WeatherConditionEnum>;

/**
 * Live current conditions for a destination, mapped from the Open-Meteo
 * `current=...` block. Temperatures are Celsius; wind is km/h; humidity is a
 * 0-100 percentage. `weatherCode` is the raw WMO code; `condition` is its
 * mapped internal value.
 */
export const DestinationWeatherCurrentSchema = z.object({
    temperatureC: z.number().min(-90).max(70),
    apparentTemperatureC: z.number().min(-90).max(70),
    weatherCode: z.number().int().min(0).max(99),
    condition: WeatherConditionEnum,
    windSpeedKmh: z.number().min(0).max(500),
    humidityPct: z.number().int().min(0).max(100),
    isDay: z.boolean()
});
export type DestinationWeatherCurrent = z.infer<typeof DestinationWeatherCurrentSchema>;

/**
 * A single day of the daily forecast, mapped from the Open-Meteo `daily=...`
 * block. `date` is an ISO `YYYY-MM-DD` day. Precipitation is millimetres.
 */
export const DestinationWeatherDailySchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'zodError.destination.weather.date.format' }),
    tempMinC: z.number().min(-90).max(70),
    tempMaxC: z.number().min(-90).max(70),
    weatherCode: z.number().int().min(0).max(99),
    condition: WeatherConditionEnum,
    precipMm: z.number().min(0).max(2000)
});
export type DestinationWeatherDaily = z.infer<typeof DestinationWeatherDailySchema>;

/**
 * Cached weather payload stored on the `weather_current` JSONB column.
 *
 * Holds the live current conditions plus a daily forecast (up to 16 days,
 * Open-Meteo's free maximum) and the timestamp the cron last refreshed it.
 */
export const DestinationWeatherCacheSchema = z.object({
    current: DestinationWeatherCurrentSchema,
    daily: z.array(DestinationWeatherDailySchema).max(16),
    fetchedAt: z.string().datetime({ message: 'zodError.destination.weather.fetchedAt.format' })
});
export type DestinationWeatherCacheInput = z.infer<typeof DestinationWeatherCacheSchema>;
