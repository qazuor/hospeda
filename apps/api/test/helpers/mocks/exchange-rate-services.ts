/**
 * Mock implementations for exchange rate related services.
 *
 * Provides happy-path mock classes for ExchangeRateService,
 * ExchangeRateConfigService, ExchangeRateFetcher, DolarApiClient,
 * and ExchangeRateApiClient used in unit tests.
 *
 * @module test/helpers/mocks/exchange-rate-services
 */

/**
 * Mock ExchangeRateService - returns predictable USD/ARS rate data.
 */
export class ExchangeRateService {
    async create(_actor: unknown, _data: Record<string, unknown>) {
        return {
            data: {
                id: 'rate_mock_id',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1180.5,
                inverseRate: 0.000847,
                rateType: 'blue',
                source: 'MANUAL',
                isManualOverride: true,
                fetchedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }
}

/**
 * Mock ExchangeRateConfigService - returns predictable config data.
 */
export class ExchangeRateConfigService {
    async getConfig(_actor: unknown) {
        return {
            data: {
                id: 'config_mock_id',
                refreshIntervalMinutes: 60,
                staleThresholdMinutes: 120,
                enableDolarApi: true,
                enableExchangeRateApi: true,
                enableManualOverrides: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }

    async updateConfig(_actor: unknown, _data: Record<string, unknown>) {
        return {
            data: {
                id: 'config_mock_id',
                refreshIntervalMinutes: 60,
                staleThresholdMinutes: 120,
                enableDolarApi: true,
                enableExchangeRateApi: true,
                enableManualOverrides: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        };
    }
}

/**
 * Mock ExchangeRateFetcher - simulates successful rate fetching.
 */
export class ExchangeRateFetcher {
    async fetchAndStore() {
        return {
            stored: 7,
            errors: [] as string[],
            fromManualOverride: 1,
            fromDolarApi: 5,
            fromExchangeRateApi: 2,
            fromDbFallback: 0
        };
    }

    async getRate(_params: unknown) {
        return {
            id: 'rate_mock_id',
            fromCurrency: 'USD',
            toCurrency: 'ARS',
            rate: 1180.5,
            inverseRate: 0.000847,
            rateType: 'blue',
            source: 'DOLARAPI',
            isManualOverride: false,
            fetchedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    async getRateWithFallback(_params: unknown) {
        return {
            rate: {
                id: 'rate_mock_id',
                fromCurrency: 'USD',
                toCurrency: 'ARS',
                rate: 1180.5,
                inverseRate: 0.000847,
                rateType: 'blue',
                source: 'DOLARAPI',
                isManualOverride: false,
                fetchedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            quality: 'fresh' as const,
            source: 'DOLARAPI' as const,
            ageMinutes: 0
        };
    }

    getFailureCount(_source: string) {
        return 0;
    }
}

/**
 * Mock DolarApiClient - returns empty rates (no external calls in tests).
 */
export class DolarApiClient {
    async fetchAll() {
        return { rates: [], errors: [] as string[], fetchedAt: new Date() };
    }

    async fetchDolarRates() {
        return { rates: [], errors: [] as string[], fetchedAt: new Date() };
    }

    async fetchAllCotizaciones() {
        return { rates: [], errors: [] as string[], fetchedAt: new Date() };
    }
}

/**
 * Mock ExchangeRateApiClient - returns empty rates (no external calls in tests).
 */
export class ExchangeRateApiClient {
    async fetchLatestRates() {
        return { rates: [], errors: [] as string[], fetchedAt: new Date() };
    }
}
