import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockEnd, mockClock, mockProvider, mockPolicy, mockNotices } = vi.hoisted(() => ({
    mockEnd: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn() },
    mockPolicy: { addonPolicy: vi.fn(), listing: vi.fn() },
    mockNotices: { emitCoverageChanged: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    endDuePauses: mockEnd
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
vi.mock('../../src/utils/billing-complement-ports.js', () => ({
    buildComplementPolicyPorts: () => mockPolicy
}));
vi.mock('../../src/utils/listing-access/coverage-notices.js', () => ({
    getCoverageNotices: () => mockNotices
}));

import { subscriptionPauseEndJob } from '../../src/cron/jobs/subscription-pause-end.job';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-b8b-pause-end',
    correlationId: '00000000-0000-4000-8000-00000000b8b3',
    dryRun
});
beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue({
        resumed: 3,
        notApplied: 1,
        notApplicable: 2,
        lostRace: 1,
        failed: 1
    });
});

describe('TEST:B8b:3 subscription-pause-end job', () => {
    it('registers the expected name, schedule, enabled flag and timeout', () => {
        expect(subscriptionPauseEndJob).toMatchObject({
            name: 'subscription-pause-end',
            schedule: '47 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
    });
    it('skips the service during dry run', async () => {
        const result = await subscriptionPauseEndJob.handler(context(true));
        expect(mockEnd).toHaveBeenCalledTimes(0);
        expect(result).toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
    });
    it('passes production ports and maps all outcome counts', async () => {
        const result = await subscriptionPauseEndJob.handler(context());
        expect(mockEnd).toHaveBeenCalledTimes(1);
        expect(mockEnd).toHaveBeenCalledWith(
            { limit: 100 },
            {
                provider: mockProvider,
                clock: mockClock,
                complements: mockPolicy,
                coverageNotices: mockNotices
            }
        );
        expect(result).toMatchObject({
            success: true,
            processed: 8,
            errors: 1,
            details: { resumed: 3, notApplied: 1, notApplicable: 2, lostRace: 1, failed: 1 }
        });
    });
});
