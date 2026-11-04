import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockRetry, mockClock, mockProvider } = vi.hoisted(() => ({
    mockRetry: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-11-03T12:00:00.000Z')) },
    mockProvider: { readSubscription: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runNoticeDeferredCancellationRetry: mockRetry
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));

import { billingDeferredCancellationRetryJob } from '../../src/cron/jobs/billing-deferred-cancellation-retry.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';
import {
    beforeCancelNotice,
    beforeCancelNoticeStatus
} from '../../src/routes/billing-subscription/before-cancel-notice';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-11-03T11:00:00.000Z'),
    runId: 'run-hos-1955',
    correlationId: '00000000-0000-4000-8000-000000001955',
    dryRun
});

const summary = {
    candidates: 3,
    noRecipient: 0,
    undeclared: 0,
    noticePending: 1,
    noticeAbsent: 0,
    settledLongAgo: 0,
    deferredToNextRun: 0,
    retried: { confirmed: 1, callFailed: 2 },
    rowsRead: 3,
    rowsFailed: 0,
    failures: []
};

beforeEach(() => {
    vi.clearAllMocks();
    mockRetry.mockResolvedValue(summary);
});

describe('TEST:1955:7 AC:1955:5 deferred cancellation retry cron', () => {
    it('registers the required schedule and timeout', () => {
        expect(billingDeferredCancellationRetryJob).toMatchObject({
            name: 'billing-deferred-cancellation-retry',
            schedule: '4-59/5 * * * *',
            enabled: true,
            timeoutMs: 240_000
        });
    });

    it('passes exactly the required service input and ports', async () => {
        await billingDeferredCancellationRetryJob.handler(context());
        expect(mockRetry).toHaveBeenCalledTimes(1);
        const [input, ports] = mockRetry.mock.calls[0] ?? [];
        expect(input).toStrictEqual({
            correlationId: '00000000-0000-4000-8000-000000001955',
            // Tracks billing-reconciliation-sweep's timeout, raised to 50 min by HOS-1999.
            sweepRunMaxAgeMs: 3_000_000
        });
        expect(Object.keys(ports).sort()).toEqual([
            'beforeCancelNotice',
            'cancellationSeen',
            'clock',
            'markPayments',
            'noticeStatus',
            'provider'
        ]);
        expect(ports.provider).toBe(mockProvider);
        expect(ports.clock).toBe(mockClock);
        expect(ports.beforeCancelNotice).toBe(beforeCancelNotice);
        expect(ports.noticeStatus).toBe(beforeCancelNoticeStatus);
    });

    it('reports provider call failures without failing the cron run', async () => {
        const ctx = context();
        const result = await billingDeferredCancellationRetryJob.handler(ctx);
        expect(result).toMatchObject({ success: true, processed: 3, errors: 2 });
        expect(result.details).toMatchObject({ failedSubscriptionIds: [] });
        expect(ctx.logger.warn).toHaveBeenCalledTimes(1);
    });

    it('fails the cron run when a row fails', async () => {
        mockRetry.mockResolvedValueOnce({
            ...summary,
            rowsFailed: 1,
            failures: [{ subscriptionId: 'id', message: 'Error' }]
        });
        const result = await billingDeferredCancellationRetryJob.handler(context());
        expect(result).toMatchObject({
            success: false,
            errors: 3,
            details: { failedSubscriptionIds: ['id'] }
        });
    });

    it('treats an open daily sweep as a successful skip', async () => {
        mockRetry.mockResolvedValueOnce({ ...summary, skipped: 'SWEEP_RUNNING' });
        const result = await billingDeferredCancellationRetryJob.handler(context());
        expect(result).toMatchObject({ success: true, details: { skipped: 'SWEEP_RUNNING' } });
    });

    it('does not invoke the service during dry run', async () => {
        const result = await billingDeferredCancellationRetryJob.handler(context(true));
        expect(mockRetry).not.toHaveBeenCalled();
        expect(result).toMatchObject({ success: true, details: { dryRun: true } });
    });

    it('reports an unexpected service error', async () => {
        mockRetry.mockRejectedValueOnce(new Error('database unavailable'));
        const result = await billingDeferredCancellationRetryJob.handler(context());
        expect(result).toMatchObject({ success: false, errors: 1 });
    });

    it('is registered with the exact manifest entry', () => {
        expect(cronJobs).toContain(billingDeferredCancellationRetryJob);
        expect(
            CRON_SCHEDULES.find((entry) => entry.name === 'billing-deferred-cancellation-retry')
        ).toEqual({
            name: 'billing-deferred-cancellation-retry',
            displayName: 'Reintento de cancelaciones diferidas por el aviso',
            category: 'billing',
            schedule: '4-59/5 * * * *',
            description:
                'Retry, minutes after their before-cancel notice is sent, the provider cancellations our transitions deferred with NOTICE_PENDING (HOS-1955, AC:B11:6).'
        });
    });
});
