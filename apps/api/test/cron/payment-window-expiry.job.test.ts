import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockExpire, mockClock, mockProvider } = vi.hoisted(() => ({
    mockExpire: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockProvider: { readCharge: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    expireLapsedPayments: mockExpire
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));

import { paymentWindowExpiryJob } from '../../src/cron/jobs/payment-window-expiry.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-hos-1709-payment-window-expiry',
    correlationId: '00000000-0000-4000-8000-000000001709',
    dryRun
});

const summary = { scanned: 17, failed: 5, notPending: 3, open: 7, errors: 2 };

beforeEach(() => {
    vi.clearAllMocks();
    mockExpire.mockResolvedValue(summary);
});

describe('HOS-1709 payment-window-expiry cron (AC:1709:4)', () => {
    it('TEST:1709:8 AC:1709:4 (a) registers the hourly job with the required settings', () => {
        expect(paymentWindowExpiryJob).toMatchObject({
            name: 'payment-window-expiry',
            schedule: '20 * * * *',
            enabled: true,
            timeoutMs: 300_000
        });
    });

    it('TEST:1709:8 AC:1709:4 (b) calls the service with only its provider and clock ports', async () => {
        await paymentWindowExpiryJob.handler(context());

        expect(mockExpire).toHaveBeenCalledTimes(1);
        const [input, ports] = mockExpire.mock.calls[0] ?? [];
        expect(input).toStrictEqual({ pageSize: 100 });
        expect(ports.provider).toBe(mockProvider);
        expect(ports.clock).toBe(mockClock);
        expect(Object.keys(ports).sort()).toEqual(['clock', 'provider']);
    });

    it('TEST:1709:8 AC:1709:4 (c) returns the service summary in the job result', async () => {
        const result = await paymentWindowExpiryJob.handler(context());

        expect(result).toMatchObject({
            success: true,
            message: 'Failed 5 lapsed payments',
            processed: 5,
            errors: 2,
            details: summary
        });
    });

    it('TEST:1709:8 AC:1709:4 (d) skips the service in dry run', async () => {
        const result = await paymentWindowExpiryJob.handler(context(true));

        expect(mockExpire).toHaveBeenCalledTimes(0);
        expect(result).toMatchObject({
            success: true,
            message: 'Dry run - no payment windows expired',
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
    });

    it('TEST:1709:8 AC:1709:4 (e) reports a service rejection as a failed run', async () => {
        mockExpire.mockRejectedValueOnce(new Error('database unavailable'));

        const result = await paymentWindowExpiryJob.handler(context());

        expect(result).toMatchObject({
            success: false,
            message: 'Payment window expiry failed: database unavailable',
            processed: 0,
            errors: 1,
            details: { error: 'database unavailable' }
        });
    });

    it('TEST:1709:8 AC:1709:4 (f) registers the job and its complete manifest entry', () => {
        expect(cronJobs).toContain(paymentWindowExpiryJob);
        expect(CRON_SCHEDULES.find((entry) => entry.name === 'payment-window-expiry')).toEqual({
            name: 'payment-window-expiry',
            displayName: 'Vencimiento de ventanas de cobro',
            category: 'billing',
            schedule: '20 * * * *',
            description:
                'Fail pending payments whose provider collection window closed without collection, re-read by id (HOS-1709, AC:B5:5).'
        });
    });
});
