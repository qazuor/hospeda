/** Integration test for the ACC:25 role grant migration. */
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, rolePermission, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0145-hos1498-partner-empty-presence.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

loadEnv({ path: 'apps/api/.env.local' });
const actor: Actor = {
    id: 'actor-hos1498-integration',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};
class RollbackSignal extends Error {}
let pool: Pool;
async function withRollback(run: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await run(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (!(error instanceof RollbackSignal)) throw error;
    }
}
function context(tx: DrizzleClient): SeedMigrationCtx {
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

describe('AC:V8b:6 ACC:25 seed migration integration', () => {
    beforeAll(() => {
        const databaseUrl =
            process.env.HOSPEDA_TEST_DATABASE_URL ?? process.env.HOSPEDA_DATABASE_URL;
        if (!databaseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is not set');
        pool = new Pool({ connectionString: databaseUrl });
        resetDb();
        initializeDb(pool);
    });
    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('writes exactly the two requested role grants and is idempotent', async () => {
        await withRollback(async (tx) => {
            expect((await migration.up(context(tx))).counts).toEqual({
                granted: 2,
                alreadyPresent: 0
            });
            const rows = await tx.execute(
                sql`SELECT role, permission FROM role_permission WHERE permission = ${PermissionEnum.PARTNER_EMPTY_PRESENCE}::permission_enum AND role IN (${RoleEnum.SUPER_ADMIN}, ${RoleEnum.ADMIN}) ORDER BY role`
            );
            expect(rows.rows).toEqual([
                { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE },
                { role: RoleEnum.ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE }
            ]);
            expect((await migration.up(context(tx))).counts).toEqual({
                granted: 0,
                alreadyPresent: 2
            });
            const preserved = await tx
                .select()
                .from(rolePermission)
                .where(
                    sql`${rolePermission.permission} = ${PermissionEnum.PARTNER_EMPTY_PRESENCE}::permission_enum`
                );
            expect(preserved).toEqual(rows.rows);
        });
    });
});
