import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    lock: vi.fn(),
    record: vi.fn(),
    ping: vi.fn(),
    capture: vi.fn()
}));
vi.mock('../../src/cron/cron-lock', () => ({ withCronLock: mocks.lock }));
vi.mock('../../src/cron/record-run', () => ({ recordCronRun: mocks.record }));
vi.mock('../../src/utils/healthchecks-ping', () => ({
    HEALTHCHECKS_MONITORED_JOBS: ['listing-coverage-reconciler'],
    pingHealthchecks: mocks.ping
}));
vi.mock('@sentry/node', () => ({ captureException: mocks.capture }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { runCronJob } from '../../src/cron/run-cron-job';
import type { CronJobDefinition } from '../../src/cron/types';

const job: CronJobDefinition = {
    name: 'listing-coverage-reconciler',
    description: 'test job',
    schedule: '* * * * *',
    enabled: true,
    exclusive: true,
    handler: vi.fn(async () => ({
        success: true,
        message: 'ok',
        processed: 0,
        errors: 0,
        durationMs: 0
    }))
};

describe('runCronJob lock failures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.record.mockResolvedValue(undefined);
        mocks.ping.mockResolvedValue(undefined);
    });

    it('records a pre-decision lock failure and captures scheduled failure once', async () => {
        const error = new Error('database unavailable');
        mocks.lock.mockRejectedValue(error);

        await expect(runCronJob({ job, executionMode: 'scheduled', dryRun: false })).rejects.toBe(
            error
        );

        expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ error }));
        expect(mocks.capture).toHaveBeenCalledOnce();
        expect(mocks.capture).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                tags: expect.objectContaining({ event_type: 'cron_failure' })
            })
        );
        expect(mocks.ping).toHaveBeenCalledWith({
            job: job.name,
            signal: 'fail'
        });
    });
});
