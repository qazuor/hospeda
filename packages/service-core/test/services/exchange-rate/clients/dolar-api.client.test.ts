import { ExchangeRateSourceEnum, ExchangeRateTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DolarApiClient } from '../../../../src/services/exchange-rate/clients/dolar-api.client.js';

describe('DolarApiClient', () => {
    let client: DolarApiClient;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        client = new DolarApiClient();
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchDolarRates', () => {
        it('should fetch and parse USD/ARS rates successfully', async () => {
            const mockResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Oficial',
                    compra: 950.5,
                    venta: 990.5,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'blue',
                    nombre: 'Blue',
                    compra: 1150,
                    venta: 1180,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(2);
            expect(result.errors).toHaveLength(0);

            const oficialRate = result.rates.find(
                (r) => r.rateType === ExchangeRateTypeEnum.OFICIAL
            );
            expect(oficialRate).toBeDefined();
            expect(oficialRate?.fromCurrency).toBe(PriceCurrencyEnum.USD);
            expect(oficialRate?.toCurrency).toBe(PriceCurrencyEnum.ARS);
            expect(oficialRate?.rate).toBe(990.5);
            expect(oficialRate?.inverseRate).toBeCloseTo(1 / 990.5);
            expect(oficialRate?.source).toBe(ExchangeRateSourceEnum.DOLARAPI);

            const blueRate = result.rates.find((r) => r.rateType === ExchangeRateTypeEnum.BLUE);
            expect(blueRate).toBeDefined();
            expect(blueRate?.rate).toBe(1180);
        });

        it('should map all casa types correctly', async () => {
            const mockResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'blue',
                    nombre: 'Blue',
                    compra: 1150,
                    venta: 1180,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'bolsa',
                    nombre: 'Bolsa',
                    compra: 1100,
                    venta: 1120,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'contadoconliqui',
                    nombre: 'Contado con liquidación',
                    compra: 1130,
                    venta: 1150,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'tarjeta',
                    nombre: 'Tarjeta',
                    compra: 1400,
                    venta: 1450,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(5);

            const rateTypes = result.rates.map((r) => r.rateType);
            expect(rateTypes).toContain(ExchangeRateTypeEnum.OFICIAL);
            expect(rateTypes).toContain(ExchangeRateTypeEnum.BLUE);
            expect(rateTypes).toContain(ExchangeRateTypeEnum.MEP);
            expect(rateTypes).toContain(ExchangeRateTypeEnum.CCL);
            expect(rateTypes).toContain(ExchangeRateTypeEnum.TARJETA);
        });

        it('should skip unknown casa types', async () => {
            const mockResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'mayorista',
                    nombre: 'Mayorista',
                    compra: 945,
                    venta: 955,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'cripto',
                    nombre: 'Cripto',
                    compra: 1200,
                    venta: 1250,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchDolarRates();

            // Should only include oficial, skip mayorista and cripto
            expect(result.rates).toHaveLength(1);
            expect(result.rates[0].rateType).toBe(ExchangeRateTypeEnum.OFICIAL);
        });

        it('should handle HTTP error responses', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('HTTP 500');
        });

        it('should handle timeout errors', async () => {
            fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Aborted');
        });

        it('should handle JSON parse errors', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new SyntaxError('Invalid JSON');
                }
            });

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('Invalid JSON');
        });

        it('should handle empty response', async () => {
            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => []
            });

            const result = await client.fetchDolarRates();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('fetchAllCotizaciones', () => {
        it('should fetch and parse BRL rates successfully', async () => {
            const mockResponse = [
                {
                    moneda: 'BRL',
                    casa: 'oficial',
                    nombre: 'Real Brasileño',
                    compra: 175,
                    venta: 185,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchAllCotizaciones();

            expect(result.rates).toHaveLength(1);
            expect(result.errors).toHaveLength(0);

            const brlRate = result.rates[0];
            expect(brlRate.fromCurrency).toBe(PriceCurrencyEnum.ARS);
            expect(brlRate.toCurrency).toBe(PriceCurrencyEnum.BRL);
            expect(brlRate.rate).toBe(185);
            expect(brlRate.inverseRate).toBeCloseTo(1 / 185);
            expect(brlRate.rateType).toBe(ExchangeRateTypeEnum.OFICIAL);
            expect(brlRate.source).toBe(ExchangeRateSourceEnum.DOLARAPI);
        });

        it('should parse USD rates from cotizaciones', async () => {
            const mockResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Dólar Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'blue',
                    nombre: 'Dólar Blue',
                    compra: 1150,
                    venta: 1180,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchAllCotizaciones();

            expect(result.rates).toHaveLength(2);

            const usdRates = result.rates.filter((r) => r.fromCurrency === PriceCurrencyEnum.USD);
            expect(usdRates).toHaveLength(2);
        });

        it('should parse mixed USD and BRL rates', async () => {
            const mockResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Dólar Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'BRL',
                    casa: 'oficial',
                    nombre: 'Real Brasileño',
                    compra: 175,
                    venta: 185,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await client.fetchAllCotizaciones();

            expect(result.rates).toHaveLength(2);

            const usdRate = result.rates.find((r) => r.fromCurrency === PriceCurrencyEnum.USD);
            const brlRate = result.rates.find((r) => r.toCurrency === PriceCurrencyEnum.BRL);

            expect(usdRate).toBeDefined();
            expect(brlRate).toBeDefined();
        });

        it('should handle HTTP error responses', async () => {
            fetchMock.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const result = await client.fetchAllCotizaciones();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].error).toContain('HTTP 404');
        });
    });

    describe('fetchAll', () => {
        it('should combine rates from both endpoints', async () => {
            const dolaresResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                },
                {
                    moneda: 'USD',
                    casa: 'blue',
                    nombre: 'Blue',
                    compra: 1150,
                    venta: 1180,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            const cotizacionesResponse = [
                {
                    moneda: 'BRL',
                    casa: 'oficial',
                    nombre: 'Real Brasileño',
                    compra: 175,
                    venta: 185,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => dolaresResponse
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => cotizacionesResponse
                });

            const result = await client.fetchAll();

            expect(result.rates).toHaveLength(3);

            const usdRates = result.rates.filter((r) => r.fromCurrency === PriceCurrencyEnum.USD);
            const brlRates = result.rates.filter((r) => r.toCurrency === PriceCurrencyEnum.BRL);

            expect(usdRates).toHaveLength(2);
            expect(brlRates).toHaveLength(1);
        });

        it('should combine errors from both endpoints', async () => {
            fetchMock
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Server Error'
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                    statusText: 'Service Unavailable'
                });

            const result = await client.fetchAll();

            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].error).toContain('HTTP 500');
            expect(result.errors[1].error).toContain('HTTP 503');
        });

        it('should handle partial failures', async () => {
            const dolaresResponse = [
                {
                    moneda: 'USD',
                    casa: 'oficial',
                    nombre: 'Oficial',
                    compra: 950,
                    venta: 990,
                    fechaActualizacion: '2026-02-13T12:00:00Z'
                }
            ];

            fetchMock
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => dolaresResponse
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Server Error'
                });

            const result = await client.fetchAll();

            expect(result.rates).toHaveLength(1);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('custom configuration', () => {
        it('should use custom baseUrl', async () => {
            const customClient = new DolarApiClient({
                baseUrl: 'https://custom.api.com/v2'
            });

            fetchMock.mockResolvedValue({
                ok: true,
                json: async () => []
            });

            await customClient.fetchDolarRates();

            expect(fetchMock).toHaveBeenCalledWith(
                'https://custom.api.com/v2/dolares',
                expect.any(Object)
            );
        });

        it('should respect custom timeout', async () => {
            const customClient = new DolarApiClient({
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
                                    json: async () => []
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

            const result = await customClient.fetchDolarRates();

            // Should timeout and return error
            expect(result.rates).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
        });
    });
});
