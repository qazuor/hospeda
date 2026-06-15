import { type DestinationWeatherCacheInput, DestinationWeatherCacheSchema } from '@repo/schemas';
import { mapWmoCodeToCondition } from '../wmo-codes.js';
import type { OpenMeteoClientConfig, OpenMeteoCoordinates, OpenMeteoFetchResult } from './types.js';

const DEFAULT_BASE_URL = 'https://api.open-meteo.com';
const DEFAULT_TIMEOUT_MS = 10000;

/** Number of daily forecast days requested (Open-Meteo free maximum). */
const FORECAST_DAYS = 16;

const CURRENT_FIELDS =
    'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,is_day';
const DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum';

/**
 * Shape of the Open-Meteo `current` block we consume. Fields are optional at
 * parse time because the payload is external; missing fields are caught by the
 * final schema validation.
 */
interface OpenMeteoCurrentRaw {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
    is_day?: number;
}

interface OpenMeteoDailyRaw {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    precipitation_sum?: number[];
}

interface OpenMeteoForecastRaw {
    current?: OpenMeteoCurrentRaw;
    daily?: OpenMeteoDailyRaw;
}

/**
 * Thin client over the Open-Meteo forecast API.
 *
 * Fetches current conditions plus a 16-day daily forecast for a single
 * coordinate using native `fetch`, with no API key (non-commercial tier).
 * Maps WMO `weather_code` values to the internal condition enum and validates
 * the assembled payload against {@link DestinationWeatherCacheSchema}.
 *
 * @example
 * ```ts
 * const client = new OpenMeteoClient();
 * const { weather, error } = await client.fetchForecast({ latitude: -32.4, longitude: -58.2 });
 * ```
 */
export class OpenMeteoClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(config: OpenMeteoClientConfig = {}) {
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    /**
     * Fetches current conditions + 16-day daily forecast for one coordinate.
     *
     * @param coordinates - Latitude/longitude to fetch.
     * @returns A {@link OpenMeteoFetchResult}; `weather` is `null` on any error.
     */
    async fetchForecast(coordinates: OpenMeteoCoordinates): Promise<OpenMeteoFetchResult> {
        const fetchedAt = new Date();
        const url = this.buildUrl(coordinates);

        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) {
                return {
                    weather: null,
                    error: `Open-Meteo responded ${response.status} ${response.statusText}`,
                    fetchedAt
                };
            }

            const raw = (await response.json()) as OpenMeteoForecastRaw;
            const weather = this.mapResponse(raw, fetchedAt);
            const parsed = DestinationWeatherCacheSchema.safeParse(weather);
            if (!parsed.success) {
                return {
                    weather: null,
                    error: `Open-Meteo payload failed validation: ${parsed.error.message}`,
                    fetchedAt
                };
            }

            return { weather: parsed.data, fetchedAt };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            return { weather: null, error: `Open-Meteo request failed: ${message}`, fetchedAt };
        }
    }

    private buildUrl(coordinates: OpenMeteoCoordinates): string {
        const params = new URLSearchParams({
            latitude: String(coordinates.latitude),
            longitude: String(coordinates.longitude),
            current: CURRENT_FIELDS,
            daily: DAILY_FIELDS,
            forecast_days: String(FORECAST_DAYS),
            timezone: 'auto'
        });
        return `${this.baseUrl}/v1/forecast?${params.toString()}`;
    }

    private async fetchWithTimeout(url: string): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    private mapResponse(raw: OpenMeteoForecastRaw, fetchedAt: Date): DestinationWeatherCacheInput {
        const current = raw.current ?? {};
        const daily = raw.daily ?? {};
        const dates = daily.time ?? [];

        return {
            current: {
                temperatureC: current.temperature_2m ?? 0,
                apparentTemperatureC: current.apparent_temperature ?? 0,
                weatherCode: current.weather_code ?? 0,
                condition: mapWmoCodeToCondition({ weatherCode: current.weather_code ?? -1 }),
                windSpeedKmh: current.wind_speed_10m ?? 0,
                humidityPct: current.relative_humidity_2m ?? 0,
                isDay: current.is_day === 1
            },
            daily: dates.map((date, i) => {
                const weatherCode = daily.weather_code?.[i] ?? 0;
                return {
                    date,
                    tempMinC: daily.temperature_2m_min?.[i] ?? 0,
                    tempMaxC: daily.temperature_2m_max?.[i] ?? 0,
                    weatherCode,
                    condition: mapWmoCodeToCondition({ weatherCode }),
                    precipMm: daily.precipitation_sum?.[i] ?? 0
                };
            }),
            fetchedAt: fetchedAt.toISOString()
        };
    }
}
