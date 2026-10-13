import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockExpire, mockSweep, mockClock, mockProvider } = vi.hoisted(() => ({
    mockExpire: vi.fn(),
    mockSweep: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-08T20:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    expireAuthorizationWindows: mockExpire,
    sweepInheritedTouristVips: mockSweep
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));

import { subscriptionWindowExpiryJob } from '../../src/cron/jobs/subscription-window-expiry.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../src/routes/billing-subscription/tourist-vip-inheritance';
import { getCoverageNotices } from '../../src/utils/listing-access/coverage-notices';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-08T19:00:00.000Z'),
    runId: 'run-b3-window',
    correlationId: '00000000-0000-4000-8000-00000000c0de',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockExpire.mockResolvedValue({
        abandoned: 3,
        activated: 2,
        cancelCalls: 2,
        noticePending: 1,
        skipped: 0
    });
    mockSweep.mockResolvedValue({ cancelled: 1, deferred: 2, skipped: 0 });
});

describe('subscription-window-expiry cron', () => {
    it('registers the expected cadence and ports, and counts terminal transitions', async () => {
        expect(subscriptionWindowExpiryJob).toMatchObject({
            name: 'subscription-window-expiry',
            schedule: '*/15 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
        const result = await subscriptionWindowExpiryJob.handler(context());
        expect(mockExpire).toHaveBeenCalledWith(100, {
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices()
        });
        expect(mockSweep).toHaveBeenCalledWith(100, {
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices()
        });
        // HOS-1533: S2 and the VIP closure notify the ONE process-wide registry (identity, not shape).
        expect(mockExpire.mock.calls[0]?.[1].coverageNotices).toBe(getCoverageNotices());
        expect(mockSweep.mock.calls[0]?.[1].coverageNotices).toBe(getCoverageNotices());
        expect(result).toMatchObject({
            success: true,
            processed: 5,
            errors: 0,
            details: { cancelled: 1, deferred: 2 }
        });
    });

    it('does not call the service in dry run', async () => {
        const result = await subscriptionWindowExpiryJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(mockExpire).not.toHaveBeenCalled();
    });
});
