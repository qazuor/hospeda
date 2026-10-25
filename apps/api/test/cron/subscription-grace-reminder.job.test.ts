import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockSend, mockClock } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    sendGraceReminders: mockSend
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { subscriptionGraceReminderJob } from '../../src/cron/jobs/subscription-grace-reminder.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run',
    correlationId: '00000000-0000-4000-8000-000000000001',
    dryRun
});
beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({
        enqueued: 3,
        alreadyEnqueued: 1,
        notDue: 4,
        noDeadline: 2,
        skipped: 0,
        failed: 1,
        rows: []
    });
});

describe('TEST:1707:6 AC:1707:6 subscription grace reminder cron', () => {
    it('registers schedule and timeout', () =>
        expect(subscriptionGraceReminderJob).toMatchObject({
            name: 'subscription-grace-reminder',
            schedule: '0 9 * * *',
            enabled: true,
            timeoutMs: 120_000
        }));
    it('skips service in dry run', async () => {
        await expect(subscriptionGraceReminderJob.handler(context(true))).resolves.toMatchObject({
            success: true,
            processed: 0,
            details: { dryRun: true }
        });
        expect(mockSend).not.toHaveBeenCalled();
    });
    it('maps service counts', async () => {
        await expect(subscriptionGraceReminderJob.handler(context())).resolves.toMatchObject({
            success: true,
            processed: 3,
            errors: 1,
            details: { enqueued: 3, alreadyEnqueued: 1, noDeadline: 2, failed: 1 }
        });
        expect(mockSend).toHaveBeenCalledWith({ limit: 1000 }, { clock: mockClock });
    });
    it('maps errors and appears in registry and manifest', async () => {
        mockSend.mockRejectedValueOnce(new Error('database down'));
        await expect(subscriptionGraceReminderJob.handler(context())).resolves.toMatchObject({
            success: false,
            details: { error: 'database down' }
        });
        expect(cronJobs.find(({ name }) => name === 'subscription-grace-reminder')?.schedule).toBe(
            '0 9 * * *'
        );
        expect(
            CRON_SCHEDULES.find(({ name }) => name === 'subscription-grace-reminder')
        ).toMatchObject({
            schedule: '0 9 * * *',
            displayName: 'Recordatorios del grace',
            category: 'billing'
        });
    });
});
