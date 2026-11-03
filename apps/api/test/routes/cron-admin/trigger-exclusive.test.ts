import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runCronJob, registeredJob } = vi.hoisted(() => ({
    runCronJob: vi.fn(),
    registeredJob: {
        name: 'exclusive-demo',
        description: 'demo',
        schedule: '* * * * *',
        enabled: true,
        exclusive: true,
        handler: vi.fn()
    } as Record<string, unknown>
}));
vi.mock('../../../src/cron/run-cron-job', () => ({ runCronJob }));
vi.mock('../../../src/cron/registry', () => ({
    cronJobs: [],
    getCronJob: () => registeredJob
}));
vi.mock('../../../src/middlewares/authorization', () => {
    const allow = () => async (_ctx: unknown, next: () => Promise<void>) => next();
    return {
        adminAuthMiddleware: allow,
        publicAuthMiddleware: allow,
        protectedAuthMiddleware: allow
    };
});
vi.mock('../../../src/routes/cron-admin/runs', () => ({
    cronRunSummaryRoute: new Hono(),
    getCronRunByIdRoute: new Hono(),
    listCronRunsRoute: new Hono()
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    CronRunService: vi.fn()
}));

const { adminCronRoutes, triggerCronJobHandler } = await import(
    '../../../src/routes/cron-admin/index'
);

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

describe('exclusive manual cron trigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        registeredJob.exclusive = true;
    });

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

    it('answers the real admin route with 202 while the handler is pending', async () => {
        const completion = deferred<{
            readonly success: boolean;
            readonly message: string;
            readonly processed: number;
            readonly errors: number;
            readonly durationMs: number;
        }>();
        runCronJob.mockResolvedValue({
            started: true,
            runId: 'http-run',
            completion: completion.promise
        });
        const response = await adminCronRoutes.request('/exclusive-demo', { method: 'POST' });
        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: { runId: 'http-run', jobName: 'exclusive-demo' }
        });
        completion.resolve({
            success: true,
            message: 'done',
            processed: 0,
            errors: 0,
            durationMs: 1
        });
    });

    it('returns holder details in the real HTTP conflict response', async () => {
        runCronJob.mockResolvedValue({ started: false, holderRunId: 'run-holder' });
        const response = await adminCronRoutes.request('/exclusive-demo', { method: 'POST' });
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: { code: 'CONFLICT', details: { holderRunId: 'run-holder' } }
        });
    });

    it('returns 200 with the result for a non-exclusive job over HTTP', async () => {
        registeredJob.exclusive = false;
        runCronJob.mockResolvedValue({
            started: true,
            runId: 'regular-run',
            completion: Promise.resolve({
                success: true,
                message: 'done',
                processed: 1,
                errors: 0,
                durationMs: 1
            })
        });
        const response = await adminCronRoutes.request('/exclusive-demo', { method: 'POST' });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: { success: true, jobName: 'exclusive-demo' }
        });
    });
});
