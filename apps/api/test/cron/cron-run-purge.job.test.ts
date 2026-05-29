import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockPurgeOld } = vi.hoisted(() => ({ mockPurgeOld: vi.fn() }));

vi.mock('@repo/service-core', () => ({
    CronRunService: vi.fn(() => ({ purgeOld: mockPurgeOld }))
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { cronRunPurgeJob } from '../../src/cron/jobs/cron-run-purge.job';

function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        dryRun: false,
        ...overrides
    };
}

describe('cronRunPurgeJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is registered with the expected name and 4 AM schedule', () => {
        expect(cronRunPurgeJob.name).toBe('cron-run-purge');
        expect(cronRunPurgeJob.schedule).toBe('0 4 * * *');
        expect(cronRunPurgeJob.enabled).toBe(true);
    });

    it('skips the purge in dry-run mode', async () => {
        const result = await cronRunPurgeJob.handler(makeCronContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockPurgeOld).not.toHaveBeenCalled();
    });

    it('purges with 60/180 day retention and reports the deleted count', async () => {
        mockPurgeOld.mockResolvedValue(42);

        const result = await cronRunPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(42);
        expect(mockPurgeOld).toHaveBeenCalledWith({
            successRetentionDays: 60,
            failedRetentionDays: 180
        });
    });

    it('returns a failed result (not throw) when the purge errors', async () => {
        mockPurgeOld.mockRejectedValue(new Error('db down'));

        const result = await cronRunPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.message).toContain('db down');
    });
});
