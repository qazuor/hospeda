import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0122-hos1540-billing-settle-external-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1540-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('TEST:B5:6 HOS-1540 billing settle-external seed migration', () => {
    it('is required, additive, and grants the baseline permission to SUPER_ADMIN only', () => {
        // Arrange / Act
        const { meta, GRANTS } = migration;

        // Assert
        expect(meta).toEqual({
            name: '0122-hos1540-billing-settle-external-permission',
            group: 'required',
            destructive: false
        });
        expect(GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_SETTLE_EXTERNAL }
        ]);
        for (const grant of GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('keeps the permission out of the ADMIN baseline', () => {
        // Arrange / Act
        const adminPermissions = ROLE_PERMISSIONS[RoleEnum.ADMIN];

        // Assert
        expect(adminPermissions).not.toContain(PermissionEnum.BILLING_SETTLE_EXTERNAL);
    });

    it('writes only the declared grants and supports already-present rows', async () => {
        // Arrange
        const { ctx, values } = buildCtx(migration.GRANTS);

        // Act
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);

        // Assert
        expect(first.counts?.granted).toBe(1);
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 1 });
    });
});
