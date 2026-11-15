import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0145-hos1498-partner-empty-presence.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1498-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };
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

describe('AC:V8b:6 ACC:25 Partner empty-presence seed migration', () => {
    it('is required, additive, and grants only SUPER_ADMIN and ADMIN', () => {
        expect(migration.meta).toEqual({
            name: '0145-hos1498-partner-empty-presence',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE },
            { role: RoleEnum.ADMIN, permission: PermissionEnum.PARTNER_EMPTY_PRESENCE }
        ]);
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN])
            expect(ROLE_PERMISSIONS[role]).toContain(PermissionEnum.PARTNER_EMPTY_PRESENCE);
        expect(
            Object.values(ROLE_PERMISSIONS)
                .flat()
                .filter((permission) => permission === PermissionEnum.PARTNER_EMPTY_PRESENCE)
        ).toHaveLength(2);
    });

    it('writes only declared grants and tolerates existing rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts).toEqual({ granted: 2, alreadyPresent: 0 });
        expect(values()).toEqual(migration.GRANTS);
        expect((await migration.up(buildCtx([]).ctx)).counts).toEqual({
            granted: 0,
            alreadyPresent: 2
        });
    });
});
