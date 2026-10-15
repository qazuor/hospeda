import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const PERMISSIONS = ['user.manageSuperAdminRole', 'billing.grantComplimentary'] as const;

describe('HOS-1460 super admin exclusive permissions from an empty database', () => {
    it('a: both permission values exist in permission_enum after migrating', async () => {
        await withTestTransaction(async (tx) => {
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = ANY(${sql.param([...PERMISSIONS])}::text[])`
            );
            expect(result.rows.map((row) => row.enumlabel).sort()).toEqual([...PERMISSIONS].sort());
        });
    });

    it('b: accepts a role_permission row for each permission', async () => {
        await withTestTransaction(async (tx) => {
            for (const permission of PERMISSIONS) {
                await tx.execute(
                    sql`INSERT INTO role_permission (role, permission) VALUES ('SUPER_ADMIN', ${permission})`
                );
                const rows = await tx.execute(
                    sql`SELECT role, permission FROM role_permission WHERE role = 'SUPER_ADMIN' AND permission = ${permission}`
                );
                expect(rows.rows).toContainEqual({ role: 'SUPER_ADMIN', permission });
            }
        });
    });
});
