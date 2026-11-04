import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    route: undefined as { handler: (...args: unknown[]) => Promise<unknown> } | undefined,
    runCronJob: vi.fn()
}));
vi.mock('../../src/cron/run-cron-job', () => ({ runCronJob: mocks.runCronJob }));
vi.mock('../../src/cron/registry', () => ({
    cronJobs: [],
    getCronJob: () => ({
        name: 'regular-job',
        description: 'regular job',
        schedule: '* * * * *',
        enabled: true,
        handler: vi.fn()
    })
}));
vi.mock('../../src/routes/cron-admin/runs', () => ({
    cronRunSummaryRoute: new Hono(),
    getCronRunByIdRoute: new Hono(),
    listCronRunsRoute: new Hono()
}));
vi.mock('../../src/utils/route-factory', () => ({
    createAdminRoute: (config: { handler: (...args: unknown[]) => Promise<unknown> }) => {
        mocks.route = config;
        return new Hono();
    }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    CronRunService: vi.fn()
}));

describe('manual cron routing', () => {
    it('routes a non-exclusive trigger through runCronJob in manual mode', async () => {
        await import('../../src/routes/cron-admin/index');
        mocks.runCronJob.mockResolvedValue({
            started: true,
            runId: 'manual-run',
            completion: Promise.resolve({
                success: true,
                message: 'done',
                processed: 0,
                errors: 0,
                durationMs: 1
            })
        });

        const handler = mocks.route?.handler;
        if (!handler) throw new Error('expected manual cron route handler');
        await handler({} as never, { jobName: 'regular-job' }, {}, {});

        expect(mocks.runCronJob).toHaveBeenCalledWith(
            expect.objectContaining({ executionMode: 'manual', dryRun: false })
        );
    });
});
