import { afterAll, describe, expect, it } from 'vitest';
import {
    isReconciliationSweepRunComplete,
    reconciliationSweepRunModel as model
} from '../../src/models/reconciliation-sweep-run/reconciliation-sweep-run.model.ts';
import { reconciliationSweepRuns } from '../../src/schemas/vertical/reconciliation-sweep-run.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

function postgresCause(error: unknown): { code?: string; constraint?: string } | null {
    const seen = new Set<unknown>();
    let current = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const candidate = current as { code?: string; constraint?: string; cause?: unknown };
        if (candidate.code) return candidate;
        current = candidate.cause;
    }
    return null;
}

describe('reconciliation sweep run registry (supports TEST:B11:24)', () => {
    it('opens, closes once, and defines completeness from finish and failures', async () => {
        await withTestTransaction(async (tx) => {
            const startedAt = new Date('2026-10-11T10:00:00.000Z');
            const opened = await model.open({ correlationId: crypto.randomUUID(), startedAt, tx });
            expect(opened).toMatchObject({
                finishedAt: null,
                rowsRead: 0,
                rowsFailed: 0,
                startedAt
            });
            expect(
                isReconciliationSweepRunComplete({ finishedAt: opened.finishedAt, rowsFailed: 0 })
            ).toBe(false);
            const finishedAt = new Date(startedAt.getTime() + 1_000);
            const closed = await model.close({
                id: opened.id,
                finishedAt,
                rowsRead: 4,
                rowsFailed: 1,
                tx
            });
            expect(closed).toMatchObject({ finishedAt, rowsRead: 4, rowsFailed: 1 });
            expect(
                isReconciliationSweepRunComplete({ finishedAt: closed!.finishedAt, rowsFailed: 1 })
            ).toBe(false);
            expect(
                await model.close({
                    id: opened.id,
                    finishedAt: new Date(finishedAt.getTime() + 1),
                    rowsRead: 9,
                    rowsFailed: 0,
                    tx
                })
            ).toBeNull();
            expect(await model.findById({ id: opened.id, tx })).toEqual(closed);

            const complete = await model.open({
                correlationId: crypto.randomUUID(),
                startedAt,
                tx
            });
            const done = await model.close({
                id: complete.id,
                finishedAt,
                rowsRead: 2,
                rowsFailed: 0,
                tx
            });
            expect(
                isReconciliationSweepRunComplete({ finishedAt: done!.finishedAt, rowsFailed: 0 })
            ).toBe(true);
        });
    });

    it('enforces the named count and span checks through Drizzle cause wrappers', async () => {
        await withTestTransaction(async (tx) => {
            const startedAt = new Date('2026-10-11T10:00:00.000Z');
            // Use direct inserts so each CHECK is independently exercised.
            for (const invalid of [
                {
                    rowsRead: -1,
                    rowsFailed: 0,
                    finishedAt: null,
                    constraint: 'ck_reconciliation_sweep_run_counts'
                },
                {
                    rowsRead: 0,
                    rowsFailed: 0,
                    finishedAt: new Date(startedAt.getTime() - 1),
                    constraint: 'ck_reconciliation_sweep_run_span'
                }
            ]) {
                let failure: unknown;
                try {
                    await tx.transaction(async (savepoint) => {
                        await savepoint.insert(reconciliationSweepRuns).values({
                            correlationId: crypto.randomUUID(),
                            startedAt,
                            rowsRead: invalid.rowsRead,
                            rowsFailed: invalid.rowsFailed,
                            finishedAt: invalid.finishedAt
                        });
                    });
                } catch (error) {
                    failure = error;
                }
                expect(postgresCause(failure)).toMatchObject({
                    code: '23514',
                    constraint: invalid.constraint
                });
            }
        });
    });

    it('leaves a run open when no closer runs', async () => {
        await withTestTransaction(async (tx) => {
            const opened = await model.open({
                correlationId: crypto.randomUUID(),
                startedAt: new Date('2026-10-11T10:00:00.000Z'),
                tx
            });
            expect(await model.findById({ id: opened.id, tx })).toMatchObject({
                id: opened.id,
                finishedAt: null,
                rowsRead: 0,
                rowsFailed: 0
            });
        });
    });
});
