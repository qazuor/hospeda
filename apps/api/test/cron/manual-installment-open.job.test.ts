import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockOpen, mockClock, mockPolicy, mockFacts } = vi.hoisted(() => ({
    mockOpen: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockPolicy: vi.fn(),
    mockFacts: { emit: vi.fn() }
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    planCatalogModel: {}
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    openDueManualInstallments: mockOpen
}));
vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createPlanCatalogInverse: () => ({ planPolicy: mockPolicy })
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/analytics/analytics-facts.js', () => ({
    getAnalyticsFactSink: () => mockFacts
}));

import { manualInstallmentOpenJob } from '../../src/cron/jobs/manual-installment-open.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-hos-1541-manual-installment-open',
    correlationId: '00000000-0000-4000-8000-000000001541',
    dryRun
});

const summary = { opened: 4, alreadyOpen: 2, skipped: 1, errors: 1 };
beforeEach(() => {
    vi.clearAllMocks();
    mockOpen.mockResolvedValue(summary);
});

describe('HOS-1541 manual installment opening clock (AC:B5:13)', () => {
    it('registers the job and its manifest entry at minute 13', () => {
        expect(manualInstallmentOpenJob).toMatchObject({
            name: 'manual-installment-open',
            schedule: '13 * * * *',
            enabled: true,
            timeoutMs: 300_000
        });
        expect(cronJobs.filter((job) => job.name === manualInstallmentOpenJob.name)).toHaveLength(
            1
        );
        expect(
            CRON_SCHEDULES.find((entry) => entry.name === manualInstallmentOpenJob.name)
        ).toEqual({
            name: 'manual-installment-open',
            displayName: 'Apertura de cuotas de pago manual',
            category: 'billing',
            schedule: '13 * * * *',
            description: 'Open due manual installments and apply S4 (HOS-1541, AC:B5:13, MP5).'
        });
    });

    it('calls MP5 with a page of 100 and only the clock, policy and fact ports', async () => {
        await manualInstallmentOpenJob.handler(context());
        expect(mockOpen).toHaveBeenCalledTimes(1);
        const [input, ports] = mockOpen.mock.calls[0] ?? [];
        expect(input).toStrictEqual({ pageSize: 100 });
        expect(ports.clock).toBe(mockClock);
        expect(ports.planPolicy).toBe(mockPolicy);
        expect(ports.billingFacts).toBe(mockFacts);
        expect(Object.keys(ports).sort()).toEqual(['billingFacts', 'clock', 'planPolicy']);
    });

    it('returns the exact service summary', async () => {
        const result = await manualInstallmentOpenJob.handler(context());
        expect(result).toMatchObject({
            success: true,
            message: 'Opened 4 manual installments',
            processed: 4,
            errors: 1,
            details: summary
        });
    });

    it('skips the service in dry run', async () => {
        const result = await manualInstallmentOpenJob.handler(context(true));
        expect(mockOpen).toHaveBeenCalledTimes(0);
        expect(result).toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
    });

    it('reports an error as a failed run', async () => {
        mockOpen.mockRejectedValueOnce(new Error('database unavailable'));
        const result = await manualInstallmentOpenJob.handler(context());
        expect(result).toMatchObject({
            success: false,
            message: 'Manual installment opening failed: database unavailable',
            processed: 0,
            errors: 1,
            details: { error: 'database unavailable' }
        });
    });
});
