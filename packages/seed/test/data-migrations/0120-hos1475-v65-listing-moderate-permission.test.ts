import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0120-hos1475-v65-listing-moderate-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1475-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('TEST:V6:12 HOS-1475 listing moderation seed migration', () => {
    it('is required, additive, and grants the baseline permission to both staff roles', () => {
        expect(migration.meta).toEqual({
            name: '0120-hos1475-v65-listing-moderate-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.LISTING_MODERATE },
            { role: RoleEnum.ADMIN, permission: PermissionEnum.LISTING_MODERATE }
        ]);
        for (const grant of migration.GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('writes only the declared grants and supports already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts?.granted).toBe(2);
        expect(values()).toEqual(migration.GRANTS);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
