/**
 * HOS-1512: the watch battery's run history. The latest COMPLETED run of an account is the
 * shape baseline of the next run; a failed, aborted or refused run never is.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { providerWatchRunModel as model } from '../../src/models/provider-watch-run/provider-watch-run.model.ts';
import type { InsertProviderWatchRun } from '../../src/schemas/vertical/provider-watch-run.dbschema.ts';
import { closeTestPool, getTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

function run(overrides: Partial<InsertProviderWatchRun> = {}): InsertProviderWatchRun {
    return {
        account: 'sandbox',
        startedAt: new Date('2026-11-17T10:00:00.000Z'),
        finishedAt: new Date('2026-11-17T10:05:00.000Z'),
        outcome: 'completed',
        measurements: { M1: { outcome: 'matched', shapes: { create: { $: 'object' } } } },
        alerts: [],
        ...overrides
    };
}

describe('provider_watch_run', () => {
    it('stores a run with its measurements and alerts', async () => {
        await withTestTransaction(async (tx) => {
            const alerts = [{ measurementId: 'M1', kind: 'value_changed', channel: 'email' }];
            const row = await model.insert({ run: run({ alerts }), tx });
            expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(row.alerts).toEqual(alerts);
            expect(row.measurements).toEqual({
                M1: { outcome: 'matched', shapes: { create: { $: 'object' } } }
            });
        });
    });

    it('answers null for an account with no completed run', async () => {
        await withTestTransaction(async (tx) => {
            await model.insert({ run: run({ outcome: 'failed', reason: 'empty' }), tx });
            expect(await model.findLatestCompleted({ account: 'sandbox', tx })).toBeNull();
        });
    });

    it('answers the latest completed run of the asked account only', async () => {
        await withTestTransaction(async (tx) => {
            const older = await model.insert({
                run: run({
                    finishedAt: new Date('2026-11-10T10:05:00.000Z'),
                    startedAt: new Date('2026-11-10T10:00:00.000Z')
                }),
                tx
            });
            const latest = await model.insert({ run: run(), tx });
            await model.insert({
                run: run({
                    outcome: 'aborted',
                    startedAt: new Date('2026-11-18T10:00:00.000Z'),
                    finishedAt: new Date('2026-11-18T10:01:00.000Z')
                }),
                tx
            });
            await model.insert({ run: run({ account: 'production' }), tx });
            const found = await model.findLatestCompleted({ account: 'sandbox', tx });
            expect(found?.id).toBe(latest.id);
            expect(found?.id).not.toBe(older.id);
        });
    });

    it('refuses an unknown account, an unknown outcome and a run that ends before it starts', async () => {
        const pool = getTestPool();
        const insert = (account: string, outcome: string, finishedAt: string) =>
            pool.query(
                `INSERT INTO provider_watch_run (account, started_at, finished_at, outcome)
                 VALUES ($1, '2026-11-17T10:00:00Z', $2, $3)`,
                [account, finishedAt, outcome]
            );
        await expect(insert('staging', 'completed', '2026-11-17T10:05:00Z')).rejects.toThrow(
            /ck_provider_watch_run_account/
        );
        await expect(insert('sandbox', 'green', '2026-11-17T10:05:00Z')).rejects.toThrow(
            /ck_provider_watch_run_outcome/
        );
        await expect(insert('sandbox', 'completed', '2026-11-17T09:00:00Z')).rejects.toThrow(
            /ck_provider_watch_run_span/
        );
    });
});
