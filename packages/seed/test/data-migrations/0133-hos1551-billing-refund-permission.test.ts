import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0133-hos1551-billing-refund-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1551-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

function buildCtx(inserted: unknown[]) {
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

describe('TEST:HOS-1551:4 AC:B6:1 billing refund seed grant', () => {
    it('declares an additive migration granting the permission to SUPER_ADMIN', () => {
        expect(migration.meta).toEqual({
            name: '0133-hos1551-billing-refund-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_REFUND }
        ]);
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(PermissionEnum.BILLING_REFUND);
    });

    it('writes only the declared grant and supports already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);

        expect(first.counts?.granted).toBe(1);
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 1 });
    });
});
