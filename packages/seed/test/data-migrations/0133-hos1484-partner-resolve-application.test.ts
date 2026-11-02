import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0133-hos1484-partner-resolve-application.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos1484-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-1484 partner application permission seed migration', () => {
    it('is required, additive, and grants exactly both staff roles', () => {
        expect(migration.meta).toEqual({
            name: '0133-hos1484-partner-resolve-application',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.PARTNER_RESOLVE_APPLICATION },
            { role: RoleEnum.ADMIN, permission: PermissionEnum.PARTNER_RESOLVE_APPLICATION }
        ]);
        for (const grant of migration.GRANTS)
            expect(ROLE_PERMISSIONS[grant.role]).toContain(grant.permission);
    });

    it('does not grant the permission to client manager or editor roles', () => {
        expect(ROLE_PERMISSIONS[RoleEnum.CLIENT_MANAGER]).not.toContain(
            PermissionEnum.PARTNER_RESOLVE_APPLICATION
        );
        expect(ROLE_PERMISSIONS[RoleEnum.EDITOR]).not.toContain(
            PermissionEnum.PARTNER_RESOLVE_APPLICATION
        );
    });

    it('writes only the declared grants and tolerates already-present rows', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        expect((await migration.up(ctx)).counts?.granted).toBe(2);
        expect(values()).toEqual(migration.GRANTS);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
