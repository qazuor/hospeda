import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:HOS-1551:3 AC:B6:1 billing.refund permission migration', () => {
    it('adds billing.refund to permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = 'billing.refund'`
            );
            expect(result.rows).toHaveLength(1);
        });
    });
});
