import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockSend, mockClock } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    sendRenewalNotices: mockSend
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { subscriptionRenewalNoticeJob } from '../../src/cron/jobs/subscription-renewal-notice.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-hos-1622',
    correlationId: '00000000-0000-4000-8000-000000001622',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({
        enqueued: 3,
        alreadyEnqueued: 1,
        stamped: 2,
        notDue: 4,
        skipped: 0,
        failed: 1,
        rows: []
    });
});

describe('HOS-1622 subscription-renewal-notice cron (AC:B13a:13)', () => {
    it('registers the expected name, schedule, enabled flag and timeout', () => {
        expect(subscriptionRenewalNoticeJob).toMatchObject({
            name: 'subscription-renewal-notice',
            schedule: '0 9 * * *',
            enabled: true,
            timeoutMs: 120_000
        });
    });

    it('does not call the service in dry run', async () => {
        const result = await subscriptionRenewalNoticeJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('calls the service once with limit and the production clock, then maps counts', async () => {
        const result = await subscriptionRenewalNoticeJob.handler(context());
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith({ limit: 1000 }, { clock: mockClock });
        expect(result).toMatchObject({
            success: true,
            processed: 3,
            errors: 1,
            details: { enqueued: 3, alreadyEnqueued: 1, stamped: 2, notDue: 4, failed: 1 }
        });
        expect(result.details).not.toHaveProperty('rows');
    });

    it('returns failure without throwing when the service fails', async () => {
        mockSend.mockRejectedValueOnce(new Error('database down'));
        await expect(subscriptionRenewalNoticeJob.handler(context())).resolves.toMatchObject({
            success: false,
            processed: 0,
            errors: 1,
            details: { error: 'database down' }
        });
    });

    it('uses the same name and schedule in the registry and manifest', () => {
        expect(cronJobs.find(({ name }) => name === 'subscription-renewal-notice')?.schedule).toBe(
            '0 9 * * *'
        );
        expect(
            CRON_SCHEDULES.find(({ name }) => name === 'subscription-renewal-notice')?.schedule
        ).toBe('0 9 * * *');
    });
});
