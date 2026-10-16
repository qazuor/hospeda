import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockSend, mockClock } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2099-06-02T12:00:00.000Z')) }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    sendPromoEndingNotices: mockSend
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { billingPromoEndingNoticeJob } from '../../src/cron/jobs/billing-promo-ending-notice.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2099-06-02T11:00:00.000Z'),
    runId: 'run-hos-1589',
    correlationId: '00000000-0000-4000-8000-000000001589',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({
        enqueued: 3,
        alreadyEnqueued: 1,
        notDue: 4,
        skipped: 2,
        failed: 1
    });
});

describe('TEST:B9b:5 AC:B9b:5 billing-promo-ending-notice cron', () => {
    it('(a) registers the requested schedule and enabled flag', () => {
        expect(billingPromoEndingNoticeJob).toMatchObject({
            name: 'billing-promo-ending-notice',
            schedule: '0 9 * * *',
            enabled: true
        });
    });
    it('(b) skips service writes on dry run', async () => {
        await expect(billingPromoEndingNoticeJob.handler(context(true))).resolves.toMatchObject({
            success: true,
            processed: 0,
            details: { dryRun: true }
        });
        expect(mockSend).not.toHaveBeenCalled();
    });
    it('(c) maps the service summary to processed and errors', async () => {
        const result = await billingPromoEndingNoticeJob.handler(context());
        expect(mockSend).toHaveBeenCalledWith({ limit: 1000 }, { clock: mockClock });
        expect(result).toMatchObject({
            success: true,
            processed: 3,
            errors: 1,
            details: { enqueued: 3, alreadyEnqueued: 1, notDue: 4, skipped: 2, failed: 1 }
        });
    });
    it('(d) returns failure when the service throws', async () => {
        mockSend.mockRejectedValueOnce(new Error('database down'));
        await expect(billingPromoEndingNoticeJob.handler(context())).resolves.toMatchObject({
            success: false,
            processed: 0,
            errors: 1,
            details: { error: 'database down' }
        });
    });
    it('(e) appears in the runtime registry and schedule manifest', () => {
        expect(cronJobs.find(({ name }) => name === 'billing-promo-ending-notice')?.schedule).toBe(
            '0 9 * * *'
        );
        expect(
            CRON_SCHEDULES.find(({ name }) => name === 'billing-promo-ending-notice')?.schedule
        ).toBe('0 9 * * *');
    });
});
