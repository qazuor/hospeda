import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('HOS-1541 manual payment permissions migration', () => {
    it('places both permissions immediately before trial.extend in enum order', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(sql`
                SELECT e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'permission_enum'
                ORDER BY e.enumsortorder
            `);
            const labels = result.rows.map((row) => row.enumlabel);
            const trialIndex = labels.indexOf('trial.extend');
            expect(labels.slice(trialIndex - 2, trialIndex + 1)).toEqual([
                'billing.registerManualPayment',
                'billing.declareManualUnpaid',
                'trial.extend'
            ]);
        });
    });
});
