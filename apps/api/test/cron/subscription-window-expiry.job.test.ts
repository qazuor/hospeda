import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockCredited, mockExpire, mockSweep, mockClock, mockProvider, mockComplementPorts } =
    vi.hoisted(() => ({
        mockCredited: vi.fn(),
        mockExpire: vi.fn(),
        mockSweep: vi.fn(),
        mockClock: { now: vi.fn(() => new Date('2026-10-08T20:00:00.000Z')) },
        mockProvider: { readAuthorization: vi.fn() },
        mockComplementPorts: {
            addonPolicy: vi.fn(),
            listing: vi.fn(),
            liveAnchors: { hasLiveAnchor: vi.fn() }
        }
    }));
vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createPlanCatalogInverse: () => ({ changeDirection: vi.fn() })
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    planCatalogModel: {}
}));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    activateCreditedPendingAuthorizations: mockCredited,
    expireAuthorizationWindows: mockExpire,
    sweepInheritedTouristVips: mockSweep
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
vi.mock('../../src/utils/billing-complement-ports.js', () => ({
    buildComplementPolicyPorts: () => mockComplementPorts
}));

import { subscriptionWindowExpiryJob } from '../../src/cron/jobs/subscription-window-expiry.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../src/routes/billing-subscription/tourist-vip-inheritance';
import { getAnalyticsFactSink } from '../../src/utils/analytics/analytics-facts';
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
    mockCredited.mockResolvedValue({
        candidates: 0,
        activated: 1,
        notActive: 0,
        skipped: 0,
        failed: 0,
        touristVipCancelled: 0
    });
    mockExpire.mockResolvedValue({
        abandoned: 3,
        activated: 2,
        cancelCalls: 2,
        noticePending: 1,
        skipped: 0,
        touristVipCancelled: 0,
        retainedReevaluated: 1,
        failed: 0
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
        expect(mockCredited).toHaveBeenCalledWith(100, {
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices(),
            billingFacts: getAnalyticsFactSink(),
            changeDirection: expect.any(Function),
            complements: mockComplementPorts
        });
        expect(mockExpire).toHaveBeenCalledWith(100, {
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices(),
            billingFacts: getAnalyticsFactSink(),
            changeDirection: expect.any(Function),
            complements: mockComplementPorts
        });
        expect(mockSweep).toHaveBeenCalledWith(100, {
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            touristVipInheritance,
            coverageNotices: getCoverageNotices()
        });
        // HOS-1533: S2 and the VIP closure notify the ONE process-wide registry (identity, not shape).
        expect(mockCredited.mock.invocationCallOrder[0]).toBeLessThan(
            mockExpire.mock.invocationCallOrder[0]!
        );
        expect(mockExpire.mock.calls[0]?.[1].coverageNotices).toBe(getCoverageNotices());
        expect(mockExpire.mock.calls[0]?.[1].billingFacts).toBe(getAnalyticsFactSink());
        expect(mockSweep.mock.calls[0]?.[1].coverageNotices).toBe(getCoverageNotices());
        expect(result).toMatchObject({
            success: true,
            processed: 6,
            errors: 0,
            // HOS-1561 H9: branch 2's re-evaluation count reaches the run's details.
            details: { cancelled: 1, deferred: 2, retainedReevaluated: 1 }
        });
    });

    it('counts failed rows from credited recovery and continues other sweeps', async () => {
        mockCredited.mockResolvedValue({
            candidates: 2,
            activated: 0,
            notActive: 0,
            skipped: 0,
            failed: 2,
            touristVipCancelled: 0
        });
        const result = await subscriptionWindowExpiryJob.handler(context());
        expect(mockExpire).toHaveBeenCalled();
        expect(mockSweep).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            errors: 2,
            details: { creditedPending: { failed: 2 } }
        });
    });

    it('continues after credited recovery rejects', async () => {
        mockCredited.mockRejectedValue(new Error('recovery failed'));
        const result = await subscriptionWindowExpiryJob.handler(context());
        expect(mockExpire).toHaveBeenCalled();
        expect(mockSweep).toHaveBeenCalled();
        expect(result).toMatchObject({ success: false });
        expect(result.errors).toBeGreaterThanOrEqual(1);
    });

    it('does not call the service in dry run', async () => {
        const result = await subscriptionWindowExpiryJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(mockExpire).not.toHaveBeenCalled();
    });
});
