import type { ExchangeRateModel } from '@repo/db';
import type { ExchangeRate } from '@repo/schemas';
import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DolarApiClient } from '../../../src/services/exchange-rate/clients/dolar-api.client.js';
import type { ExchangeRateApiClient } from '../../../src/services/exchange-rate/clients/exchange-rate-api.client.js';
import type { FetchOperationResult } from '../../../src/services/exchange-rate/clients/types.js';
import {
    ExchangeRateFetcher,
    type ExchangeRateFetcherDeps
} from '../../../src/services/exchange-rate/exchange-rate-fetcher.js';

describe('ExchangeRateFetcher', () => {
    let fetcher: ExchangeRateFetcher;
    let mockDolarApiClient: DolarApiClient;
    let mockExchangeRateApiClient: ExchangeRateApiClient;
    let mockExchangeRateModel: ExchangeRateModel;

    const createMockRate = (overrides: Partial<ExchangeRate> = {}): ExchangeRate => ({
        id: 'mock-id',
        fromCurrency: PriceCurrencyEnum.USD,
        toCurrency: PriceCurrencyEnum.ARS,
        rate: 1000,
        inverseRate: 0.001,
        rateType: ExchangeRateTypeEnum.BLUE,
        source: ExchangeRateSourceEnum.DOLARAPI,
        isManualOverride: false,
        expiresAt: null,
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    });

    beforeEach(() => {
        // Mock DolarApiClient
        mockDolarApiClient = {
            fetchAll: vi.fn()
        } as unknown as DolarApiClient;

        // Mock ExchangeRateApiClient
        mockExchangeRateApiClient = {
            fetchLatestRates: vi.fn()
        } as unknown as ExchangeRateApiClient;

        // Mock ExchangeRateModel
        mockExchangeRateModel = {
            create: vi.fn(),
            findAll: vi.fn()
        } as unknown as ExchangeRateModel;

        const deps: ExchangeRateFetcherDeps = {
            dolarApiClient: mockDolarApiClient,
            exchangeRateApiClient: mockExchangeRateApiClient,
            exchangeRateModel: mockExchangeRateModel
        };

        fetcher = new ExchangeRateFetcher(deps);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchAndStore', () => {
        it('should fetch from DolarAPI and store rates', async () => {
            // Arrange
            const dolarApiResult: FetchOperationResult = {
                rates: [
                    {
                        fromCurrency: PriceCurrencyEnum.USD,
                        toCurrency: PriceCurrencyEnum.ARS,
                        rate: 1000,
                        inverseRate: 0.001,
                        rateType: ExchangeRateTypeEnum.BLUE,
                        source: ExchangeRateSourceEnum.DOLARAPI,
                        fetchedAt: new Date()
                    }
                ],
                errors: [],
                fetchedAt: new Date()
            };

            const exchangeRateApiResult: FetchOperationResult = {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue(
                exchangeRateApiResult
            );
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });
            vi.mocked(mockExchangeRateModel.create).mockResolvedValue(createMockRate());

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(1);
            expect(result.fromDolarApi).toBe(1);
            expect(result.fromExchangeRateApi).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(mockExchangeRateModel.create).toHaveBeenCalledTimes(1);
        });

        it('should fetch from ExchangeRate-API and store rates', async () => {
            // Arrange
            const dolarApiResult: FetchOperationResult = {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };

            const exchangeRateApiResult: FetchOperationResult = {
                rates: [
                    {
                        fromCurrency: PriceCurrencyEnum.USD,
                        toCurrency: PriceCurrencyEnum.BRL,
                        rate: 5.5,
                        inverseRate: 0.1818,
                        rateType: ExchangeRateTypeEnum.STANDARD,
                        source: ExchangeRateSourceEnum.EXCHANGERATE_API,
                        fetchedAt: new Date()
                    }
                ],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue(
                exchangeRateApiResult
            );
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });
            vi.mocked(mockExchangeRateModel.create).mockResolvedValue(createMockRate());

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(1);
            expect(result.fromDolarApi).toBe(0);
            expect(result.fromExchangeRateApi).toBe(1);
            expect(result.errors).toHaveLength(0);
        });

        it('should skip storing if manual override exists and not expired', async () => {
            // Arrange
            const manualOverride = createMockRate({
                isManualOverride: true,
                source: ExchangeRateSourceEnum.MANUAL,
                expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
            });

            const dolarApiResult: FetchOperationResult = {
                rates: [
                    {
                        fromCurrency: PriceCurrencyEnum.USD,
                        toCurrency: PriceCurrencyEnum.ARS,
                        rate: 1000,
                        inverseRate: 0.001,
                        rateType: ExchangeRateTypeEnum.BLUE,
                        source: ExchangeRateSourceEnum.DOLARAPI,
                        fetchedAt: new Date()
                    }
                ],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({
                items: [manualOverride],
                total: 1
            });

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(0);
            expect(result.fromManualOverride).toBe(1);
            expect(mockExchangeRateModel.create).not.toHaveBeenCalled();
        });

        it('should store rate if manual override is expired', async () => {
            // Arrange
            const expiredManualOverride = createMockRate({
                isManualOverride: true,
                source: ExchangeRateSourceEnum.MANUAL,
                expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
            });

            const dolarApiResult: FetchOperationResult = {
                rates: [
                    {
                        fromCurrency: PriceCurrencyEnum.USD,
                        toCurrency: PriceCurrencyEnum.ARS,
                        rate: 1000,
                        inverseRate: 0.001,
                        rateType: ExchangeRateTypeEnum.BLUE,
                        source: ExchangeRateSourceEnum.DOLARAPI,
                        fetchedAt: new Date()
                    }
                ],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({
                items: [expiredManualOverride],
                total: 1
            });
            vi.mocked(mockExchangeRateModel.create).mockResolvedValue(createMockRate());

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(1);
            expect(result.fromManualOverride).toBe(0);
            expect(mockExchangeRateModel.create).toHaveBeenCalledTimes(1);
        });

        it('should track API errors and increment consecutive failures', async () => {
            // Arrange
            const dolarApiResult: FetchOperationResult = {
                rates: [],
                errors: [{ endpoint: 'http://api.com', error: 'Network error' }],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.source).toBe('DolarAPI');
            expect(result.errors[0]?.error).toBe('Network error');
            expect(fetcher.getFailureCount('DolarAPI')).toBe(1);
        });

        it('should reset consecutive failures on successful fetch', async () => {
            // Arrange
            const dolarApiResult: FetchOperationResult = {
                rates: [],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            await fetcher.fetchAndStore();

            // Assert
            expect(fetcher.getFailureCount('DolarAPI')).toBe(0);
            expect(fetcher.getFailureCount('ExchangeRate-API')).toBe(0);
        });

        it('should handle empty API results gracefully', async () => {
            // Arrange
            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(mockExchangeRateModel.create).not.toHaveBeenCalled();
        });

        it('should handle database storage errors', async () => {
            // Arrange
            const dolarApiResult: FetchOperationResult = {
                rates: [
                    {
                        fromCurrency: PriceCurrencyEnum.USD,
                        toCurrency: PriceCurrencyEnum.ARS,
                        rate: 1000,
                        inverseRate: 0.001,
                        rateType: ExchangeRateTypeEnum.BLUE,
                        source: ExchangeRateSourceEnum.DOLARAPI,
                        fetchedAt: new Date()
                    }
                ],
                errors: [],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(dolarApiResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });
            vi.mocked(mockExchangeRateModel.create).mockRejectedValue(new Error('Database error'));

            // Act
            const result = await fetcher.fetchAndStore();

            // Assert
            expect(result.stored).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.source).toBe('Database');
            expect(result.errors[0]?.error).toBe('Database error');
        });
    });

    describe('getRate', () => {
        it('should return manual override if exists and not expired', async () => {
            // Arrange
            const manualOverride = createMockRate({
                isManualOverride: true,
                source: ExchangeRateSourceEnum.MANUAL,
                expiresAt: new Date(Date.now() + 3600000),
                rate: 1500
            });

            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({
                items: [manualOverride],
                total: 1
            });

            // Act
            const result = await fetcher.getRate({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result).toBeDefined();
            expect(result?.rate).toBe(1500);
            expect(result?.source).toBe(ExchangeRateSourceEnum.MANUAL);
        });

        it('should return fresh cached rate if no manual override', async () => {
            // Arrange
            const cachedRate = createMockRate({
                fetchedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                rate: 1000
            });

            vi.mocked(mockExchangeRateModel.findAll)
                .mockResolvedValueOnce({ items: [], total: 0 }) // No manual overrides
                .mockResolvedValueOnce({ items: [cachedRate], total: 1 }); // Cached rates

            // Act
            const result = await fetcher.getRate({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result).toBeDefined();
            expect(result?.rate).toBe(1000);
        });

        it('should return stale rate as fallback', async () => {
            // Arrange
            const staleRate = createMockRate({
                fetchedAt: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
                rate: 900
            });

            vi.mocked(mockExchangeRateModel.findAll)
                .mockResolvedValueOnce({ items: [], total: 0 }) // No manual overrides
                .mockResolvedValueOnce({ items: [staleRate], total: 1 }); // Cached rates

            // Act
            const result = await fetcher.getRate({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result).toBeDefined();
            expect(result?.rate).toBe(900);
        });

        it('should return null if no rate found', async () => {
            // Arrange
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await fetcher.getRate({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result).toBeNull();
        });

        it('should skip expired manual override', async () => {
            // Arrange
            const expiredManualOverride = createMockRate({
                isManualOverride: true,
                source: ExchangeRateSourceEnum.MANUAL,
                expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
                rate: 1500
            });

            const cachedRate = createMockRate({
                fetchedAt: new Date(Date.now() - 30 * 60 * 1000),
                rate: 1000
            });

            vi.mocked(mockExchangeRateModel.findAll)
                .mockResolvedValueOnce({ items: [expiredManualOverride], total: 1 })
                .mockResolvedValueOnce({ items: [cachedRate], total: 1 });

            // Act
            const result = await fetcher.getRate({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result).toBeDefined();
            expect(result?.rate).toBe(1000);
            expect(result?.source).toBe(ExchangeRateSourceEnum.DOLARAPI);
        });
    });

    describe('getRateWithFallback', () => {
        it('should indicate fresh quality for recent rate', async () => {
            // Arrange
            const freshRate = createMockRate({
                fetchedAt: new Date(Date.now() - 30 * 60 * 1000),
                rate: 1000
            });

            vi.mocked(mockExchangeRateModel.findAll)
                .mockResolvedValueOnce({ items: [], total: 0 })
                .mockResolvedValueOnce({ items: [freshRate], total: 1 });

            // Act
            const result = await fetcher.getRateWithFallback({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                rateType: ExchangeRateTypeEnum.BLUE
            });

            // Assert
            expect(result.quality).toBe('fresh');
            expect(result.rate).toBeDefined();
            expect(result.ageMinutes).toBeLessThan(60);
        });

        it('should indicate stale quality for old rate', async () => {
            // Arrange
            const staleRate = createMockRate({
                fetchedAt: new Date(Date.now() - 120 * 60 * 1000),
                rate: 900
            });

            vi.mocked(mockExchangeRateModel.findAll)
                .mockResolvedValueOnce({ items: [], total: 0 })
                .mockResolvedValueOnce({ items: [staleRate], total: 1 });

            // Act
            const result = await fetcher.getRateWithFallback({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS,
                maxAgeMinutes: 60
            });

            // Assert
            expect(result.quality).toBe('stale');
            expect(result.rate).toBeDefined();
            expect(result.ageMinutes).toBeGreaterThan(60);
        });

        it('should indicate manual quality for manual override', async () => {
            // Arrange
            const manualOverride = createMockRate({
                isManualOverride: true,
                source: ExchangeRateSourceEnum.MANUAL,
                rate: 1500
            });

            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({
                items: [manualOverride],
                total: 1
            });

            // Act
            const result = await fetcher.getRateWithFallback({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS
            });

            // Assert
            expect(result.quality).toBe('manual');
            expect(result.source).toBe(ExchangeRateSourceEnum.MANUAL);
        });

        it('should indicate not_found quality when no rate exists', async () => {
            // Arrange
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            const result = await fetcher.getRateWithFallback({
                fromCurrency: PriceCurrencyEnum.USD,
                toCurrency: PriceCurrencyEnum.ARS
            });

            // Assert
            expect(result.quality).toBe('not_found');
            expect(result.rate).toBeNull();
        });
    });

    describe('getFailureCount', () => {
        it('should return 0 for source with no failures', () => {
            // Act
            const count = fetcher.getFailureCount('DolarAPI');

            // Assert
            expect(count).toBe(0);
        });

        it('should track consecutive failures across multiple fetch attempts', async () => {
            // Arrange
            const errorResult: FetchOperationResult = {
                rates: [],
                errors: [{ endpoint: 'http://api.com', error: 'Error' }],
                fetchedAt: new Date()
            };

            vi.mocked(mockDolarApiClient.fetchAll).mockResolvedValue(errorResult);
            vi.mocked(mockExchangeRateApiClient.fetchLatestRates).mockResolvedValue({
                rates: [],
                errors: [],
                fetchedAt: new Date()
            });
            vi.mocked(mockExchangeRateModel.findAll).mockResolvedValue({ items: [], total: 0 });

            // Act
            await fetcher.fetchAndStore();
            await fetcher.fetchAndStore();
            await fetcher.fetchAndStore();

            // Assert
            expect(fetcher.getFailureCount('DolarAPI')).toBe(3);
        });
    });
});
