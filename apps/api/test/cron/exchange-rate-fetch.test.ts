/**
 * Exchange Rate Fetch Cron Job Tests
 *
 * Tests for the exchange rate fetching cron job.
 *
 * Mocking strategy: mocks the service layer (@repo/service-core)
 * instead of the DB layer (@repo/db). The ExchangeRateFetcher,
 * DolarApiClient, and ExchangeRateApiClient from service-core handle
 * all data access, so we mock them at the service boundary.
 * `@repo/db` is mocked for `withTransaction` (advisory lock guard) and
 * `sql` tag (used to build the lock probe query).
 *
 * @module test/cron/exchange-rate-fetch
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { exchangeRateFetchJob } from '../../src/cron/jobs/exchange-rate-fetch.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Hoisted: build the tx stub and withTransaction mock before vi.mock() runs
// ---------------------------------------------------------------------------

const { mockWithTransaction, _mockTx } = vi.hoisted(() => {
    const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
    };
    const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx));
    return {
        mockWithTransaction: withTx,
        _mockTx: tx
    };
});

// Mock env module
vi.mock('../../src/utils/env.js', () => ({
    env: {
        HOSPEDA_EXCHANGE_RATE_API_KEY: 'test-api-key'
    }
}));

// Mock @repo/db for ExchangeRateModel, withTransaction, and sql.
// withTransaction drives the advisory lock guard added in SPEC-194 T-020.
vi.mock('@repo/db', () => ({
    ExchangeRateModel: vi.fn(),
    withTransaction: mockWithTransaction,
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

// Mock apiLogger so we can assert on the lock-skip warn
vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock service layer: these classes encapsulate all data fetching and storage.
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

        // Default: advisory lock acquired
        _mockTx.execute.mockResolvedValue({ rows: [{ acquired: true }] });
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

    describe('Advisory lock (SPEC-194 T-020)', () => {
        it('skips without fetching when lock is not acquired', async () => {
            // Arrange: simulate another replica holding the lock
            vi.mocked(mockWithTransaction).mockImplementationOnce(
                async (callback: (tx: typeof _mockTx) => Promise<unknown>) => {
                    const txStub = {
                        execute: vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] })
                    };
                    return callback(txStub);
                }
            );
            const { ExchangeRateFetcher } = await import('@repo/service-core');

            // Act
            const result = await exchangeRateFetchJob.handler(mockContext);

            // Assert: job skips without touching the fetcher
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.message).toContain('advisory lock not acquired');
            expect(result.details).toMatchObject({ skipped: true, reason: 'lock_not_acquired' });
            expect(ExchangeRateFetcher).not.toHaveBeenCalled();
        });

        it('logs a warning when the advisory lock is not acquired', async () => {
            // Arrange
            vi.mocked(mockWithTransaction).mockImplementationOnce(
                async (callback: (tx: typeof _mockTx) => Promise<unknown>) => {
                    const txStub = {
                        execute: vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] })
                    };
                    return callback(txStub);
                }
            );
            const { apiLogger } = await import('../../src/utils/logger.js');

            // Act
            await exchangeRateFetchJob.handler(mockContext);

            // Assert
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('previous run still holds advisory lock')
            );
        });
    });
});
