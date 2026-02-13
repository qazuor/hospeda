import type {
    ExchangeRateSourceEnum,
    ExchangeRateTypeEnum,
    PriceCurrencyEnum
} from '@repo/schemas';

/**
 * Result of fetching a single exchange rate from an external source.
 * Contains both the rate and its inverse for bidirectional conversion.
 */
export interface ExchangeRateFetchResult {
    /** Source currency (e.g., USD, ARS) */
    fromCurrency: PriceCurrencyEnum;
    /** Target currency (e.g., ARS, USD, BRL) */
    toCurrency: PriceCurrencyEnum;
    /** Exchange rate from source to target */
    rate: number;
    /** Inverse rate (1 / rate) for reverse conversion */
    inverseRate: number;
    /** Type of rate (OFICIAL, BLUE, MEP, CCL, TARJETA, STANDARD) */
    rateType: ExchangeRateTypeEnum;
    /** Data source identifier */
    source: ExchangeRateSourceEnum;
    /** Timestamp when rate was fetched */
    fetchedAt: Date;
}

/**
 * Configuration for an external exchange rate API client.
 */
export interface ApiClientConfig {
    /** Base URL of the API endpoint */
    baseUrl: string;
    /** Request timeout in milliseconds */
    timeoutMs: number;
    /** Optional API key for authenticated requests */
    apiKey?: string;
}

/**
 * Result of a fetch operation from an external API.
 * May include multiple rates and error details for failed requests.
 */
export interface FetchOperationResult {
    /** Successfully fetched exchange rates */
    rates: ExchangeRateFetchResult[];
    /** Errors encountered during fetch operations */
    errors: Array<{ endpoint: string; error: string }>;
    /** Timestamp when fetch operation completed */
    fetchedAt: Date;
}
