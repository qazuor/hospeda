import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, rolePermission, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0143-hos1487-partner-owner-family.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const STUB_ACTOR: Actor = {
    id: 'actor-hos1487-partner-owner-family-integration',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};
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

function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return {
        db: tx,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

async function rowsForNonPartnerRoles(tx: DrizzleClient) {
    const result = await tx.execute(sql`
        SELECT role, permission FROM role_permission
        WHERE role <> ${RoleEnum.PARTNER_OWNER}::role_enum
        ORDER BY role, permission`);
    return result.rows;
}

async function partnerOwnerRows(tx: DrizzleClient) {
    const result = await tx.execute(sql`
        SELECT role, permission FROM role_permission
        WHERE role = ${RoleEnum.PARTNER_OWNER}::role_enum
        ORDER BY permission`);
    return result.rows.sort((a, b) => String(a.permission).localeCompare(String(b.permission)));
}

describe('TEST:V7:20 HOS-1487 migration over preexisting roles and permissions', () => {
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

    it('adds the partner owner family and preserves every other role_permission row', async () => {
        await withRollback(async (tx) => {
            await tx.insert(rolePermission).values([
                { role: RoleEnum.ADMIN, permission: PermissionEnum.PARTNER_MANAGE },
                { role: RoleEnum.USER, permission: PermissionEnum.USER_VIEW_PROFILE },
                { role: RoleEnum.PARTNER_OWNER, permission: PermissionEnum.USER_VIEW_PROFILE }
            ]);
            const otherRolesBefore = await rowsForNonPartnerRoles(tx);

            const result = await migration.up(buildCtx(tx));
            expect(result.counts).toEqual({
                granted: EXPECTED_PERMISSIONS.length - 1,
                alreadyPresent: 1
            });
            expect(await partnerOwnerRows(tx)).toEqual(
                EXPECTED_PERMISSIONS.map((permission) => ({
                    role: RoleEnum.PARTNER_OWNER,
                    permission
                })).sort((a, b) => a.permission.localeCompare(b.permission))
            );
            expect(await rowsForNonPartnerRoles(tx)).toEqual(otherRolesBefore);

            const second = await migration.up(buildCtx(tx));
            expect(second.counts).toEqual({
                granted: 0,
                alreadyPresent: EXPECTED_PERMISSIONS.length
            });
        });
    });
});
