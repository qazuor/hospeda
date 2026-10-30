import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('AC:B9b:9 HOS-1591 the promo code permission exists from an empty database', () => {
    it('a: the permission value exists in permission_enum after migrating', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = 'billing.managePromoCodes'`
            );
            expect(result.rows.map((row) => row.enumlabel)).toEqual(['billing.managePromoCodes']);
        });
    });

    it('b: accepts the action 21 permission on a SUPER_ADMIN role_permission row', async () => {
        await withTestTransaction(async (tx) => {
            await tx.execute(
                sql`INSERT INTO role_permission (role, permission) VALUES ('SUPER_ADMIN', 'billing.managePromoCodes')`
            );
            const rows = await tx.execute(
                sql`SELECT role, permission FROM role_permission WHERE role = 'SUPER_ADMIN' AND permission = 'billing.managePromoCodes'`
            );
            expect(rows.rows).toContainEqual({
                role: 'SUPER_ADMIN',
                permission: 'billing.managePromoCodes'
            });
        });
    });
});
