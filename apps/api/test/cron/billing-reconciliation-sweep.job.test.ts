import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockSweep, mockClock, mockProvider } = vi.hoisted(() => ({
    mockSweep: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-11T12:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runReconciliationSweep: mockSweep
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));

import { billingReconciliationSweepJob } from '../../src/cron/jobs/billing-reconciliation-sweep.job';

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-10-11T12:00:00.000Z'),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun
    };
}

describe('billing reconciliation sweep cron', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the daily job metadata', () => {
        expect(billingReconciliationSweepJob).toMatchObject({
            name: 'billing-reconciliation-sweep',
            schedule: '0 6 * * *',
            enabled: true,
            timeoutMs: 600_000
        });
    });

    it('injects provider and clock and maps summary counters', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 8,
            rowsFailed: 2,
            divergences: 1,
            marksOpened: 1,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'failed-id', message: 'read failed' }],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(mockSweep).toHaveBeenCalledWith({}, { provider: mockProvider, clock: mockClock });
        expect(result).toMatchObject({ processed: 8, errors: 2, success: false });
        expect(result.details).toHaveProperty('failedSubscriptionIds', ['failed-id']);
        expect(result.details).not.toHaveProperty('failures');
    });

    it('does not call the service during dry run', async () => {
        const result = await billingReconciliationSweepJob.handler(context(true));
        expect(result).toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
        expect(mockSweep).not.toHaveBeenCalled();
    });

    it('reports a thrown service error as one failed job', async () => {
        mockSweep.mockRejectedValue(new Error('service failed'));
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: false, processed: 0, errors: 1 });
    });
});
