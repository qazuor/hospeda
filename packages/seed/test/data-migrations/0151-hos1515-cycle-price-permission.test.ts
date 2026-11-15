import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0151-hos1515-cycle-price-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1515-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('AC:B2:4 HOS-1515 cycle price permission seed migration', () => {
    it('is required, additive, and grants exactly the action 19 permission to SUPER_ADMIN', () => {
        expect(migration.meta).toEqual({
            name: '0151-hos1515-cycle-price-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_SET_CYCLE_PRICE }
        ]);
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(
            PermissionEnum.BILLING_SET_CYCLE_PRICE
        );
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).not.toContain(
            PermissionEnum.BILLING_SET_CYCLE_PRICE
        );
    });

    it('writes only the declared grant and is idempotent', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(first.counts?.granted).toBe(1);
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 1 });
    });
});
