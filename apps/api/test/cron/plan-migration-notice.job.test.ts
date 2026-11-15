import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

const { mockSend, mockClock } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2099-06-02T12:00:00.000Z')) }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    sendPlanMigrationNotices: mockSend
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { planMigrationNoticeJob } from '../../src/cron/jobs/plan-migration-notice.job.js';
import { cronJobs } from '../../src/cron/registry.js';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest.js';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2099-06-02T11:00:00.000Z'),
    runId: 'run-hos-1613',
    correlationId: '00000000-0000-4000-8000-000000001613',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({
        enqueued: 3,
        alreadyEnqueued: 1,
        recalculated: 2,
        notDue: 4,
        waiting: 2,
        skipped: 0,
        failed: 1,
        rows: []
    });
});

describe('TEST:B12:3 AC:B12:3 plan migration notice cron', () => {
    it('registers an enabled daily slot after next-charge sync', () => {
        expect(planMigrationNoticeJob).toMatchObject({
            name: 'plan-migration-notice',
            schedule: '17 9 * * *',
            enabled: true
        });
        expect(cronJobs.filter(({ name }) => name === 'plan-migration-notice')).toHaveLength(1);
        expect(CRON_SCHEDULES.find(({ name }) => name === 'plan-migration-notice')).toEqual({
            name: 'plan-migration-notice',
            displayName: 'Avisos de migración de plan',
            category: 'billing',
            schedule: '17 9 * * *',
            description: 'Enqueue due retirement migration reminders for each customer (HOS-1613).'
        });
    });

    it('does not call the service in dry run', async () => {
        await expect(planMigrationNoticeJob.handler(context(true))).resolves.toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
        expect(mockSend).toHaveBeenCalledTimes(0);
    });

    it('passes the injected clock and reports per-row failures', async () => {
        const result = await planMigrationNoticeJob.handler(context());
        expect(mockSend).toHaveBeenCalledWith({ limit: 1000 }, { clock: mockClock });
        expect(result).toMatchObject({ success: true, processed: 3, errors: 1 });
    });

    it('reports a run-level failure', async () => {
        mockSend.mockRejectedValueOnce(new Error('database down'));
        await expect(planMigrationNoticeJob.handler(context())).resolves.toMatchObject({
            success: false,
            processed: 0,
            errors: 1,
            details: { error: 'database down' }
        });
    });
});
