import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('runCronJob lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.record.mockResolvedValue(undefined);
        mocks.ping.mockResolvedValue(undefined);
        mocks.lock.mockImplementation(async ({ handler }: { handler: () => Promise<unknown> }) => ({
            acquired: true,
            completion: handler()
        }));
    });

    afterEach(() => vi.useRealTimers());

    it('records an overlap as success with the holder run ID and does not ping', async () => {
        mocks.lock.mockResolvedValue({ acquired: false, holderRunId: 'holder-1' });
        const decision = await runCronJob({ job, executionMode: 'scheduled', dryRun: false });

        expect(decision).toEqual({ started: false, holderRunId: 'holder-1' });
        expect(job.handler).not.toHaveBeenCalled();
        expect(mocks.record).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    success: true,
                    details: expect.objectContaining({
                        skipped: 'overlap',
                        holderRunId: 'holder-1'
                    })
                })
            })
        );
        expect(mocks.ping).not.toHaveBeenCalled();
    });

    it('sends the monitored start ping only after the lock decision is acquired', async () => {
        let grantLock!: () => void;
        let runHandler!: () => Promise<unknown>;
        mocks.lock.mockImplementation(
            ({ handler }: { handler: () => Promise<unknown> }) =>
                new Promise((resolve) => {
                    runHandler = handler;
                    grantLock = () => resolve({ acquired: true, completion: runHandler() });
                })
        );

        const pending = runCronJob({ job, executionMode: 'scheduled', dryRun: false });
        await Promise.resolve();
        expect(mocks.ping).not.toHaveBeenCalled();
        grantLock();

        const decision = await pending;
        expect(mocks.ping).toHaveBeenCalledWith({ job: job.name, signal: 'start' });
        if (decision.started)
            await expect(decision.completion).resolves.toMatchObject({ success: true });
    });

    it('does not lock non-exclusive jobs', async () => {
        const regularJob = { ...job, exclusive: false };
        const decision = await runCronJob({
            job: regularJob,
            executionMode: 'manual',
            dryRun: false
        });

        expect(mocks.lock).not.toHaveBeenCalled();
        expect(decision.started).toBe(true);
        if (decision.started)
            await expect(decision.completion).resolves.toMatchObject({ success: true });
    });

    it('uses the 90 percent exclusive budget and persists the returned run ID', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));
        let observed: { readonly startedAt: Date; readonly deadlineAt: Date } | undefined;
        const budgetJob: CronJobDefinition = {
            ...job,
            timeoutMs: 100,
            budgetMs: undefined,
            handler: async (ctx) => {
                observed = { startedAt: ctx.startedAt, deadlineAt: ctx.deadlineAt };
                return {
                    success: true,
                    message: 'ok',
                    processed: 0,
                    errors: 0,
                    durationMs: 1
                };
            }
        };
        const decision = await runCronJob({
            job: budgetJob,
            executionMode: 'scheduled',
            dryRun: false
        });
        if (!decision.started) throw new Error('expected an acquired lock');
        const result = await decision.completion;
        if (!observed) throw new Error('expected the handler to receive a run context');
        expect(observed.deadlineAt.getTime() - observed.startedAt.getTime()).toBe(90);
        expect(result.details?.runId).toBe(decision.runId);
        expect(mocks.record).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    details: expect.objectContaining({ runId: decision.runId })
                })
            })
        );
    });

    it('keeps manual soft failures out of Healthchecks and Sentry', async () => {
        const manualJob: CronJobDefinition = {
            ...job,
            exclusive: false,
            handler: vi.fn(async () => ({
                success: false,
                message: 'soft failure',
                processed: 0,
                errors: 1,
                durationMs: 1
            }))
        };
        const decision = await runCronJob({
            job: manualJob,
            executionMode: 'manual',
            dryRun: false
        });
        if (!decision.started) throw new Error('expected a manual execution');
        await expect(decision.completion).resolves.toMatchObject({ success: false });
        expect(mocks.ping).not.toHaveBeenCalled();
        expect(mocks.capture).not.toHaveBeenCalled();
    });

    it('aborts at the cooperative budget and records the safety timeout without settling the lock', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-03T12:00:00.000Z'));
        let contextSignal: AbortSignal | undefined;
        let contextDeadline: Date | undefined;
        const handler = new Promise<never>(() => undefined);
        const budgetJob: CronJobDefinition = {
            ...job,
            timeoutMs: 100,
            budgetMs: 40,
            handler: async (ctx) => {
                contextSignal = ctx.signal;
                contextDeadline = ctx.deadlineAt;
                return handler;
            }
        };
        let lockSettled = false;
        mocks.lock.mockImplementation(
            async ({ handler: run }: { handler: () => Promise<unknown> }) => {
                const completion = run();
                void completion.then(
                    () => {
                        lockSettled = true;
                    },
                    () => {
                        lockSettled = true;
                    }
                );
                return { acquired: true, completion };
            }
        );

        const decision = await runCronJob({
            job: budgetJob,
            executionMode: 'scheduled',
            dryRun: false
        });
        if (!decision.started) throw new Error('expected an acquired lock');
        const completionAssertion = expect(decision.completion).rejects.toThrow(
            'execution timeout'
        );
        expect(contextSignal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(40);
        expect(contextSignal?.aborted).toBe(true);
        await vi.advanceTimersByTimeAsync(60);
        await completionAssertion;
        expect(mocks.record).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ message: expect.stringContaining('timeout') })
            })
        );
        expect(mocks.capture).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: expect.objectContaining({ event_type: 'cron_failure' })
            })
        );
        expect(lockSettled).toBe(false);
        expect(contextDeadline?.toISOString()).toBe('2026-11-03T12:00:00.040Z');
    });
});
