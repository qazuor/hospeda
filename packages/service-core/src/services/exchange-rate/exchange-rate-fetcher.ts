import type { ExchangeRateModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ExchangeRate, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { ExchangeRateSourceEnum } from '@repo/schemas';
import type { DolarApiClient } from './clients/dolar-api.client.js';
import type { ExchangeRateApiClient } from './clients/exchange-rate-api.client.js';
import { isRateStale } from './exchange-rate.helpers.js';

const logger = createLogger('ExchangeRateFetcher');

/**
 * Dependencies required by the ExchangeRateFetcher.
 */
export interface ExchangeRateFetcherDeps {
    /** DolarAPI client for ARS exchange rates */
    dolarApiClient: DolarApiClient;
    /** ExchangeRate-API client for international rates */
    exchangeRateApiClient: ExchangeRateApiClient;
    /** Exchange rate database model */
    exchangeRateModel: ExchangeRateModel;
}

/**
 * Result of fetching and storing all exchange rates.
 */
export interface FetchAllResult {
    /** Number of rates successfully stored */
    stored: number;
    /** Errors encountered during fetch/store operations */
    errors: Array<{ source: string; error: string }>;
    /** Number of rates from manual overrides */
    fromManualOverride: number;
    /** Number of rates from DolarAPI */
    fromDolarApi: number;
    /** Number of rates from ExchangeRate-API */
    fromExchangeRateApi: number;
    /** Number of rates from DB fallback */
    fromDbFallback: number;
}

/**
 * Parameters for getting a rate.
 */
export interface GetRateParams {
    /** Source currency */
    fromCurrency: PriceCurrencyEnum;
    /** Target currency */
    toCurrency: PriceCurrencyEnum;
    /** Rate type (optional, defaults to searching all types) */
    rateType?: ExchangeRateTypeEnum;
}

/**
 * Result of getting a rate with quality indication.
 */
export interface GetRateWithFallbackResult {
    /** The exchange rate found, or null */
    rate: ExchangeRate | null;
    /** Quality indicator: 'fresh', 'stale', 'manual', 'not_found' */
    quality: 'fresh' | 'stale' | 'manual' | 'not_found';
    /** Source of the rate */
    source?: ExchangeRateSourceEnum;
    /** Age in minutes if applicable */
    ageMinutes?: number;
}

/**
 * Parameters for getting a rate with fallback chain.
 */
export interface GetRateWithFallbackParams extends GetRateParams {
    /** Maximum age in minutes before considering a rate stale (default: 60) */
    maxAgeMinutes?: number;
}

/**
 * Exchange rate fetcher with priority-based fallback chain.
 * Implements the following priority order:
 * 1. Manual admin override (if set and not expired)
 * 2. DolarAPI (for ARS-related pairs)
 * 3. ExchangeRate-API (for international pairs)
 * 4. Last known rate from DB (stale fallback)
 */
export class ExchangeRateFetcher {
    private readonly dolarApiClient: DolarApiClient;
    private readonly exchangeRateApiClient: ExchangeRateApiClient;
    private readonly exchangeRateModel: ExchangeRateModel;

    /**
     * In-memory consecutive failure tracking for alerting.
     * Key: source name, Value: consecutive failure count
     */
    private readonly consecutiveFailures: Map<string, number> = new Map();

    /**
     * Creates a new ExchangeRateFetcher instance.
     *
     * @param deps - Dependencies for the fetcher
     * @param deps.dolarApiClient - Client for DolarAPI
     * @param deps.exchangeRateApiClient - Client for ExchangeRate-API
     * @param deps.exchangeRateModel - Database model for exchange rates
     *
     * @example
     * ```ts
     * const fetcher = new ExchangeRateFetcher({
     *   dolarApiClient: new DolarApiClient(),
     *   exchangeRateApiClient: new ExchangeRateApiClient({ apiKey: 'xxx' }),
     *   exchangeRateModel: new ExchangeRateModel(),
     * });
     * const result = await fetcher.fetchAndStore();
     * ```
     */
    constructor(deps: ExchangeRateFetcherDeps) {
        this.dolarApiClient = deps.dolarApiClient;
        this.exchangeRateApiClient = deps.exchangeRateApiClient;
        this.exchangeRateModel = deps.exchangeRateModel;
    }

    /**
     * Fetches rates from all sources and stores them in the database.
     * Fetches from DolarAPI (ARS rates) and ExchangeRate-API (international rates),
     * checks for manual overrides, and stores new rates.
     *
     * @returns Summary of fetched and stored rates
     *
     * @example
     * ```ts
     * const result = await fetcher.fetchAndStore();
     * console.log(`Stored ${result.stored} rates with ${result.errors.length} errors`);
     * console.log(`Manual: ${result.fromManualOverride}, DolarAPI: ${result.fromDolarApi}`);
     * ```
     */
    async fetchAndStore(): Promise<FetchAllResult> {
        const result: FetchAllResult = {
            stored: 0,
            errors: [],
            fromManualOverride: 0,
            fromDolarApi: 0,
            fromExchangeRateApi: 0,
            fromDbFallback: 0
        };

        // Fetch from DolarAPI (ARS rates)
        const dolarApiResult = await this.dolarApiClient.fetchAll();
        if (dolarApiResult.errors.length > 0) {
            result.errors.push(
                ...dolarApiResult.errors.map((e) => ({
                    source: 'DolarAPI',
                    error: e.error
                }))
            );
            this.incrementFailureCount('DolarAPI');
            logger.error(dolarApiResult.errors, 'DolarAPI fetch failed');
        } else {
            this.resetFailureCount('DolarAPI');
        }

        // Fetch from ExchangeRate-API (international rates)
        const exchangeRateApiResult = await this.exchangeRateApiClient.fetchLatestRates();
        if (exchangeRateApiResult.errors.length > 0) {
            result.errors.push(
                ...exchangeRateApiResult.errors.map((e) => ({
                    source: 'ExchangeRate-API',
                    error: e.error
                }))
            );
            this.incrementFailureCount('ExchangeRate-API');
            logger.error(exchangeRateApiResult.errors, 'ExchangeRate-API fetch failed');
        } else {
            this.resetFailureCount('ExchangeRate-API');
        }

        // Combine all fetched rates
        const allFetchedRates = [...dolarApiResult.rates, ...exchangeRateApiResult.rates];

        // Get existing manual overrides from DB
        const manualOverrides = await this.getActiveManualOverrides();
        const manualOverrideMap = this.createManualOverrideMap(manualOverrides);

        // Store rates, preferring manual overrides
        for (const fetchedRate of allFetchedRates) {
            const key = this.createRateKey({
                fromCurrency: fetchedRate.fromCurrency,
                toCurrency: fetchedRate.toCurrency,
                rateType: fetchedRate.rateType
            });

            // Check if manual override exists and is not expired
            const manualOverride = manualOverrideMap.get(key);
            if (manualOverride) {
                if (!manualOverride.expiresAt || manualOverride.expiresAt > new Date()) {
                    // Skip storing fetched rate, manual override takes priority
                    result.fromManualOverride++;
                    logger.debug(
                        `Manual override active for ${key}, ID: ${manualOverride.id}`,
                        'Skipping fetched rate'
                    );
                    continue;
                }
            }

            // Store the fetched rate
            try {
                await this.exchangeRateModel.create({
                    fromCurrency: fetchedRate.fromCurrency,
                    toCurrency: fetchedRate.toCurrency,
                    rate: fetchedRate.rate,
                    inverseRate: fetchedRate.inverseRate,
                    rateType: fetchedRate.rateType,
                    source: fetchedRate.source,
                    isManualOverride: false,
                    fetchedAt: fetchedRate.fetchedAt,
                    expiresAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                result.stored++;

                if (fetchedRate.source === ExchangeRateSourceEnum.DOLARAPI) {
                    result.fromDolarApi++;
                } else if (fetchedRate.source === ExchangeRateSourceEnum.EXCHANGERATE_API) {
                    result.fromExchangeRateApi++;
                }

                logger.debug(
                    `Stored ${key} from ${fetchedRate.source}, rate: ${fetchedRate.rate}`,
                    'Stored exchange rate'
                );
            } catch (error) {
                result.errors.push({
                    source: 'Database',
                    error: error instanceof Error ? error.message : 'Unknown storage error'
                });
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Failed to store ${key}: ${errorMsg}`, 'Storage error');
            }
        }

        logger.info(
            `Stored: ${result.stored}, Errors: ${result.errors.length}, Manual: ${result.fromManualOverride}, DolarAPI: ${result.fromDolarApi}, ExchangeRate-API: ${result.fromExchangeRateApi}`,
            'Fetch and store completed'
        );

        return result;
    }

    /**
     * Gets the best available exchange rate using the fallback chain.
     * Priority: Manual override → API cache (fresh) → DB (stale fallback).
     *
     * @param params - Rate lookup parameters
     * @returns The best available rate or null if not found
     *
     * @example
     * ```ts
     * const rate = await fetcher.getRate({
     *   fromCurrency: PriceCurrencyEnum.USD,
     *   toCurrency: PriceCurrencyEnum.ARS,
     *   rateType: ExchangeRateTypeEnum.BLUE,
     * });
     * if (rate) {
     *   console.log('Rate:', rate.rate, 'Source:', rate.source);
     * }
     * ```
     */
    async getRate(params: GetRateParams): Promise<ExchangeRate | null> {
        const { fromCurrency, toCurrency, rateType } = params;

        // 1. Check for non-expired manual override
        const manualOverride = await this.getManualOverride({
            fromCurrency,
            toCurrency,
            rateType
        });
        if (manualOverride) {
            logger.debug(
                `${fromCurrency}-${toCurrency}${rateType ? `-${rateType}` : ''}, ID: ${manualOverride.id}`,
                'Found manual override'
            );
            return manualOverride;
        }

        // 2. Check for fresh rate from API cache in DB
        const cachedRate = await this.getCachedRate({
            fromCurrency,
            toCurrency,
            rateType
        });
        if (cachedRate && !isRateStale({ fetchedAt: cachedRate.fetchedAt, maxAgeMinutes: 60 })) {
            logger.debug(
                `${fromCurrency}-${toCurrency}${rateType ? `-${rateType}` : ''} from ${cachedRate.source}`,
                'Found fresh cached rate'
            );
            return cachedRate;
        }

        // 3. Fallback to any DB rate (stale)
        if (cachedRate) {
            logger.warn(
                `${fromCurrency}-${toCurrency}${rateType ? `-${rateType}` : ''} from ${cachedRate.source}, fetched: ${cachedRate.fetchedAt.toISOString()}`,
                'Using stale rate from DB'
            );
            return cachedRate;
        }

        logger.warn(
            `${fromCurrency}-${toCurrency}${rateType ? `-${rateType}` : ''}`,
            'No rate found'
        );
        return null;
    }

    /**
     * Gets a rate with quality indication (fresh/stale/manual).
     * Convenience method that wraps getRate() with quality metadata.
     *
     * @param params - Rate lookup parameters with optional max age
     * @returns Rate with quality indicator
     *
     * @example
     * ```ts
     * const result = await fetcher.getRateWithFallback({
     *   fromCurrency: PriceCurrencyEnum.USD,
     *   toCurrency: PriceCurrencyEnum.ARS,
     *   maxAgeMinutes: 120,
     * });
     * if (result.quality === 'fresh') {
     *   console.log('Fresh rate:', result.rate?.rate);
     * } else if (result.quality === 'stale') {
     *   console.warn('Stale rate:', result.rate?.rate, 'Age:', result.ageMinutes);
     * }
     * ```
     */
    async getRateWithFallback(
        params: GetRateWithFallbackParams
    ): Promise<GetRateWithFallbackResult> {
        const { fromCurrency, toCurrency, rateType, maxAgeMinutes = 60 } = params;

        const rate = await this.getRate({ fromCurrency, toCurrency, rateType });

        if (!rate) {
            return {
                rate: null,
                quality: 'not_found'
            };
        }

        // Manual override
        if (rate.isManualOverride) {
            return {
                rate,
                quality: 'manual',
                source: rate.source
            };
        }

        // Check freshness
        const ageMs = Date.now() - rate.fetchedAt.getTime();
        const ageMinutes = Math.floor(ageMs / 60000);
        const isStale = isRateStale({ fetchedAt: rate.fetchedAt, maxAgeMinutes });

        return {
            rate,
            quality: isStale ? 'stale' : 'fresh',
            source: rate.source,
            ageMinutes
        };
    }

    /**
     * Gets the consecutive failure count for a source.
     *
     * @param source - Source name (e.g., 'DolarAPI', 'ExchangeRate-API')
     * @returns Number of consecutive failures
     *
     * @example
     * ```ts
     * const failures = fetcher.getFailureCount('DolarAPI');
     * if (failures > 3) {
     *   console.error('DolarAPI has failed 3+ times consecutively');
     * }
     * ```
     */
    getFailureCount(source: string): number {
        return this.consecutiveFailures.get(source) ?? 0;
    }

    /**
     * Retrieves all active (non-expired) manual overrides from the database.
     *
     * @returns Array of manual override exchange rates
     */
    private async getActiveManualOverrides(): Promise<ExchangeRate[]> {
        try {
            const allRates = await this.exchangeRateModel.findAll({});
            const now = new Date();

            return allRates.items.filter((rate: ExchangeRate) => {
                return rate.isManualOverride && (!rate.expiresAt || rate.expiresAt > now);
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(errorMsg, 'Failed to fetch manual overrides');
            return [];
        }
    }

    /**
     * Gets a manual override for the given currency pair and rate type.
     *
     * @param params - Currency pair and rate type
     * @returns Manual override or null
     */
    private async getManualOverride(params: GetRateParams): Promise<ExchangeRate | null> {
        const manualOverrides = await this.getActiveManualOverrides();
        const now = new Date();

        return (
            manualOverrides.find((rate: ExchangeRate) => {
                return (
                    rate.fromCurrency === params.fromCurrency &&
                    rate.toCurrency === params.toCurrency &&
                    (!params.rateType || rate.rateType === params.rateType) &&
                    (!rate.expiresAt || rate.expiresAt > now)
                );
            }) ?? null
        );
    }

    /**
     * Gets a cached rate from the database.
     *
     * @param params - Currency pair and rate type
     * @returns Cached rate or null
     */
    private async getCachedRate(params: GetRateParams): Promise<ExchangeRate | null> {
        try {
            const allRates = await this.exchangeRateModel.findAll({});

            // Filter for matching rates that are not manual overrides
            const matchingRates = allRates.items
                .filter((rate: ExchangeRate) => {
                    return (
                        rate.fromCurrency === params.fromCurrency &&
                        rate.toCurrency === params.toCurrency &&
                        (!params.rateType || rate.rateType === params.rateType) &&
                        !rate.isManualOverride
                    );
                })
                .sort((a: ExchangeRate, b: ExchangeRate) => {
                    // Sort by fetchedAt descending (most recent first)
                    return b.fetchedAt.getTime() - a.fetchedAt.getTime();
                });

            return matchingRates[0] ?? null;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const key = this.createRateKey(params);
            logger.error(`${key}: ${errorMsg}`, 'Failed to fetch cached rate');
            return null;
        }
    }

    /**
     * Creates a map of manual overrides keyed by currency pair + rate type.
     *
     * @param manualOverrides - Array of manual override rates
     * @returns Map with key format: "USD-ARS-BLUE"
     */
    private createManualOverrideMap(manualOverrides: ExchangeRate[]): Map<string, ExchangeRate> {
        const map = new Map<string, ExchangeRate>();

        for (const override of manualOverrides) {
            const key = this.createRateKey({
                fromCurrency: override.fromCurrency,
                toCurrency: override.toCurrency,
                rateType: override.rateType
            });
            map.set(key, override);
        }

        return map;
    }

    /**
     * Creates a unique key for a rate based on currency pair and rate type.
     *
     * @param params - Currency pair and rate type
     * @returns Key string in format "USD-ARS-BLUE"
     */
    private createRateKey(params: GetRateParams): string {
        const { fromCurrency, toCurrency, rateType } = params;
        return `${fromCurrency}-${toCurrency}-${rateType ?? 'ANY'}`;
    }

    /**
     * Increments the consecutive failure count for a source.
     *
     * @param source - Source name
     */
    private incrementFailureCount(source: string): void {
        const current = this.consecutiveFailures.get(source) ?? 0;
        this.consecutiveFailures.set(source, current + 1);

        const newCount = current + 1;
        if (newCount >= 3) {
            logger.error(
                `${source}: ${newCount} consecutive failures`,
                `${source} has failed ${newCount} times consecutively`
            );
        }
    }

    /**
     * Resets the consecutive failure count for a source.
     *
     * @param source - Source name
     */
    private resetFailureCount(source: string): void {
        this.consecutiveFailures.set(source, 0);
    }
}
