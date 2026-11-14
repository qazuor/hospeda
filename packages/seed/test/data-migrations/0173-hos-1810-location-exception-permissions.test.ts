import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0173-hos-1810-location-exception-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1810-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-1810 location exception permissions seed migration', () => {
    it('is required, additive, and mirrors the baseline for both staff roles', () => {
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
        expect(migration.GRANTS).toHaveLength(4);
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            expect(ROLE_PERMISSIONS[role]).toContain(
                PermissionEnum.ACCOMMODATION_LOCATION_EXCEPTION_MANAGE
            );
            expect(ROLE_PERMISSIONS[role]).toContain(
                PermissionEnum.VENUE_LOCATION_EXCEPTION_MANAGE
            );
        }
        for (const grant of migration.GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('writes only the declared grants and supports already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts?.granted).toBe(4);
        expect(values()).toEqual(migration.GRANTS);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 4 });
    });
});
