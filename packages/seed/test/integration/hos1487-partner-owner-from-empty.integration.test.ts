/**
 * TEST:V7:19 exercises the required baseline against a fresh database built only
 * from this branch's structural migrations. The baseline creates the final role
 * family, while data migrations are stamped without running (`baselineStamp`),
 * so TEST:V7:20 exercises `up()` separately. The heavier CLI path used by
 * `venue-bootstrap-from-empty` was not used to avoid adding 20 minutes to the
 * suite; it covers the same migration-created database and baseline behavior.
 * Inserting `partner.editOwn` below can succeed only if the structural migration
 * added the enum value.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, rolePermission, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const EXPECTED_PERMISSIONS = [
    PermissionEnum.PARTNER_EDIT_OWN,
    PermissionEnum.USER_VIEW_PROFILE,
    PermissionEnum.USER_UPDATE_PROFILE,
    PermissionEnum.USER_SETTINGS_UPDATE,
    PermissionEnum.RECOMMENDATION_VIEW,
    PermissionEnum.USER_BOOKMARK_CREATE,
    PermissionEnum.USER_BOOKMARK_UPDATE,
    PermissionEnum.USER_BOOKMARK_DELETE,
    PermissionEnum.USER_BOOKMARK_VIEW,
    PermissionEnum.USER_BOOKMARK_RESTORE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
    PermissionEnum.DASHBOARD_BASE_VIEW,
    PermissionEnum.ACCESS_API_PUBLIC,
    PermissionEnum.BILLING_VIEW_OWN,
    PermissionEnum.USER_UPDATE_SELF
];

class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

describe('TEST:V7:19 partner owner family from an empty migrated database', () => {
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

    it('includes partner.editOwn in the migrated permission_enum', async () => {
        const result = await pool.query<{ enumlabel: string }>(
            `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = $1`,
            ['partner.editOwn']
        );
        expect(result.rows).toEqual([{ enumlabel: 'partner.editOwn' }]);
    });

    it('writes exactly the partner owner family through the required baseline shape', async () => {
        await withRollback(async (tx) => {
            const baselineRows = Object.entries(ROLE_PERMISSIONS).flatMap(([role, permissions]) =>
                permissions.map((permission) => ({ role: role as RoleEnum, permission }))
            );
            await tx.insert(rolePermission).values(baselineRows).onConflictDoNothing();

            const result = await tx.execute(sql`
                SELECT role, permission FROM role_permission
                WHERE role = ${RoleEnum.PARTNER_OWNER}::role_enum
                ORDER BY permission`);
            const actual = result.rows.sort((a, b) =>
                String(a.permission).localeCompare(String(b.permission))
            );
            expect(actual).toEqual(
                EXPECTED_PERMISSIONS.map((permission) => ({
                    role: RoleEnum.PARTNER_OWNER,
                    permission
                })).sort((a, b) => a.permission.localeCompare(b.permission))
            );
        });
    });
});
