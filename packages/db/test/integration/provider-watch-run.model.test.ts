/**
 * HOS-1512: the watch battery's run lifecycle, the one-shot authorization and the accepted
 * baseline, against a real database.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { platformSettingsModel } from '../../src/models/platform/platform-settings.model.ts';
import { providerWatchRunModel as model } from '../../src/models/provider-watch-run/provider-watch-run.model.ts';
import { users } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import {
    closeTestPool,
    getTestDb,
    getTestPool,
    testData,
    withCleanSlate,
    withTestTransaction
} from './helpers.ts';

afterAll(closeTestPool);

const START = new Date('2026-11-17T10:00:00.000Z');
const END = new Date('2026-11-17T10:05:00.000Z');
const AUTHORIZATION = { month: '2026-11', maxChargeMinor: 150000, accountId: '100000001' };

async function seedAuthorization(tx: DrizzleClient, value: unknown = AUTHORIZATION) {
    const user = testData.user();
    await tx.insert(users).values(user);
    await platformSettingsModel.upsertByKey(
        'billing.providerWatchAuthorization',
        value,
        user.id,
        tx
    );
    return user;
}

async function authorizationRow(tx: DrizzleClient) {
    return platformSettingsModel.findByKey('billing.providerWatchAuthorization', tx);
}

const close = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    finishedAt: END,
    outcome: 'completed' as const,
    reason: null,
    measurements: { M1: { outcome: 'matched', shapes: { create: { $: 'object' } } } },
    ledger: { charged: 0, refunded: 0 },
    alerts: [] as unknown[],
    ...overrides
});

describe('run lifecycle', () => {
    it('opens a run as running with no end and closes it with its record', async () => {
        await withTestTransaction(async (tx) => {
            const { runId, authorizationConsumed } = await model.open({
                account: 'sandbox',
                startedAt: START,
                tx
            });
            expect(authorizationConsumed).toBe(false);
            const open = await model.findById({ id: runId, tx });
            expect(open).toMatchObject({ outcome: 'running', finishedAt: null });

            const alerts = [{ measurementId: 'M1', kind: 'value_changed', channel: 'email' }];
            const closed = await model.close({ ...close(runId), alerts, tx });
            expect(closed).toMatchObject({ outcome: 'completed', alerts });
            expect(closed.finishedAt?.toISOString()).toBe(END.toISOString());
        });
    });

    it('refuses to close a run twice', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(runId), tx });
            await expect(model.close({ ...close(runId), tx })).rejects.toThrow('not an open run');
        });
    });

    it('answers the latest completed run of the asked account only', async () => {
        await withTestTransaction(async (tx) => {
            const older = await model.open({
                account: 'sandbox',
                startedAt: new Date('2026-11-10T10:00:00.000Z'),
                tx
            });
            await model.close({
                ...close(older.runId),
                finishedAt: new Date('2026-11-10T10:05:00.000Z'),
                tx
            });
            const latest = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(latest.runId), tx });
            const failed = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({
                ...close(failed.runId),
                outcome: 'failed',
                reason: 'x',
                finishedAt: new Date('2026-11-18T10:00:00.000Z'),
                tx
            });
            const other = await model.open({ account: 'production', startedAt: START, tx });
            await model.close({ ...close(other.runId), tx });
            const found = await model.findLatestCompleted({ account: 'sandbox', tx });
            expect(found?.id).toBe(latest.runId);
        });
    });

    it('answers null for an account with no completed run', async () => {
        await withTestTransaction(async (tx) => {
            expect(await model.findLatestCompleted({ account: 'sandbox', tx })).toBeNull();
        });
    });

    it('refuses an unknown account, an unknown outcome and a run that ends before it starts', async () => {
        const pool = getTestPool();
        const insert = (account: string, outcome: string, finishedAt: string | null) =>
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

describe('provider ids are persisted as the writes answer, apart from the closing of the run', () => {
    it('accumulates ids per measurement on a running run and keeps the rest of the record', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.appendProgress({ runId, measurementId: 'M1', providerIds: ['a'], tx });
            await model.appendProgress({ runId, measurementId: 'M1', providerIds: ['b'], tx });
            await model.appendProgress({ runId, measurementId: 'RP2', providerIds: ['c'], tx });
            const row = await model.findById({ id: runId, tx });
            expect(row?.measurements).toEqual({
                M1: { providerIds: ['a', 'b'] },
                RP2: { providerIds: ['c'] }
            });
            expect(row?.outcome).toBe('running');
        });
    });

    it('records write keys apart from provider ids, and both survive in the row', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.appendProgress({ runId, measurementId: 'M1', writeKeys: ['hw-k1'], tx });
            await model.appendProgress({
                runId,
                measurementId: 'M1',
                providerIds: ['pre-1'],
                writeKeys: ['hw-k2'],
                tx
            });
            const row = await model.findById({ id: runId, tx });
            expect(row?.measurements).toEqual({
                M1: { writeKeys: ['hw-k1', 'hw-k2'], providerIds: ['pre-1'] }
            });
        });
    });

    it('stores the ledger of the run when it closes, charges and refunds apart', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            expect((await model.findById({ id: runId, tx }))?.ledger).toEqual({
                charged: 0,
                refunded: 0
            });
            const closed = await model.close({
                ...close(runId),
                ledger: { charged: 150000, refunded: 50000 },
                tx
            });
            expect(closed.ledger).toEqual({ charged: 150000, refunded: 50000 });
        });
    });

    it('refuses to append to a run that is not running', async () => {
        await withTestTransaction(async (tx) => {
            const { runId } = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(runId), tx });
            await expect(
                model.appendProgress({ runId, measurementId: 'M1', providerIds: ['a'], tx })
            ).rejects.toThrow('not a running run');
        });
    });

    it('survives the rollback of the transaction that was closing the run', async () => {
        await withCleanSlate(async (db) => {
            const { runId } = await model.open({
                account: 'sandbox',
                startedAt: START,
                tx: db
            });
            await model.appendProgress({
                runId,
                measurementId: 'M1',
                providerIds: ['pre-9'],
                tx: db
            });
            await expect(
                db.transaction(async (closing) => {
                    await model.close({ ...close(runId), tx: closing as unknown as DrizzleClient });
                    throw new Error('closing failed');
                })
            ).rejects.toThrow('closing failed');
            const row = await model.findById({ id: runId, tx: db });
            expect(row).toMatchObject({
                outcome: 'running',
                measurements: { M1: { providerIds: ['pre-9'] } }
            });
        });
    });
});

describe('a run that opens abandons the stale running rows of its account', () => {
    const at = (iso: string) => new Date(iso);

    it('closes them as failed with reason abandoned, in that transaction, keeping their provider ids', async () => {
        await withTestTransaction(async (tx) => {
            const stale = await model.open({
                account: 'sandbox',
                startedAt: at('2026-11-17T08:00:00.000Z'),
                tx
            });
            await model.appendProgress({
                runId: stale.runId,
                measurementId: 'M1',
                providerIds: ['pre-123'],
                tx
            });
            const fresh = await model.open({
                account: 'sandbox',
                startedAt: START,
                abandonRunsStartedBefore: at('2026-11-17T09:50:00.000Z'),
                tx
            });
            const abandoned = await model.findById({ id: stale.runId, tx });
            expect(abandoned).toMatchObject({
                outcome: 'failed',
                reason: 'abandoned',
                measurements: { M1: { providerIds: ['pre-123'] } }
            });
            expect(abandoned?.finishedAt?.toISOString()).toBe(START.toISOString());
            expect((await model.findById({ id: fresh.runId, tx }))?.outcome).toBe('running');
        });
    });

    it('leaves a running row that is still within its deadline, another account and a closed run alone', async () => {
        await withTestTransaction(async (tx) => {
            const recent = await model.open({
                account: 'sandbox',
                startedAt: at('2026-11-17T09:55:00.000Z'),
                tx
            });
            const other = await model.open({
                account: 'production',
                startedAt: at('2026-11-17T08:00:00.000Z'),
                tx
            });
            const done = await model.open({
                account: 'sandbox',
                startedAt: at('2026-11-17T08:00:00.000Z'),
                tx
            });
            await model.close({ ...close(done.runId), tx });
            await model.open({
                account: 'sandbox',
                startedAt: START,
                abandonRunsStartedBefore: at('2026-11-17T09:50:00.000Z'),
                tx
            });
            expect((await model.findById({ id: recent.runId, tx }))?.outcome).toBe('running');
            expect((await model.findById({ id: other.runId, tx }))?.outcome).toBe('running');
            expect((await model.findById({ id: done.runId, tx }))?.outcome).toBe('completed');
        });
    });

    it('abandons nothing when no cut-off is given', async () => {
        await withTestTransaction(async (tx) => {
            const old = await model.open({
                account: 'sandbox',
                startedAt: at('2026-01-01T00:00:00.000Z'),
                tx
            });
            await model.open({ account: 'sandbox', startedAt: START, tx });
            expect((await model.findById({ id: old.runId, tx }))?.outcome).toBe('running');
        });
    });
});

describe('the authorization is consumed by the run that starts, once', () => {
    it('consumes it in the transaction that creates the run and records which run did', async () => {
        await withTestTransaction(async (tx) => {
            await seedAuthorization(tx);
            const { runId, authorizationConsumed } = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            expect(authorizationConsumed).toBe(true);
            const row = await authorizationRow(tx);
            expect(row?.value).toMatchObject({
                ...AUTHORIZATION,
                consumedByRunId: runId,
                consumedAt: START.toISOString()
            });
        });
    });

    it('does not consume it twice: the second run is refused and the first stays recorded', async () => {
        await withTestTransaction(async (tx) => {
            await seedAuthorization(tx);
            const first = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            const second = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            expect(second.authorizationConsumed).toBe(false);
            expect((await authorizationRow(tx))?.value).toMatchObject({
                consumedByRunId: first.runId
            });
        });
    });

    it('does not consume the authorization of another month', async () => {
        await withTestTransaction(async (tx) => {
            await seedAuthorization(tx);
            const result = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: { ...AUTHORIZATION, month: '2026-10' },
                tx
            });
            expect(result.authorizationConsumed).toBe(false);
            expect((await authorizationRow(tx))?.value).not.toHaveProperty('consumedByRunId');
        });
    });

    it.each([
        ['a different maximum charge', { maxChargeMinor: 999999 }],
        ['a different account id', { accountId: '999999999' }]
    ])('does not consume an authorization the owner rewrote with %s during pre-flight', async (_name, rewritten) => {
        await withTestTransaction(async (tx) => {
            await seedAuthorization(tx, { ...AUTHORIZATION, ...rewritten });
            const result = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            expect(result.authorizationConsumed).toBe(false);
            expect((await authorizationRow(tx))?.value).not.toHaveProperty('consumedByRunId');
        });
    });

    it('does not consume anything when no authorization row exists', async () => {
        await withTestTransaction(async (tx) => {
            const result = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            expect(result.authorizationConsumed).toBe(false);
        });
    });

    it('a new authorization written by the owner is unconsumed again', async () => {
        await withTestTransaction(async (tx) => {
            const user = await seedAuthorization(tx);
            await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            await platformSettingsModel.upsertByKey(
                'billing.providerWatchAuthorization',
                AUTHORIZATION,
                user.id,
                tx
            );
            const again = await model.open({
                account: 'production',
                startedAt: START,
                consumeAuthorization: AUTHORIZATION,
                tx
            });
            expect(again.authorizationConsumed).toBe(true);
        });
    });

    it('lets exactly one of two CONCURRENT runs consume the same authorization', async () => {
        await withCleanSlate(async (db) => {
            await seedAuthorization(db);
            const attempt = () =>
                db.transaction(async (tx) =>
                    model.open({
                        account: 'production',
                        startedAt: START,
                        consumeAuthorization: AUTHORIZATION,
                        tx: tx as unknown as DrizzleClient
                    })
                );
            const results = await Promise.all([attempt(), attempt(), attempt()]);
            const winners = results.filter((result) => result.authorizationConsumed);
            expect(winners).toHaveLength(1);
            expect((await authorizationRow(getTestDb()))?.value).toMatchObject({
                consumedByRunId: winners[0]?.runId
            });
        });
    });
});

describe('the accepted baseline', () => {
    it('is empty until the owner accepts, then holds the accepted shapes with who and when', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            await tx.insert(users).values(user);
            expect(await model.listBaselines({ account: 'sandbox', tx })).toEqual([]);
            const run = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(run.runId), tx });
            const shapes = { create: { $: 'object', id: 'string' } };
            const stored = await model.acceptBaseline({
                account: 'sandbox',
                measurementId: 'M1',
                shapes,
                sourceRunId: run.runId,
                acceptedBy: user.id,
                tx
            });
            expect(stored).toMatchObject({ shapes, sourceRunId: run.runId, acceptedBy: user.id });
            expect(await model.listBaselines({ account: 'sandbox', tx })).toHaveLength(1);
            expect(await model.listBaselines({ account: 'production', tx })).toEqual([]);
        });
    });

    it('is advanced by accepting again, never by a run', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            await tx.insert(users).values(user);
            const first = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(first.runId), tx });
            const second = await model.open({ account: 'sandbox', startedAt: START, tx });
            await model.close({ ...close(second.runId), tx });
            const accept = (sourceRunId: string, shapes: Record<string, Record<string, string>>) =>
                model.acceptBaseline({
                    account: 'sandbox',
                    measurementId: 'M1',
                    shapes,
                    sourceRunId,
                    acceptedBy: user.id,
                    tx
                });
            await accept(first.runId, { create: { a: 'string' } });
            // A newer run exists but nothing advanced the baseline.
            expect((await model.listBaselines({ account: 'sandbox', tx }))[0]?.sourceRunId).toBe(
                first.runId
            );
            await accept(second.runId, { create: { b: 'string' } });
            const [row] = await model.listBaselines({ account: 'sandbox', tx });
            expect(row).toMatchObject({
                sourceRunId: second.runId,
                shapes: { create: { b: 'string' } }
            });
        });
    });
});

describe('the permission and the baseline table exist after migrating', () => {
    it('adds billing.providerWatch.manage to permission_enum', async () => {
        const { rows } = await getTestPool().query<{ enumlabel: string }>(
            `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'permission_enum' AND e.enumlabel = 'billing.providerWatch.manage'`
        );
        expect(rows).toHaveLength(1);
    });

    it('refuses a baseline for an unknown account', async () => {
        await expect(
            getTestPool().query(
                `INSERT INTO provider_watch_shape_baseline (account, measurement_id, shapes, source_run_id, accepted_by)
                 VALUES ('staging', 'M1', '{}', gen_random_uuid(), gen_random_uuid())`
            )
        ).rejects.toThrow();
    });
});
