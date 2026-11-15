import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0143-hos1487-partner-owner-family.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const EXPECTED_GRANTS = [
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
].map((permission) => ({ role: RoleEnum.PARTNER_OWNER, permission }));

const actor: Actor = { id: 'actor-hos1487-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

function buildCtx(inserted: unknown[]): { ctx: SeedMigrationCtx; values: () => unknown[] } {
    let captured: unknown[] = [];
    const db = {
        insert: () => ({
            values: (rows: unknown[]) => {
                captured = rows;
                return { onConflictDoNothing: () => ({ returning: async () => inserted }) };
            }
        })
    };
    return {
        ctx: { db, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx,
        values: () => captured
    };
}

describe('HOS-1487 partner owner family seed migration', () => {
    it('is required, additive, and grants exactly the partner owner family', () => {
        expect(migration.meta).toEqual({
            name: '0143-hos1487-partner-owner-family',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual(EXPECTED_GRANTS);
        for (const grant of migration.GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('does not grant partner.editOwn to any other baseline role', () => {
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            if (role !== RoleEnum.PARTNER_OWNER)
                expect(permissions).not.toContain(PermissionEnum.PARTNER_EDIT_OWN);
        }
    });

    it('writes only the declared grants and tolerates already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts).toEqual({
            granted: EXPECTED_GRANTS.length,
            alreadyPresent: 0
        });
        expect(values()).toEqual(EXPECTED_GRANTS);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: EXPECTED_GRANTS.length });
    });
});
