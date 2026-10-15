import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0126-hos1460-super-admin-exclusive-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1460-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-1460 SUPER_ADMIN-exclusive seed data migration', () => {
    it('is required, additive, and grants exactly both permissions to SUPER_ADMIN', () => {
        expect(migration.meta).toEqual({
            name: '0126-hos1460-super-admin-exclusive-permissions',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.USER_MANAGE_SUPER_ADMIN_ROLE },
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_GRANT_COMPLIMENTARY }
        ]);
        for (const grant of migration.GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('writes only the declared grants and is idempotent', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(first.counts?.granted).toBe(2);
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
