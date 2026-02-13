import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import type { ApiClientConfig, ExchangeRateFetchResult, FetchOperationResult } from './types.js';

/**
 * Response format from DolarAPI /dolares endpoint.
 * Contains USD/ARS rates by type (oficial, blue, bolsa, etc.)
 */
interface DolarApiDollarResponse {
    moneda: string;
    casa: string;
    nombre: string;
    compra: number;
    venta: number;
    fechaActualizacion: string;
}

/**
 * Response format from DolarAPI /cotizaciones endpoint.
 * Contains all currency rates including BRL.
 */
interface DolarApiCotizacionResponse {
    moneda: string;
    casa: string;
    nombre: string;
    compra: number;
    venta: number;
    fechaActualizacion: string;
}

/**
 * Maps DolarAPI "casa" values to ExchangeRateTypeEnum.
 * Unknown casa types are filtered out during processing.
 */
const CASA_TO_RATE_TYPE: Partial<Record<string, ExchangeRateTypeEnum>> = {
    oficial: ExchangeRateTypeEnum.OFICIAL,
    blue: ExchangeRateTypeEnum.BLUE,
    bolsa: ExchangeRateTypeEnum.MEP, // "bolsa" is MEP (Mercado Electrónico de Pagos)
    contadoconliqui: ExchangeRateTypeEnum.CCL,
    tarjeta: ExchangeRateTypeEnum.TARJETA
    // mayorista and cripto are not in our enum, will be skipped
};

/**
 * HTTP client for DolarAPI.com exchange rate service.
 * Fetches Argentine exchange rates (USD/ARS, BRL/ARS) with various rate types.
 *
 * @see https://dolarapi.com
 */
export class DolarApiClient {
    private readonly config: ApiClientConfig;

    /**
     * Creates a new DolarAPI client instance.
     *
     * @param config - Optional client configuration
     * @param config.baseUrl - Base URL for API (default: https://dolarapi.com/v1)
     * @param config.timeoutMs - Request timeout in milliseconds (default: 5000)
     *
     * @example
     * ```ts
     * const client = new DolarApiClient();
     * const result = await client.fetchAll();
     * ```
     */
    constructor(config?: Partial<ApiClientConfig>) {
        this.config = {
            baseUrl: config?.baseUrl ?? 'https://dolarapi.com/v1',
            timeoutMs: config?.timeoutMs ?? 5000
        };
    }

    /**
     * Fetches all USD/ARS exchange rates from /dolares endpoint.
     * Returns rates for: oficial, blue, bolsa (MEP), contado con liquidación, tarjeta.
     *
     * @returns Operation result with rates and errors
     *
     * @example
     * ```ts
     * const result = await client.fetchDolarRates();
     * if (result.rates.length > 0) {
     *   console.log('Blue rate:', result.rates.find(r => r.rateType === 'blue'));
     * }
     * ```
     */
    async fetchDolarRates(): Promise<FetchOperationResult> {
        const endpoint = `${this.config.baseUrl}/dolares`;
        const fetchedAt = new Date();

        try {
            const response = await this.fetchWithTimeout(endpoint);

            if (!response.ok) {
                return {
                    rates: [],
                    errors: [
                        {
                            endpoint,
                            error: `HTTP ${response.status}: ${response.statusText}`
                        }
                    ],
                    fetchedAt
                };
            }

            const data = (await response.json()) as DolarApiDollarResponse[];
            const rates = this.parseDolarRates(data, fetchedAt);

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
     * Fetches all currency cotizaciones from /cotizaciones endpoint.
     * Includes BRL/ARS rates in addition to USD/ARS rates.
     *
     * @returns Operation result with rates and errors
     *
     * @example
     * ```ts
     * const result = await client.fetchAllCotizaciones();
     * const brlRate = result.rates.find(r => r.toCurrency === 'BRL');
     * ```
     */
    async fetchAllCotizaciones(): Promise<FetchOperationResult> {
        const endpoint = `${this.config.baseUrl}/cotizaciones`;
        const fetchedAt = new Date();

        try {
            const response = await this.fetchWithTimeout(endpoint);

            if (!response.ok) {
                return {
                    rates: [],
                    errors: [
                        {
                            endpoint,
                            error: `HTTP ${response.status}: ${response.statusText}`
                        }
                    ],
                    fetchedAt
                };
            }

            const data = (await response.json()) as DolarApiCotizacionResponse[];
            const rates = this.parseCotizacionRates(data, fetchedAt);

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
     * Fetches all available rates (dolares + cotizaciones).
     * Combines USD/ARS rates by type with BRL/ARS rates.
     *
     * @returns Combined operation result with all rates and errors
     *
     * @example
     * ```ts
     * const result = await client.fetchAll();
     * console.log(`Fetched ${result.rates.length} rates with ${result.errors.length} errors`);
     * ```
     */
    async fetchAll(): Promise<FetchOperationResult> {
        const [dolarResult, cotizacionResult] = await Promise.all([
            this.fetchDolarRates(),
            this.fetchAllCotizaciones()
        ]);

        return {
            rates: [...dolarResult.rates, ...cotizacionResult.rates],
            errors: [...dolarResult.errors, ...cotizacionResult.errors],
            fetchedAt: new Date()
        };
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
     * Parses DolarAPI /dolares response into ExchangeRateFetchResult array.
     * Filters out unknown casa types that don't map to our enum.
     *
     * @param data - Raw API response data
     * @param fetchedAt - Timestamp of fetch operation
     * @returns Parsed exchange rate results
     */
    private parseDolarRates(
        data: DolarApiDollarResponse[],
        fetchedAt: Date
    ): ExchangeRateFetchResult[] {
        const rates: ExchangeRateFetchResult[] = [];

        for (const item of data) {
            const rateType = CASA_TO_RATE_TYPE[item.casa];

            // Skip unknown casa types
            if (!rateType) {
                continue;
            }

            // Use "venta" (sell) as the standard rate (what you pay to buy USD)
            const rate = item.venta;
            const inverseRate = 1 / rate;

            rates.push({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rate,
                inverseRate,
                rateType,
                source: ExchangeRateSourceEnum.DOLARAPI,
                fetchedAt
            });
        }

        return rates;
    }

    /**
     * Parses DolarAPI /cotizaciones response into ExchangeRateFetchResult array.
     * Handles both USD/ARS and BRL/ARS rates.
     *
     * @param data - Raw API response data
     * @param fetchedAt - Timestamp of fetch operation
     * @returns Parsed exchange rate results
     */
    private parseCotizacionRates(
        data: DolarApiCotizacionResponse[],
        fetchedAt: Date
    ): ExchangeRateFetchResult[] {
        const rates: ExchangeRateFetchResult[] = [];

        for (const item of data) {
            // Map BRL rates (ARS to BRL conversion)
            if (item.moneda === 'BRL') {
                // Use "venta" (sell) as the standard rate
                const rate = item.venta;
                const inverseRate = 1 / rate;

                rates.push({
                    fromCurrency: PriceCurrencyEnum.ARS,
                    toCurrency: PriceCurrencyEnum.BRL,
                    rate,
                    inverseRate,
                    rateType: ExchangeRateTypeEnum.OFICIAL, // BRL uses OFICIAL type
                    source: ExchangeRateSourceEnum.DOLARAPI,
                    fetchedAt
                });
                continue;
            }

            // Map USD rates with type differentiation
            if (item.moneda === 'USD') {
                const rateType = CASA_TO_RATE_TYPE[item.casa];

                // Skip unknown casa types
                if (!rateType) {
                    continue;
                }

                // Use "venta" (sell) as the standard rate
                const rate = item.venta;
                const inverseRate = 1 / rate;

                rates.push({
                    fromCurrency: PriceCurrencyEnum.USD,
                    toCurrency: PriceCurrencyEnum.ARS,
                    rate,
                    inverseRate,
                    rateType,
                    source: ExchangeRateSourceEnum.DOLARAPI,
                    fetchedAt
                });
            }
        }

        return rates;
    }
}
