import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockTick, mockClock, mockWindowLatest } = vi.hoisted(() => ({
    mockTick: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockWindowLatest: vi.fn()
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    reconciliationSummaryWindowModel: { findLatest: mockWindowLatest }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runReconciliationSummaryTick: mockTick
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { billingReconciliationSummaryJob } from '../../src/cron/jobs/billing-reconciliation-summary.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-hos-1607',
    correlationId: '00000000-0000-4000-8000-000000001607',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockTick.mockResolvedValue('IDLE');
    mockWindowLatest.mockResolvedValue({ id: 'window-1607', eventCount: 3 });
});

describe('TEST:1607:17 reconciliation summary cron', () => {
    it('registers its schedule and timeout', () => {
        expect(billingReconciliationSummaryJob).toMatchObject({
            name: 'billing-reconciliation-summary',
            schedule: '*/5 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
        expect(
            cronJobs.find(({ name }) => name === billingReconciliationSummaryJob.name)?.schedule
        ).toBe('*/5 * * * *');
        expect(
            CRON_SCHEDULES.find(({ name }) => name === billingReconciliationSummaryJob.name)
                ?.schedule
        ).toBe('*/5 * * * *');
    });
    it('skips the service in dry run', async () => {
        await expect(billingReconciliationSummaryJob.handler(context(true))).resolves.toMatchObject(
            {
                success: true,
                processed: 0,
                details: { dryRun: true }
            }
        );
        expect(mockTick).not.toHaveBeenCalled();
    });
    it('calls once with production time and correlation id and maps every outcome', async () => {
        for (const outcome of [
            'IDLE',
            'WINDOW_OPENED',
            'WAITING',
            'SENT',
            'NO_RECIPIENTS'
        ] as const) {
            mockTick.mockResolvedValueOnce(outcome);
            const result = await billingReconciliationSummaryJob.handler(context());
            expect(result.details).toMatchObject({ outcome });
            expect(result.success).toBe(outcome !== 'NO_RECIPIENTS');
            expect(result.errors).toBe(outcome === 'NO_RECIPIENTS' ? 1 : 0);
            if (outcome === 'SENT') expect(result.processed).toBe(3);
        }
        expect(mockTick).toHaveBeenCalledTimes(5);
        expect(mockTick).toHaveBeenNthCalledWith(1, {
            now: new Date('2026-10-14T20:00:00.000Z'),
            correlationId: '00000000-0000-4000-8000-000000001607'
        });
        expect(mockWindowLatest).toHaveBeenCalledTimes(5);
    });
    it('returns service errors without throwing', async () => {
        mockTick.mockRejectedValueOnce(new Error('database down'));
        await expect(billingReconciliationSummaryJob.handler(context())).resolves.toMatchObject({
            success: false,
            errors: 1,
            details: { error: 'database down' }
        });
    });
});
