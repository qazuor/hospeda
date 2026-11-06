import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    schedule: vi.fn(),
    runCronJob: vi.fn(),
    handler: vi.fn(),
    jobs: [] as unknown[]
}));
vi.mock('../../src/cron/run-cron-job', () => ({ runCronJob: mocks.runCronJob }));
vi.mock('../../src/cron/registry', () => ({ getEnabledCronJobs: () => mocks.jobs }));
vi.mock('../../src/utils/env', () => ({ env: { HOSPEDA_CRON_ADAPTER: 'node-cron' } }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('node-cron', () => ({
    default: { schedule: mocks.schedule },
    schedule: mocks.schedule
}));

describe('cron bootstrap routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.jobs = [
            {
                name: 'registered-job',
                description: 'registered job',
                schedule: '* * * * *',
                enabled: true,
                handler: mocks.handler
            }
        ];
        mocks.runCronJob.mockResolvedValue({ started: false, holderRunId: null });
    });

    it('routes a scheduled tick through runCronJob without calling the handler directly', async () => {
        const { startCronScheduler } = await import('../../src/cron/bootstrap');
        await startCronScheduler();
        const callback = mocks.schedule.mock.calls[0]?.[1] as (() => Promise<void>) | undefined;
        if (!callback) throw new Error('expected node-cron callback registration');

        await callback();

        expect(mocks.runCronJob).toHaveBeenCalledWith({
            job: mocks.jobs[0],
            executionMode: 'scheduled',
            dryRun: false,
            scheduleExpression: '* * * * *'
        });
        expect(mocks.handler).not.toHaveBeenCalled();
    });
});
