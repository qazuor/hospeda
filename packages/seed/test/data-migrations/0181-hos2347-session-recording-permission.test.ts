import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0181-hos2347-session-recording-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos2347-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-2347 session recording permission seed (AC-PE2, AC-PE3)', () => {
    it('is required, additive, and grants the permission to SUPER_ADMIN only', () => {
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
        expect(migration.GRANTS).toEqual([
            {
                role: RoleEnum.SUPER_ADMIN,
                permission: PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE
            }
        ]);
    });

    it('baseline gives it to SUPER_ADMIN and to no other role (dual-write)', () => {
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            const has = permissions.includes(PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE);
            expect(has, role).toBe(role === RoleEnum.SUPER_ADMIN);
        }
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
