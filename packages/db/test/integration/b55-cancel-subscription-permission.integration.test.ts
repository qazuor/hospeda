import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

/** The permission of administrative action 8 (cancel a subscription; S36 with the revocation motive). */
const CANCEL_SUBSCRIPTION_PERMISSION = 'billing.cancelSubscription';

describe('HOS-1543 billing.cancelSubscription from an empty database', () => {
    it('a: contains billing.cancelSubscription in permission_enum after migrating', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange + Act
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = ${CANCEL_SUBSCRIPTION_PERMISSION}`
            );

            // Assert
            expect(result.rows).toHaveLength(1);
        });
    });

    it('b: accepts a role_permission row carrying billing.cancelSubscription', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange: the transaction is rolled back, so clearing the subject row touches nothing shared.
            await tx.execute(
                sql`DELETE FROM role_permission WHERE role = 'SUPER_ADMIN' AND permission = ${CANCEL_SUBSCRIPTION_PERMISSION}`
            );

            // Act
            await tx.execute(
                sql`INSERT INTO role_permission (role, permission) VALUES ('SUPER_ADMIN', ${CANCEL_SUBSCRIPTION_PERMISSION})`
            );
            const rows = await tx.execute(
                sql`SELECT role, permission FROM role_permission WHERE role = 'SUPER_ADMIN' AND permission = ${CANCEL_SUBSCRIPTION_PERMISSION}`
            );

            // Assert
            expect(rows.rows).toEqual([
                { role: 'SUPER_ADMIN', permission: CANCEL_SUBSCRIPTION_PERMISSION }
            ]);
        });
    });
});
