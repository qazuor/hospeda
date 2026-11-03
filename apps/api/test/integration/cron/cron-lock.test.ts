import { initializeDb, resetDb } from '@repo/db';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withCronLock } from '../../../src/cron/cron-lock';

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
});
