import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeRateApiClient } from '../../../../src/services/exchange-rate/clients/exchange-rate-api.client.js';

describe('ExchangeRateApiClient', () => {
    let client: ExchangeRateApiClient;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        client = new ExchangeRateApiClient({ apiKey: 'test-api-key' });
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchLatestRates', () => {
        it('should fetch and parse USD to ARS and BRL rates successfully', async () => {
            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {
                    ARS: 1234.56,
                    BRL: 5.12,
                    EUR: 0.93,
                    GBP: 0.79
                }
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map([['x-ratelimit-remaining', '1500']])
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(2);
            expect(result.errors).toHaveLength(0);

            // Check ARS rate
            const arsRate = result.rates.find((r) => r.toCurrency === PriceCurrencyEnum.ARS);
            expect(arsRate).toBeDefined();
            expect(arsRate?.fromCurrency).toBe(PriceCurrencyEnum.USD);
            expect(arsRate?.toCurrency).toBe(PriceCurrencyEnum.ARS);
            expect(arsRate?.rate).toBe(1234.56);
            expect(arsRate?.inverseRate).toBeCloseTo(1 / 1234.56);
            expect(arsRate?.rateType).toBe(ExchangeRateTypeEnum.STANDARD);
            expect(arsRate?.source).toBe(ExchangeRateSourceEnum.EXCHANGERATE_API);

            // Check BRL rate
            const brlRate = result.rates.find((r) => r.toCurrency === PriceCurrencyEnum.BRL);
            expect(brlRate).toBeDefined();
            expect(brlRate?.fromCurrency).toBe(PriceCurrencyEnum.USD);
            expect(brlRate?.toCurrency).toBe(PriceCurrencyEnum.BRL);
            expect(brlRate?.rate).toBe(5.12);
            expect(brlRate?.inverseRate).toBeCloseTo(1 / 5.12);
            expect(brlRate?.rateType).toBe(ExchangeRateTypeEnum.STANDARD);
            expect(brlRate?.source).toBe(ExchangeRateSourceEnum.EXCHANGERATE_API);
        });

        it('should include API key in the URL', async () => {
            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {
                    ARS: 1234.56,
                    BRL: 5.12
                }
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            await client.fetchLatestRates();

            expect(fetchMock).toHaveBeenCalledWith(
                'https://v6.exchangerate-api.com/v6/test-api-key/latest/USD',
                expect.any(Object)
            );
        });

        it('should handle 401 unauthorized (invalid API key)', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toBe(
                'HTTP 401: Invalid API key or authentication failed'
            );
        });

        it('should handle 429 rate limit exceeded', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toBe(
                'HTTP 429: Rate limit exceeded. Please try again later'
            );
        });

        it('should handle 500 server error', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toBe('HTTP 500: Server error (Internal Server Error)');
        });

        it('should handle timeout errors', async () => {
            fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toContain('Aborted');
        });

        it('should handle JSON parse errors', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new SyntaxError('Invalid JSON');
                },
                headers: new Map()
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toContain('Invalid JSON');
        });

        it('should handle non-success API result', async () => {
            const mockResponse = {
                result: 'error',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {}
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]?.error).toBe('API returned non-success result: error');
        });

        it('should handle empty conversion_rates', async () => {
            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {}
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle missing ARS rate', async () => {
            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {
                    BRL: 5.12,
                    EUR: 0.93
                }
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(1);
            expect(result.rates[0]?.toCurrency).toBe(PriceCurrencyEnum.BRL);
        });

        it('should handle missing BRL rate', async () => {
            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {
                    ARS: 1234.56,
                    EUR: 0.93
                }
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            const result = await client.fetchLatestRates();

            expect(result.rates).toHaveLength(1);
            expect(result.rates[0]?.toCurrency).toBe(PriceCurrencyEnum.ARS);
        });

        it('should log quota information when available in headers', async () => {
            const consoleSpy = vi.spyOn(console, 'info');

            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {
                    ARS: 1234.56,
                    BRL: 5.12
                }
            };

            const mockHeaders = new Headers();
            mockHeaders.set('x-ratelimit-remaining', '1500');

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: mockHeaders
            });

            await client.fetchLatestRates();

            expect(consoleSpy).toHaveBeenCalledWith(
                'ExchangeRate-API quota remaining: 1500 requests'
            );

            consoleSpy.mockRestore();
        });
    });

    describe('custom configuration', () => {
        it('should use custom baseUrl', async () => {
            const customClient = new ExchangeRateApiClient({
                apiKey: 'custom-key',
                baseUrl: 'https://custom.api.com/v2'
            });

            const mockResponse = {
                result: 'success',
                documentation: 'https://www.exchangerate-api.com/docs',
                terms_of_service: 'https://www.exchangerate-api.com/terms',
                time_last_update_unix: 1707820800,
                time_last_update_utc: 'Tue, 13 Feb 2026 12:00:00 +0000',
                time_next_update_unix: 1707907200,
                time_next_update_utc: 'Wed, 14 Feb 2026 12:00:00 +0000',
                base_code: 'USD',
                conversion_rates: {}
            };

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
                headers: new Map()
            });

            await customClient.fetchLatestRates();

            expect(fetchMock).toHaveBeenCalledWith(
                'https://custom.api.com/v2/custom-key/latest/USD',
                expect.any(Object)
            );
        });

        it('should respect custom timeout', async () => {
            const customClient = new ExchangeRateApiClient({
                apiKey: 'test-key',
                timeoutMs: 1000
            });

            // Mock a slow response that respects AbortController signal
            fetchMock.mockImplementation(
                (_url: string, options?: { signal?: AbortSignal }) =>
                    new Promise((resolve, reject) => {
                        const timer = setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: async () => ({
                                        result: 'success',
                                        conversion_rates: {}
                                    }),
                                    headers: new Map()
                                }),
                            2000
                        );

                        // Listen to abort signal
                        if (options?.signal) {
                            options.signal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(
                                    new DOMException('The operation was aborted.', 'AbortError')
                                );
                            });
                        }
                    })
            );

            const result = await customClient.fetchLatestRates();

            // Should timeout and return error
            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
        });
    });
});
