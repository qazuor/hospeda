import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0137-hos1541-manual-payment-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1541-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-1541 manual payment seed grants', () => {
    it('grants both manual payment permissions exclusively to SUPER_ADMIN in migration and baseline', () => {
        const expected = [
            {
                role: RoleEnum.SUPER_ADMIN,
                permission: PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT
            },
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID }
        ];
        expect(migration.meta).toEqual({
            name: '0137-hos1541-manual-payment-permissions',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual(expected);
        const baselineRolesByPermission = expected.map(({ permission }) =>
            Object.entries(ROLE_PERMISSIONS)
                .filter(([, permissions]) => permissions.includes(permission))
                .map(([role]) => role)
        );
        expect(baselineRolesByPermission).toEqual([[RoleEnum.SUPER_ADMIN], [RoleEnum.SUPER_ADMIN]]);
    });

    it('writes both declared grants and supports already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);

        expect(first.counts).toEqual({ granted: 2, alreadyPresent: 0 });
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
