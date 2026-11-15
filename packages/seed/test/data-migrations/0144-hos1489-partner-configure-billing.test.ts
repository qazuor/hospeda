import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0144-hos1489-partner-configure-billing.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1489-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('AC:V7:17 ACC:6 Partner billing permission seed migration', () => {
    it('is required, additive, and grants only SUPER_ADMIN', () => {
        expect(migration.meta).toEqual({
            name: '0144-hos1489-partner-configure-billing',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_CONFIGURE_BILLING }
        ]);
        expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(
            PermissionEnum.PARTNER_CONFIGURE_BILLING
        );
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).not.toContain(
            PermissionEnum.PARTNER_CONFIGURE_BILLING
        );
    });

    it('writes only the declared grant and tolerates an existing row', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts).toEqual({ granted: 1, alreadyPresent: 0 });
        expect(values()).toEqual(migration.GRANTS);
        expect((await migration.up(buildCtx([]).ctx)).counts).toEqual({
            granted: 0,
            alreadyPresent: 1
        });
    });
});
