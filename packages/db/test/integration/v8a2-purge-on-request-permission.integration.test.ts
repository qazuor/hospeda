import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:V8a:10 listing purge on request permission schema', () => {
    it('contains listing.purgeOnRequest in permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange + Act
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = 'listing.purgeOnRequest'`
            );

            // Assert
            expect(result.rows).toHaveLength(1);
        });
    });
});
