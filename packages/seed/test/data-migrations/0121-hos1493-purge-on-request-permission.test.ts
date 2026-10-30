import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0121-hos1493-purge-on-request-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1493-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('TEST:V8a:10 HOS-1493 listing purge on request seed migration', () => {
    it('is required, additive, and grants the baseline permission to both staff roles', () => {
        expect(migration.meta).toEqual({
            name: '0121-hos1493-purge-on-request-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.LISTING_PURGE_ON_REQUEST },
            { role: RoleEnum.ADMIN, permission: PermissionEnum.LISTING_PURGE_ON_REQUEST }
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
