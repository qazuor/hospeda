import { type DestinationWeatherCacheInput, DestinationWeatherCacheSchema } from '@repo/schemas';
import { mapWmoCodeToCondition } from '../wmo-codes.js';
import type { OpenMeteoClientConfig, OpenMeteoCoordinates, OpenMeteoFetchResult } from './types.js';

const DEFAULT_BASE_URL = 'https://api.open-meteo.com';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 500;

/**
 * Outcome of a single Open-Meteo attempt. `retryable` marks failures that a
 * subsequent attempt might recover (transient: request timeout/abort, network
 * error, HTTP 429, HTTP 5xx). Non-transient failures (HTTP 4xx other than 429,
 * empty payload, schema validation) are terminal and never retried.
 */
interface OpenMeteoAttemptResult extends OpenMeteoFetchResult {
    retryable: boolean;
}

/** Resolves after `ms` milliseconds. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Number of daily forecast days requested (Open-Meteo free maximum).
 *
 * Must stay ≤ the `daily` array cap in `DestinationWeatherCacheSchema` (.max(16));
 * raising this past 16 without widening the schema makes every fetch fail validation.
 */
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
    private readonly maxRetries: number;
    private readonly retryBackoffMs: number;

    constructor(config: OpenMeteoClientConfig = {}) {
        this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
        this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
        this.retryBackoffMs = config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    }

    /**
     * Fetches current conditions + 16-day daily forecast for one coordinate,
     * retrying transient failures with exponential backoff.
     *
     * A transient failure (request timeout/abort, network error, HTTP 429, HTTP
     * 5xx) is retried up to {@link OpenMeteoClientConfig.maxRetries} times — this
     * is what tolerates the intermittent event-loop-starvation timeouts the cron
     * hits when the API process is under load (HOS-154). Terminal failures (HTTP
     * 4xx other than 429, empty payload, schema validation) return immediately.
     *
     * @param coordinates - Latitude/longitude to fetch.
     * @returns A {@link OpenMeteoFetchResult}; `weather` is `null` on any error,
     *   carrying the last attempt's error message.
     */
    async fetchForecast(coordinates: OpenMeteoCoordinates): Promise<OpenMeteoFetchResult> {
        const url = this.buildUrl(coordinates);
        let last: OpenMeteoAttemptResult = await this.fetchForecastOnce(url);

        for (
            let attempt = 0;
            last.weather === null && last.retryable && attempt < this.maxRetries;
            attempt += 1
        ) {
            await sleep(this.retryBackoffMs * 2 ** attempt);
            last = await this.fetchForecastOnce(url);
        }

        return { weather: last.weather, error: last.error, fetchedAt: last.fetchedAt };
    }

    /** A single Open-Meteo attempt. Classifies failures as retryable or terminal. */
    private async fetchForecastOnce(url: string): Promise<OpenMeteoAttemptResult> {
        const fetchedAt = new Date();

        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) {
                // 429 (rate limit) and 5xx (server) are transient; other 4xx are terminal.
                const retryable = response.status === 429 || response.status >= 500;
                return {
                    weather: null,
                    error: `Open-Meteo responded ${response.status} ${response.statusText}`,
                    fetchedAt,
                    retryable
                };
            }

            const raw = (await response.json()) as OpenMeteoForecastRaw;
            // Guard against a 200 with a missing/empty payload (e.g. a proxy or a
            // partial response): mapping it would fabricate plausible 0°C / unknown
            // data. Treat it as a failure so the cron keeps the last good cache.
            if (!raw.current || !raw.daily?.time || raw.daily.time.length === 0) {
                return {
                    weather: null,
                    error: 'Open-Meteo returned an empty payload',
                    fetchedAt,
                    retryable: false
                };
            }
            const weather = this.mapResponse(raw, fetchedAt);
            const parsed = DestinationWeatherCacheSchema.safeParse(weather);
            if (!parsed.success) {
                return {
                    weather: null,
                    error: `Open-Meteo payload failed validation: ${parsed.error.message}`,
                    fetchedAt,
                    retryable: false
                };
            }

            return { weather: parsed.data, fetchedAt, retryable: false };
        } catch (error) {
            // fetch() rejects on network error or on abort (our timeout) — both transient.
            const message = error instanceof Error ? error.message : 'unknown error';
            return {
                weather: null,
                error: `Open-Meteo request failed: ${message}`,
                fetchedAt,
                retryable: true
            };
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
                // Open-Meteo returns 1/0; tolerate a boolean just in case.
                isDay: current.is_day === 1 || (current.is_day as unknown) === true
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
