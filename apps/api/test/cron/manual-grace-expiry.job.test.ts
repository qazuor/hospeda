import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockExpire, mockClock, mockBeforeCancel, mockCoverage } = vi.hoisted(() => ({
    mockExpire: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
    mockBeforeCancel: vi.fn(),
    mockCoverage: { emitCoverageChanged: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    expireManualGraces: mockExpire
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/routes/billing-subscription/before-cancel-notice.js', () => ({
    beforeCancelNotice: { beforeCancel: mockBeforeCancel }
}));
vi.mock('../../src/utils/listing-access/coverage-notices.js', () => ({
    getCoverageNotices: () => mockCoverage
}));

import { manualGraceExpiryJob } from '../../src/cron/jobs/manual-grace-expiry.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-hos-1541-manual-grace-expiry',
    correlationId: '00000000-0000-4000-8000-000000001541',
    dryRun
});

const summary = { scanned: 6, suspended: 4, skipped: 1, errors: 1 };
beforeEach(() => {
    vi.clearAllMocks();
    mockExpire.mockResolvedValue(summary);
});

describe('HOS-1542 manual grace expiry clock (AC:B5:17)', () => {
    it('registers the job and its manifest entry at minute 43', () => {
        expect(manualGraceExpiryJob).toMatchObject({
            name: 'manual-grace-expiry',
            schedule: '43 * * * *',
            enabled: true,
            timeoutMs: 300_000
        });
        expect(cronJobs.filter((job) => job.name === manualGraceExpiryJob.name)).toHaveLength(1);
        expect(CRON_SCHEDULES.find((entry) => entry.name === manualGraceExpiryJob.name)).toEqual({
            name: 'manual-grace-expiry',
            displayName: 'Vencimiento del grace manual',
            category: 'billing',
            schedule: '43 * * * *',
            description: 'Suspend expired unpaid manual graces (HOS-1542, AC:B5:17, MP3).'
        });
    });

    it('calls MP3 with the clock, notice and coverage ports', async () => {
        await manualGraceExpiryJob.handler(context());
        expect(mockExpire).toHaveBeenCalledTimes(1);
        const [input, ports] = mockExpire.mock.calls[0] ?? [];
        expect(input).toStrictEqual({ pageSize: 100 });
        expect(ports.clock).toBe(mockClock);
        expect(ports.beforeCancelNotice.beforeCancel).toBe(mockBeforeCancel);
        expect(ports.coverageNotices).toBe(mockCoverage);
        expect(Object.keys(ports).sort()).toEqual([
            'beforeCancelNotice',
            'clock',
            'coverageNotices'
        ]);
    });

    it('returns the exact service summary', async () => {
        const result = await manualGraceExpiryJob.handler(context());
        expect(result).toMatchObject({
            success: true,
            message: 'Suspended 4 manual graces',
            processed: 4,
            errors: 1,
            details: summary
        });
    });

    it('skips the service in dry run', async () => {
        const result = await manualGraceExpiryJob.handler(context(true));
        expect(mockExpire).toHaveBeenCalledTimes(0);
        expect(result).toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
    });

    it('reports an error as a failed run', async () => {
        mockExpire.mockRejectedValueOnce(new Error('database unavailable'));
        const result = await manualGraceExpiryJob.handler(context());
        expect(result).toMatchObject({
            success: false,
            message: 'Manual grace expiry failed: database unavailable',
            processed: 0,
            errors: 1,
            details: { error: 'database unavailable' }
        });
    });
});
