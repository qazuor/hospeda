/**
 * Exchange Rate Fetch Cron Job Tests
 *
 * Tests for the exchange rate fetching cron job.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { exchangeRateFetchJob } from '../../src/cron/jobs/exchange-rate-fetch.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// Mock modules
vi.mock('@repo/db', () => ({
    ExchangeRateModel: vi.fn().mockImplementation(() => ({
        findAll: vi.fn().mockResolvedValue({ items: [] }),
        create: vi.fn().mockResolvedValue({})
    }))
}));

vi.mock('@repo/service-core', () => ({
    DolarApiClient: vi.fn().mockImplementation(() => ({
        fetchAll: vi.fn().mockResolvedValue({
            rates: [],
            errors: []
        })
    })),
    ExchangeRateApiClient: vi.fn().mockImplementation(() => ({
        fetchLatestRates: vi.fn().mockResolvedValue({
            rates: [],
            errors: []
        })
    })),
    ExchangeRateFetcher: vi.fn().mockImplementation(() => ({
        fetchAndStore: vi.fn().mockResolvedValue({
            stored: 0,
            errors: [],
            fromManualOverride: 0,
            fromDolarApi: 0,
            fromExchangeRateApi: 0,
            fromDbFallback: 0
        })
    }))
}));

describe('Exchange Rate Fetch Cron Job', () => {
    let mockLogger: {
        info: Mock;
        warn: Mock;
        error: Mock;
        debug: Mock;
    };
    let mockContext: CronJobContext;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        mockContext = {
            logger: mockLogger,
            startedAt: new Date('2024-01-01T00:00:00Z'),
            dryRun: false
        };

        // Reset environment
        process.env.EXCHANGERATE_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Job Configuration', () => {
        it('should have correct job configuration', () => {
            expect(exchangeRateFetchJob.name).toBe('exchange-rate-fetch');
            expect(exchangeRateFetchJob.description).toBe(
                'Fetch latest exchange rates from DolarAPI and ExchangeRate-API'
            );
            expect(exchangeRateFetchJob.schedule).toBe('*/15 * * * *');
            expect(exchangeRateFetchJob.enabled).toBe(true);
            expect(exchangeRateFetchJob.timeoutMs).toBe(60000);
        });

        it('should have a valid handler function', () => {
            expect(exchangeRateFetchJob.handler).toBeDefined();
            expect(typeof exchangeRateFetchJob.handler).toBe('function');
        });
    });

    describe('Handler Execution', () => {
        it('should successfully fetch and store rates', async () => {
            const result = await exchangeRateFetchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Starting exchange rate fetch',
                expect.any(Object)
            );
        });

        it('should handle dry-run mode', async () => {
            const dryRunContext: CronJobContext = {
                ...mockContext,
                dryRun: true
            };

            const result = await exchangeRateFetchJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry run');
            expect(result.details?.dryRun).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Running in dry-run mode - simulating fetch'
            );
        });

        it('should handle errors gracefully', async () => {
            const { ExchangeRateFetcher } = await import('@repo/service-core');

            // Mock the fetcher to throw an error
            (ExchangeRateFetcher as Mock).mockImplementationOnce(() => ({
                fetchAndStore: vi.fn().mockRejectedValue(new Error('API error'))
            }));

            const result = await exchangeRateFetchJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to fetch exchange rates');
            expect(result.errors).toBe(1);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('should include correct details in result', async () => {
            const result = await exchangeRateFetchJob.handler(mockContext);

            expect(result.details).toBeDefined();
            expect(result.details).toHaveProperty('stored');
            expect(result.details).toHaveProperty('fromDolarApi');
            expect(result.details).toHaveProperty('fromExchangeRateApi');
            expect(result.details).toHaveProperty('fromManualOverride');
            expect(result.details).toHaveProperty('fromDbFallback');
        });
    });

    describe('Logging', () => {
        it('should log start message', async () => {
            await exchangeRateFetchJob.handler(mockContext);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Starting exchange rate fetch',
                expect.objectContaining({
                    dryRun: false,
                    startedAt: expect.any(String)
                })
            );
        });

        it('should log completion message', async () => {
            await exchangeRateFetchJob.handler(mockContext);

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Running in production mode - fetching and storing rates'
            );
        });

        it('should log error details on failure', async () => {
            const { ExchangeRateFetcher } = await import('@repo/service-core');

            // Mock the fetcher to throw an error
            const testError = new Error('Test API failure');
            (ExchangeRateFetcher as Mock).mockImplementationOnce(() => ({
                fetchAndStore: vi.fn().mockRejectedValue(testError)
            }));

            await exchangeRateFetchJob.handler(mockContext);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Exchange rate fetch failed',
                expect.objectContaining({
                    error: 'Test API failure',
                    stack: expect.any(String)
                })
            );
        });
    });
});
