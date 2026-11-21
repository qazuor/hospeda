/**
 * venue-events-past-cleanup cron (HOS-2254): manifest registration, dry run,
 * the purge call with the run's reference instant, and failure reporting. The
 * selection rule is covered in `test/services/venue-events-past-cleanup.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockPurge } = vi.hoisted(() => ({ mockPurge: vi.fn() }));

vi.mock('../../src/services/venue-events-past-cleanup.js', () => ({
    purgePastVenueEvents: mockPurge
}));

import { venueEventsPastCleanupJob } from '../../src/cron/jobs/venue-events-past-cleanup.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

function makeContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-11-18T07:15:00.000Z'),
        runId: 'run-test',
        correlationId: '00000000-0000-4000-8000-00000000c0de',
        dryRun: false,
        ...overrides
    };
}

describe('venueEventsPastCleanupJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is in the manifest and in the registry with the same schedule', () => {
        const entry = CRON_SCHEDULES.find((job) => job.name === venueEventsPastCleanupJob.name);
        expect(entry?.schedule).toBe(venueEventsPastCleanupJob.schedule);
        expect(cronJobs).toContain(venueEventsPastCleanupJob);
        expect(venueEventsPastCleanupJob.enabled).toBe(true);
    });

    it('deletes nothing on a dry run', async () => {
        const result = await venueEventsPastCleanupJob.handler(makeContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(mockPurge).not.toHaveBeenCalled();
    });

    it('purges with the run instant and reports the count', async () => {
        const ctx = makeContext();
        mockPurge.mockResolvedValue({ deleted: 4, scanned: 6, maxDate: '2026-09-19' });

        const result = await venueEventsPastCleanupJob.handler(ctx);

        expect(mockPurge).toHaveBeenCalledWith({ now: ctx.startedAt });
        expect(result).toMatchObject({ success: true, processed: 4, errors: 0 });
        expect(ctx.logger.info).toHaveBeenCalledWith(
            'Past venue events cleanup completed',
            expect.objectContaining({ deleted: 4 })
        );
    });

    it('reports a failure instead of throwing', async () => {
        mockPurge.mockRejectedValue(new Error('db down'));

        const result = await venueEventsPastCleanupJob.handler(makeContext());

        expect(result).toMatchObject({ success: false, errors: 1 });
    });
});
