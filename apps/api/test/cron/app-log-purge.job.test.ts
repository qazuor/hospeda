import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockPurgeOld } = vi.hoisted(() => ({ mockPurgeOld: vi.fn() }));

vi.mock('@repo/service-core', () => ({
    AppLogEntryService: vi.fn(() => ({ purgeOld: mockPurgeOld }))
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { appLogPurgeJob } from '../../src/cron/jobs/app-log-purge.job';

function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        dryRun: false,
        ...overrides
    };
}

describe('appLogPurgeJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is registered with the expected name and 5 AM schedule', () => {
        expect(appLogPurgeJob.name).toBe('app-log-purge');
        expect(appLogPurgeJob.schedule).toBe('0 5 * * *');
        expect(appLogPurgeJob.enabled).toBe(true);
    });

    it('skips the purge in dry-run mode', async () => {
        const result = await appLogPurgeJob.handler(makeCronContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockPurgeOld).not.toHaveBeenCalled();
    });

    it('purges with 30-day retention and reports the deleted count', async () => {
        mockPurgeOld.mockResolvedValue(13);

        const result = await appLogPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(13);
        expect(mockPurgeOld).toHaveBeenCalledWith({ retentionDays: 30 });
    });

    it('returns a failed result (not throw) when the purge errors', async () => {
        mockPurgeOld.mockRejectedValue(new Error('db down'));

        const result = await appLogPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.message).toContain('db down');
    });
});
