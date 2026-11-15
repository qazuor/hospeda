import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockReevaluate, mockReissue, mockClock, mockProvider, mockNotices } = vi.hoisted(() => ({
    mockReevaluate: vi.fn(),
    mockReissue: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-11-13T12:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn() },
    mockNotices: { emitCoverageChanged: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    reevaluateSuccessionPredecessors: mockReevaluate,
    reissueDeferredCourtesy: mockReissue
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
vi.mock('../../src/utils/listing-access/coverage-notices.js', () => ({
    getCoverageNotices: () => mockNotices
}));

import { subscriptionSuccessionReevaluationJob } from '../../src/cron/jobs/subscription-succession-reevaluation.job';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-11-13T11:00:00.000Z'),
    runId: 'run-b8b-reevaluate',
    correlationId: '00000000-0000-4000-8000-000000000003',
    dryRun
});

describe('TEST:B8b:8 succession reevaluation job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReevaluate.mockResolvedValue({
            selected: 2,
            cancelled: 1,
            deferred: 1,
            notApplicable: 0,
            lostRace: 0
        });
        mockReissue.mockResolvedValue({ outcome: 'REISSUED' });
    });

    it('has its reserved schedule and skips dry runs', async () => {
        expect(subscriptionSuccessionReevaluationJob).toMatchObject({
            name: 'subscription-succession-reevaluation',
            schedule: '33 * * * *',
            enabled: true
        });
        expect(await subscriptionSuccessionReevaluationJob.handler(context(true))).toMatchObject({
            success: true,
            processed: 0,
            errors: 0
        });
        expect(mockReevaluate).toHaveBeenCalledTimes(0);
    });

    it('passes the S9 callback and reports selected candidates', async () => {
        const result = await subscriptionSuccessionReevaluationJob.handler(context());
        const [input, ports] = mockReevaluate.mock.calls[0] as [
            unknown,
            { afterCancelled: (value: { successorSubscriptionId: string }) => Promise<void> }
        ];
        expect(input).toEqual({ limit: 100 });
        await ports.afterCancelled({
            successorSubscriptionId: '00000000-0000-4000-8000-000000000001'
        });
        expect(mockReissue).toHaveBeenCalledWith(
            { successorSubscriptionId: '00000000-0000-4000-8000-000000000001' },
            expect.objectContaining({
                provider: mockProvider,
                clock: mockClock,
                coverageNotices: mockNotices
            })
        );
        expect(result).toMatchObject({
            success: true,
            processed: 2,
            errors: 0,
            details: { cancelled: 1 }
        });
    });

    it('reports a whole-run exception', async () => {
        mockReevaluate.mockRejectedValueOnce(new Error('db unavailable'));
        expect(await subscriptionSuccessionReevaluationJob.handler(context())).toMatchObject({
            success: false,
            errors: 1
        });
    });
});
