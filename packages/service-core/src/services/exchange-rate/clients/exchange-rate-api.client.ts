import { createLogger } from '@repo/logger';
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import type { ExchangeRateFetchResult, FetchOperationResult } from './types.js';

const logger = createLogger('ExchangeRateApiClient');

/**
 * Response format from ExchangeRate-API /latest endpoint.
 * Contains conversion rates from base currency (USD) to all supported currencies.
 */
interface ExchangeRateApiResponse {
    result: string;
    documentation: string;
    terms_of_service: string;
    time_last_update_unix: number;
    time_last_update_utc: string;
    time_next_update_unix: number;
    time_next_update_utc: string;
    base_code: string;
    conversion_rates: Record<string, number>;
}

/**
 * Configuration for ExchangeRate-API client.
 * Requires API key with optional baseUrl and timeoutMs.
 */
interface ExchangeRateApiClientConfig {
    /** API key for ExchangeRate-API authentication (required) */
    apiKey: string;
    /** Base URL for API (default: https://v6.exchangerate-api.com/v6) */
    baseUrl?: string;
    /** Request timeout in milliseconds (default: 10000) */
    timeoutMs?: number;
}

/**
 * Resolved configuration with all defaults applied.
 */
interface ResolvedConfig {
    apiKey: string;
    baseUrl: string;
    timeoutMs: number;
}

/**
 * HTTP client for ExchangeRate-API.com exchange rate service.
 * Fetches international exchange rates with USD as base currency.
 * Filters to include only ARS and BRL rates.
 *
 * @see https://exchangerate-api.com
 */
export class ExchangeRateApiClient {
    private readonly config: ResolvedConfig;

    /**
     * Creates a new ExchangeRate-API client instance.
     *
     * @param config - Client configuration
     * @param config.apiKey - API key for authentication (required)
     * @param config.baseUrl - Base URL for API (default: https://v6.exchangerate-api.com/v6)
     * @param config.timeoutMs - Request timeout in milliseconds (default: 10000)
     *
     * @example
     * ```ts
     * const client = new ExchangeRateApiClient({ apiKey: 'your-api-key' });
     * const result = await client.fetchLatestRates();
     * ```
     */
    constructor(config: ExchangeRateApiClientConfig) {
        this.config = {
            baseUrl: config.baseUrl ?? 'https://v6.exchangerate-api.com/v6',
            timeoutMs: config.timeoutMs ?? 10000,
            apiKey: config.apiKey
        };
    }

    /**
     * Fetches latest USD exchange rates from /latest/USD endpoint.
     * Returns only ARS and BRL rates with STANDARD rate type.
     *
     * @returns Operation result with rates and errors
     *
     * @example
     * ```ts
     * const result = await client.fetchLatestRates();
     * if (result.rates.length > 0) {
     *   const arsRate = result.rates.find(r => r.toCurrency === 'ARS');
     *   console.log('USD to ARS rate:', arsRate?.rate);
     * }
     * ```
     */
    async fetchLatestRates(): Promise<FetchOperationResult> {
        const endpoint = `${this.config.baseUrl}/${this.config.apiKey}/latest/USD`;
        const fetchedAt = new Date();

        try {
            const response = await this.fetchWithTimeout(endpoint);

            if (!response.ok) {
                const errorMessage = this.getErrorMessage(response.status, response.statusText);
                return {
                    rates: [],
                    errors: [
                        {
                            endpoint,
                            error: errorMessage
                        }
                    ],
                    fetchedAt
                };
            }

            const data = (await response.json()) as ExchangeRateApiResponse;

            // Check API result status
            if (data.result !== 'success') {
                return {
                    rates: [],
                    errors: [
                        {
                            endpoint,
                            error: `API returned non-success result: ${data.result}`
                        }
                    ],
                    fetchedAt
                };
            }

            // Log quota information from response
            const quotaRemaining = response.headers.get('x-ratelimit-remaining');
            if (quotaRemaining) {
                logger.info(`ExchangeRate-API quota remaining: ${quotaRemaining} requests`);
            }

            const rates = this.parseRates(data, fetchedAt);

            return {
                rates,
                errors: [],
                fetchedAt
            };
        } catch (error) {
            return {
                rates: [],
                errors: [
                    {
                        endpoint,
                        error: error instanceof Error ? error.message : 'Unknown error occurred'
                    }
                ],
                fetchedAt
            };
        }
    }

    /**
     * Performs HTTP fetch with timeout via AbortController.
     *
     * @param url - URL to fetch
     * @returns Fetch response
     * @throws {Error} If request times out or network error occurs
     */
    private async fetchWithTimeout(url: string): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    Accept: 'application/json'
                }
            });

            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Parses ExchangeRate-API response into ExchangeRateFetchResult array.
     * Filters to include only ARS and BRL rates from USD base.
     * Empty conversion_rates object returns empty array.
     *
     * @param data - Raw API response data
     * @param fetchedAt - Timestamp of fetch operation
     * @returns Parsed exchange rate results
     */
    private parseRates(data: ExchangeRateApiResponse, fetchedAt: Date): ExchangeRateFetchResult[] {
        const rates: ExchangeRateFetchResult[] = [];

        // Handle empty conversion_rates
        if (!data.conversion_rates || Object.keys(data.conversion_rates).length === 0) {
            return rates;
        }

        // Extract ARS rate (USD to ARS)
        const arsRate = data.conversion_rates.ARS;
        if (arsRate !== undefined) {
            rates.push({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate: arsRate,
                inverseRate: 1 / arsRate,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                fetchedAt
            });
        }

        // Extract BRL rate (USD to BRL)
        const brlRate = data.conversion_rates.BRL;
        if (brlRate !== undefined) {
            rates.push({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.BRL,
                rate: brlRate,
                inverseRate: 1 / brlRate,
                rateType: ExchangeRateTypeEnum.STANDARD,
                source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                fetchedAt
            });
        }

        return rates;
    }

    /**
     * Maps HTTP status codes to user-friendly error messages.
     *
     * @param status - HTTP status code
     * @param statusText - HTTP status text
     * @returns Error message
     */
    private getErrorMessage(status: number, statusText: string): string {
        switch (status) {
            case 401:
                return 'HTTP 401: Invalid API key or authentication failed';
            case 429:
                return 'HTTP 429: Rate limit exceeded. Please try again later';
            case 500:
            case 502:
            case 503:
            case 504:
                return `HTTP ${status}: Server error (${statusText})`;
            default:
                return `HTTP ${status}: ${statusText}`;
        }
    }
}
