import { eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { receiptCounters } from '../../src/schemas/vertical/receipt-counter.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

type CounterRow = { last_number: number };

async function upsert(tx: DrizzleClient) {
    const result = await tx.execute(sql<CounterRow>`
        INSERT INTO receipt_counter (id, last_number) VALUES (1, 1)
        ON CONFLICT (id) DO UPDATE SET last_number = receipt_counter.last_number + 1, updated_at = now()
        RETURNING last_number
    `);
    const rows = Array.isArray(result) ? result : result.rows;
    const row = rows[0] as CounterRow | undefined;
    if (!row) throw new Error('receipt counter upsert returned no row');
    return Number(row.last_number);
}

function postgresConstraint(error: unknown): string | undefined {
    const seen = new Set<unknown>();
    let current = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const value = current as { constraint?: string; cause?: unknown };
        if (value.constraint) return value.constraint;
        current = value.cause;
    }
    return undefined;
}

describe('receipt counter (TEST:B5:1)', () => {
    it('exists on the migrated database and rejects ids other than one', async () => {
        await expect(getTestDb().select().from(receiptCounters).limit(1)).resolves.toBeDefined();
        await withTestTransaction(async (tx) => {
            let failure: unknown;
            try {
                await tx.transaction(async (savepoint) => {
                    await savepoint.insert(receiptCounters).values({ id: 2, lastNumber: 1 });
                });
            } catch (error) {
                failure = error;
            }
            expect(postgresConstraint(failure)).toBe('ck_receipt_counter_single_row');
        });
    });

    it('increments transactionally and a rolled-back savepoint does not consume a number', async () => {
        await withTestTransaction(async (tx) => {
            const before = await tx
                .select()
                .from(receiptCounters)
                .where(eq(receiptCounters.id, 1))
                .limit(1);
            const first = await upsert(tx);
            expect(first).toBe(before[0] ? before[0].lastNumber + 1 : 1);
            const second = await upsert(tx);
            expect(second).toBe(first + 1);

            let rolledBackNumber: number | undefined;
            await expect(
                tx.transaction(async (savepoint) => {
                    rolledBackNumber = await upsert(savepoint);
                    throw new Error('rollback receipt counter savepoint');
                })
            ).rejects.toThrow('rollback receipt counter savepoint');
            expect(rolledBackNumber).toBe(second + 1);
            const afterRollback = await upsert(tx);
            expect(afterRollback).toBe(second + 1);
        });
    });
});
