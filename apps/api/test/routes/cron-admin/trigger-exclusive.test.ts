import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runCronJob } = vi.hoisted(() => ({ runCronJob: vi.fn() }));
vi.mock('../../../src/cron/run-cron-job', () => ({ runCronJob }));
vi.mock('../../../src/cron/registry', () => ({
    cronJobs: [],
    getCronJob: () => ({
        name: 'exclusive-demo',
        description: 'demo',
        schedule: '* * * * *',
        enabled: true,
        exclusive: true,
        handler: vi.fn()
    })
}));
vi.mock('../../../src/routes/cron-admin/runs', () => ({
    cronRunSummaryRoute: new Hono(),
    getCronRunByIdRoute: new Hono(),
    listCronRunsRoute: new Hono()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    CronRunService: vi.fn()
}));

const { triggerCronJobHandler } = await import('../../../src/routes/cron-admin/index');

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

describe('exclusive manual cron trigger', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 202 data after lock acquisition without waiting for completion', async () => {
        const completion = deferred<{
            readonly success: boolean;
            readonly message: string;
            readonly processed: number;
            readonly errors: number;
            readonly durationMs: number;
        }>();
        runCronJob.mockResolvedValue({
            started: true,
            runId: 'run-202',
            completion: completion.promise
        });
        const response = await triggerCronJobHandler(
            {} as never,
            { jobName: 'exclusive-demo' },
            {},
            { dryRun: true }
        );
        expect(response).toMatchObject({
            accepted: true,
            runId: 'run-202',
            jobName: 'exclusive-demo',
            dryRun: true
        });
        expect(runCronJob).toHaveBeenCalledWith(
            expect.objectContaining({ executionMode: 'manual', dryRun: true })
        );
        completion.resolve({
            success: true,
            message: 'done',
            processed: 0,
            errors: 0,
            durationMs: 1
        });
    });

    it('returns a conflict carrying the holder run ID when the lock is busy', async () => {
        runCronJob.mockResolvedValue({ started: false, holderRunId: 'run-holder' });
        await expect(
            triggerCronJobHandler({} as never, { jobName: 'exclusive-demo' }, {}, {})
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'CONFLICT',
            details: { holderRunId: 'run-holder' }
        });
    });
});
