import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0153-hos1580-pause-and-plan-change-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1580-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('AC:B8b:22 HOS-1580 permissions seed migration', () => {
    it('grants exactly actions 9 and 10 to SUPER_ADMIN in both write paths', () => {
        expect(migration.meta).toEqual({
            name: '0153-hos1580-pause-and-plan-change-permissions',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.BILLING_PAUSE_SUBSCRIPTION },
            {
                role: RoleEnum.SUPER_ADMIN,
                permission: PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN
            }
        ]);
        for (const { permission } of migration.GRANTS) {
            expect(ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN]).toContain(permission);
        }
    });

    it('inserts the declared grants idempotently', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(values()).toEqual(migration.GRANTS);
        expect(first.counts).toEqual({ granted: 2, alreadyPresent: 0 });
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
