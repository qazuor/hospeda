/**
 * Destination Weather Fetch Cron Job Tests
 *
 * Mocks the service layer (WeatherFetcher.fetchAll / .persist, OpenMeteoClient)
 * and @repo/db (DestinationModel, withTransaction advisory-lock guard, sql tag).
 *
 * @module test/cron/destination-weather-fetch
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destinationWeatherFetchJob } from '../../src/cron/jobs/destination-weather-fetch.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

const { mockFetchAll, mockPersist, mockWithTransaction, _mockTx } = vi.hoisted(() => {
    const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
    };
    const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx));
    return {
        mockFetchAll: vi.fn().mockResolvedValue([]),
        mockPersist: vi.fn().mockResolvedValue({ processed: 0, updated: 0, errors: [] }),
        mockWithTransaction: withTx,
        _mockTx: tx
    };
});

vi.mock('@repo/db', () => ({
    DestinationModel: vi.fn(),
    withTransaction: mockWithTransaction,
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/service-core', () => ({
    OpenMeteoClient: vi.fn(),
    WeatherFetcher: vi.fn().mockImplementation(function () {
        return {
            fetchAll: mockFetchAll,
            persist: mockPersist
        };
    })
}));

describe('Destination Weather Fetch Cron Job', () => {
    let mockLogger: { info: Mock; warn: Mock; error: Mock; debug: Mock };
    let mockContext: CronJobContext;

    beforeEach(() => {
        mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
        mockContext = {
            logger: mockLogger,
            startedAt: new Date('2026-06-15T00:00:00Z'),
            dryRun: false
        };
        _mockTx.execute.mockResolvedValue({ rows: [{ acquired: true }] });
        mockFetchAll.mockResolvedValue([
            { destination: { id: 'a' }, weather: {} },
            { destination: { id: 'b' }, weather: {} },
            { destination: { id: 'c' }, weather: {} }
        ]);
        mockPersist.mockResolvedValue({ processed: 3, updated: 3, errors: [] });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Job Configuration', () => {
        it('has the expected configuration (twice-daily off-peak schedule)', () => {
            expect(destinationWeatherFetchJob.name).toBe('destination-weather-fetch');
            expect(destinationWeatherFetchJob.schedule).toBe('0 6,18 * * *');
            expect(destinationWeatherFetchJob.enabled).toBe(true);
            expect(typeof destinationWeatherFetchJob.handler).toBe('function');
        });
    });

    describe('Handler Execution', () => {
        it('refreshes weather and reports the counts in production mode', async () => {
            const result = await destinationWeatherFetchJob.handler(mockContext);

            expect(mockFetchAll).toHaveBeenCalledTimes(1);
            expect(mockPersist).toHaveBeenCalledWith(expect.any(Array), {
                dryRun: false,
                tx: _mockTx
            });
            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.message).toContain('Refreshed weather for 3/3');
            expect(result.details?.dryRun).toBe(false);
        });

        it('does not persist in dry-run mode', async () => {
            mockPersist.mockResolvedValue({ processed: 3, updated: 3, errors: [] });

            const result = await destinationWeatherFetchJob.handler({
                ...mockContext,
                dryRun: true
            });

            expect(mockPersist).toHaveBeenCalledWith(expect.any(Array), {
                dryRun: true,
                tx: _mockTx
            });
            expect(result.success).toBe(true);
            expect(result.message).toContain('Dry run');
            expect(result.details?.dryRun).toBe(true);
        });

        it('reports per-destination errors without failing the whole run as 0', async () => {
            mockPersist.mockResolvedValue({
                processed: 2,
                updated: 1,
                errors: [{ destinationId: 'a', slug: 'dest-a', error: 'timeout' }]
            });

            const result = await destinationWeatherFetchJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.errors).toBe(1);
            expect(result.processed).toBe(2);
        });

        it('handles a thrown error gracefully', async () => {
            mockFetchAll.mockRejectedValueOnce(new Error('boom'));

            const result = await destinationWeatherFetchJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to fetch destination weather');
            expect(result.errors).toBe(1);
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it('completes fetchAll() (no open transaction) before withTransaction/persist ever run', async () => {
            await destinationWeatherFetchJob.handler(mockContext);

            expect(mockFetchAll.mock.invocationCallOrder).toHaveLength(1);
            expect(mockWithTransaction.mock.invocationCallOrder).toHaveLength(1);
            expect(mockPersist.mock.invocationCallOrder).toHaveLength(1);

            const [fetchAllOrder] = mockFetchAll.mock.invocationCallOrder;
            const [withTransactionOrder] = mockWithTransaction.mock.invocationCallOrder;
            const [persistOrder] = mockPersist.mock.invocationCallOrder;
            if (
                fetchAllOrder === undefined ||
                withTransactionOrder === undefined ||
                persistOrder === undefined
            ) {
                throw new Error('expected all three mocks to have been invoked exactly once');
            }

            expect(fetchAllOrder).toBeLessThan(withTransactionOrder);
            expect(withTransactionOrder).toBeLessThan(persistOrder);
        });
    });

    describe('Advisory lock', () => {
        it('skips persisting when the transaction-scoped lock is not acquired, but the fetch phase still ran', async () => {
            _mockTx.execute.mockResolvedValueOnce({ rows: [{ acquired: false }] });

            const result = await destinationWeatherFetchJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.message).toContain('advisory lock not acquired');
            expect(result.details).toMatchObject({ skipped: true, reason: 'lock_not_acquired' });
            expect(mockPersist).not.toHaveBeenCalled();
            // Deliberate trade-off (see job doc-comment): the lock only guards
            // the write phase, so the remote fetch phase already ran.
            expect(mockFetchAll).toHaveBeenCalledTimes(1);
        });
    });
});
