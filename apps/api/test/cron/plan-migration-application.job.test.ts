import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

const { mockRun, mockClock, mockProvider } = vi.hoisted(() => ({
    mockRun: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2031-12-04T13:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn(), changeAmount: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runPlanMigrationS37: mockRun
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));

import { planMigrationApplicationJob } from '../../src/cron/jobs/plan-migration-application.job.js';
import { cronJobs } from '../../src/cron/registry.js';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest.js';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2031-12-04T12:00:00.000Z'),
    runId: 'run-hos-1614',
    correlationId: '00000000-0000-4000-8000-000000001614',
    dryRun
});

function summary(overrides: Record<string, unknown> = {}) {
    return {
        skipped: 0,
        waiting: 0,
        notDue: 0,
        appliedManual: 1,
        noticePending: 0,
        notAuthorized: 0,
        appliedCard: 1,
        notApplied: 0,
        mutatedButRowLeft: 0,
        awaitingSweep: 0,
        diverged: 0,
        escalated: 0,
        failed: 0,
        failedIds: [] as string[],
        rows: [
            { planMigrationSubscriptionId: 'a', outcome: 'APPLIED_MANUAL' },
            { planMigrationSubscriptionId: 'b', outcome: 'APPLIED_CARD', escalated: false }
        ],
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue(summary());
});

describe('TEST:B12:4 AC:B12:4 plan migration application cron', () => {
    it('registers an enabled hourly slot on a free Mercado Pago minute', () => {
        expect(planMigrationApplicationJob).toMatchObject({
            name: 'plan-migration-application',
            schedule: '28 * * * *',
            exclusive: true,
            enabled: true
        });
        expect(cronJobs.filter(({ name }) => name === 'plan-migration-application')).toHaveLength(
            1
        );
        expect(CRON_SCHEDULES.find(({ name }) => name === 'plan-migration-application')).toEqual({
            name: 'plan-migration-application',
            displayName: 'Aplicación de migraciones de plan',
            category: 'billing',
            schedule: '28 * * * *',
            description:
                'Run S37 on due retirement migration rows seven days before their application date (HOS-1614, AC:B12:4-5).'
        });
    });

    it('does not call the service in dry run', async () => {
        await expect(planMigrationApplicationJob.handler(context(true))).resolves.toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
        expect(mockRun).toHaveBeenCalledTimes(0);
    });

    it('passes the injected clock and provider and reports an applied run', async () => {
        const result = await planMigrationApplicationJob.handler(context());
        expect(mockRun).toHaveBeenCalledWith(
            { limit: 500, correlationId: '00000000-0000-4000-8000-000000001614' },
            { provider: mockProvider, clock: mockClock }
        );
        expect(result).toMatchObject({ success: true, processed: 2, errors: 0 });
    });

    it('reports success false when a row failed', async () => {
        const ctx = context();
        mockRun.mockResolvedValueOnce(
            summary({
                failed: 1,
                failedIds: ['00000000-0000-4000-8000-0000000000ff'],
                rows: [
                    { planMigrationSubscriptionId: 'a', outcome: 'APPLIED_MANUAL' },
                    {
                        planMigrationSubscriptionId: '00000000-0000-4000-8000-0000000000ff',
                        outcome: 'FAILED',
                        error: 'boom'
                    }
                ]
            })
        );
        const result = await planMigrationApplicationJob.handler(ctx);
        expect(result).toMatchObject({ success: false, processed: 2, errors: 1 });
        expect(ctx.logger.warn).toHaveBeenCalled();
    });

    it('reports a run-level failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('database down'));
        await expect(planMigrationApplicationJob.handler(context())).resolves.toMatchObject({
            success: false,
            processed: 0,
            errors: 1,
            details: { error: 'database down' }
        });
    });
});
