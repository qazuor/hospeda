import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0180-hos1512-provider-watch-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1512-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-1512 provider watch permission seed grant', () => {
    it('declares an additive migration granting the permission to SUPER_ADMIN only', () => {
        expect(migration.meta).toEqual({
            name: '0180-hos1512-provider-watch-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PROVIDER_WATCH_MANAGE }
        ]);
    });

    it('keeps the baseline in step: only SUPER_ADMIN holds the permission', () => {
        const holders = Object.entries(ROLE_PERMISSIONS)
            .filter(([, permissions]) => permissions.includes(PermissionEnum.PROVIDER_WATCH_MANAGE))
            .map(([role]) => role);
        expect(holders).toEqual([RoleEnum.SUPER_ADMIN]);
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
