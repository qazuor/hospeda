import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockApply, mockClock, mockNotices } = vi.hoisted(() => ({
    mockApply: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockNotices: { emitCoverageChanged: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    applyDueScheduledChanges: mockApply
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/listing-access/coverage-notices.js', () => ({
    getCoverageNotices: () => mockNotices
}));

import { subscriptionScheduledChangeJob } from '../../src/cron/jobs/subscription-scheduled-change.job';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-b8b-scheduled-change',
    correlationId: '00000000-0000-4000-8000-00000000b8b3',
    dryRun
});

describe('TEST:B8b:15 subscription-scheduled-change job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApply.mockResolvedValue({
            applied: 2,
            waiting: 1,
            notApplicable: 3,
            failed: 0,
            warnings: []
        });
    });

    it('registers the expected schedule and settings', () => {
        expect(subscriptionScheduledChangeJob).toMatchObject({
            name: 'subscription-scheduled-change',
            schedule: '53 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
    });

    it('skips the service during dry run', async () => {
        const result = await subscriptionScheduledChangeJob.handler(context(true));
        expect(mockApply).not.toHaveBeenCalled();
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
    });

    it('passes the bounded batch and reports the summary', async () => {
        const result = await subscriptionScheduledChangeJob.handler(context());
        expect(mockApply).toHaveBeenCalledWith(
            { limit: 100 },
            { clock: mockClock, coverageNotices: mockNotices }
        );
        expect(result).toMatchObject({
            success: true,
            processed: 6,
            errors: 0,
            details: { applied: 2, waiting: 1, notApplicable: 3, failed: 0 }
        });
    });

    it('reports a whole-run exception as failure', async () => {
        mockApply.mockRejectedValueOnce(new Error('batch unavailable'));
        const result = await subscriptionScheduledChangeJob.handler(context());
        expect(result).toMatchObject({
            success: false,
            errors: 1,
            details: { error: 'batch unavailable' }
        });
    });
});
