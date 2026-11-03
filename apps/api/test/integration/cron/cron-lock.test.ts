import { CronRunModel, cronRuns, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withCronLock } from '../../../src/cron/cron-lock';
import { runCronJob } from '../../../src/cron/run-cron-job';
import type { CronJobDefinition, CronJobResult } from '../../../src/cron/types';

function deferred<T>(): {
    readonly promise: Promise<T>;
    readonly resolve: (value: T) => void;
} {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

let pool: Pool;

beforeAll(() => {
    const connectionString = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!connectionString) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
    pool = new Pool({ connectionString });
    initializeDb(pool);
});

afterAll(async () => {
    resetDb();
    await pool.end();
});

describe('cron session advisory lock', () => {
    it('keeps the lock until the handler settles and exposes its run id to a contender', async () => {
        const handler = deferred<string>();
        const first = await withCronLock({
            name: 'cron-lock-integration',
            runId: 'holder-run-id',
            handler: () => handler.promise
        });
        expect(first.acquired).toBe(true);
        if (!first.acquired) throw new Error('expected to acquire the first lock');

        const race = await Promise.race([
            first.completion.then(() => 'handler'),
            new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 20))
        ]);
        expect(race).toBe('timeout');

        const second = await withCronLock({
            name: 'cron-lock-integration',
            runId: 'contender-run-id',
            handler: async () => 'should not run'
        });
        expect(second).toEqual({ acquired: false, holderRunId: 'holder-run-id' });

        handler.resolve('settled');
        await expect(first.completion).resolves.toBe('settled');
        const third = await withCronLock({
            name: 'cron-lock-integration',
            runId: 'next-run-id',
            handler: async () => 'ran'
        });
        expect(third.acquired).toBe(true);
        if (third.acquired) await expect(third.completion).resolves.toBe('ran');
    });

    it('records overlap and timeout while holding the lock until the handler settles', async () => {
        const jobName = `cron-lock-runner-${Date.now()}`;
        const handler = deferred<CronJobResult>();
        const job: CronJobDefinition = {
            name: jobName,
            description: 'integration lock lifecycle',
            schedule: '* * * * *',
            enabled: true,
            exclusive: true,
            timeoutMs: 100,
            budgetMs: 90,
            handler: () => handler.promise
        };
        const first = await runCronJob({ job, executionMode: 'scheduled', dryRun: false });
        if (!first.started) throw new Error('expected first execution to acquire the lock');

        const second = await runCronJob({ job, executionMode: 'scheduled', dryRun: false });
        expect(second).toMatchObject({ started: false, holderRunId: first.runId });
        await expect(first.completion).rejects.toThrow('execution timeout');

        const third = await runCronJob({ job, executionMode: 'scheduled', dryRun: false });
        expect(third).toMatchObject({ started: false, holderRunId: first.runId });

        handler.resolve({
            success: true,
            message: 'settled after timeout',
            processed: 0,
            errors: 0,
            durationMs: 120
        });
        let released = false;
        for (let attempt = 0; attempt < 20 && !released; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            const next = await runCronJob({ job, executionMode: 'scheduled', dryRun: false });
            if (next.started) {
                released = true;
                await expect(next.completion).resolves.toMatchObject({ success: true });
            }
        }
        expect(released).toBe(true);

        const rows = await new CronRunModel().listRuns({ jobName, page: 1, pageSize: 20 });
        const timedOut = rows.items.find((row) => row.details?.runId === first.runId);
        const overlap = rows.items.find(
            (row) => row.details?.skipped === 'overlap' && row.details?.holderRunId === first.runId
        );
        expect(timedOut?.status).toBe('timeout');
        expect(overlap?.status).toBe('success');
        expect(overlap?.details).toMatchObject({ skipped: 'overlap', holderRunId: first.runId });

        await getDb().delete(cronRuns).where(eq(cronRuns.jobName, jobName));
    });
});
