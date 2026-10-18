import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

/** The permission of administrative action 7 (lift one reconciliation mark; S15). */
const LIFT_RECONCILIATION_MARK_PERMISSION = 'billing.liftReconciliationMark';

describe('TEST:1697:2 AC:1697:1 billing.liftReconciliationMark from an empty database', () => {
    it('contains billing.liftReconciliationMark in permission_enum after migrating', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange + Act
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = ${LIFT_RECONCILIATION_MARK_PERMISSION}`
            );

            // Assert
            expect(result.rows).toHaveLength(1);
        });
    });
});
