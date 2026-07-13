import type { DestinationWeatherCacheInput } from '@repo/schemas';

/**
 * Configuration for {@link OpenMeteoClient}.
 *
 * Open-Meteo requires no API key for non-commercial use, so only the base URL
 * and request timeout are configurable.
 */
export interface OpenMeteoClientConfig {
    /** Base URL of the Open-Meteo forecast API. Defaults to the public endpoint. */
    baseUrl?: string;
    /** Per-request timeout in milliseconds. Defaults to 15000. */
    timeoutMs?: number;
    /**
     * Number of RETRIES (in addition to the first attempt) for transient
     * failures — request timeout/abort, network error, HTTP 429, and HTTP 5xx.
     * Non-transient failures (HTTP 4xx other than 429, empty payload, schema
     * validation) are never retried. Defaults to 2 (3 attempts total).
     */
    maxRetries?: number;
    /**
     * Base backoff in milliseconds between retries, grown exponentially
     * (`retryBackoffMs * 2^attempt`). Defaults to 500.
     */
    retryBackoffMs?: number;
}

/**
 * Geographic coordinates for a single forecast lookup.
 */
export interface OpenMeteoCoordinates {
    latitude: number;
    longitude: number;
}

/**
 * Result of a single Open-Meteo fetch. Never throws: on any failure `weather`
 * is `null` and `error` carries a human-readable reason.
 */
export interface OpenMeteoFetchResult {
    weather: DestinationWeatherCacheInput | null;
    error?: string;
    fetchedAt: Date;
}
