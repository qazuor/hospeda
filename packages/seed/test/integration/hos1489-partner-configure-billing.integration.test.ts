import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, rolePermission, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0144-hos1489-partner-configure-billing.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });
const actor: Actor = {
    id: 'actor-hos1489-integration',
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

describe('AC:V7:17 ACC:6 seed migration integration', () => {
    beforeAll(() => {
        const databaseUrl = process.env.HOSPEDA_DATABASE_URL;
        if (!databaseUrl) throw new Error('HOSPEDA_DATABASE_URL is not set');
        pool = new Pool({ connectionString: databaseUrl });
        resetDb();
        initializeDb(pool);
    });
    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('writes the action 6 permission only for SUPER_ADMIN and is idempotent', async () => {
        await withRollback(async (tx) => {
            const result = await migration.up(context(tx));
            expect(result.counts).toEqual({ granted: 1, alreadyPresent: 0 });
            const rows = await tx.execute(
                sql`SELECT role, permission FROM role_permission WHERE permission = ${PermissionEnum.PARTNER_CONFIGURE_BILLING}::permission_enum ORDER BY role`
            );
            expect(rows.rows).toEqual([
                { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_CONFIGURE_BILLING }
            ]);
            expect((await migration.up(context(tx))).counts).toEqual({
                granted: 0,
                alreadyPresent: 1
            });
            const preserved = await tx
                .select()
                .from(rolePermission)
                .where(
                    sql`${rolePermission.permission} = ${PermissionEnum.PARTNER_CONFIGURE_BILLING}::permission_enum`
                );
            expect(preserved).toEqual([
                { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_CONFIGURE_BILLING }
            ]);
        });
    });
});
