import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0200-hos2685-direct-email-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos2685-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

const DIRECT_EMAIL = [
    PermissionEnum.DIRECT_EMAIL_VIEW,
    PermissionEnum.DIRECT_EMAIL_SEND,
    PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE
];

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

describe('HOS-2685 direct email permissions seed', () => {
    it('is required, additive, and grants all three permissions to SUPER_ADMIN and ADMIN', () => {
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
        expect(migration.GRANTS).toHaveLength(6);
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            for (const permission of DIRECT_EMAIL) {
                expect(migration.GRANTS).toContainEqual({ role, permission });
            }
        }
    });

    it('baseline matches: SUPER_ADMIN and ADMIN have them, no other role does (EDITOR included)', () => {
        for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
            const expected = role === RoleEnum.SUPER_ADMIN || role === RoleEnum.ADMIN;
            for (const permission of DIRECT_EMAIL) {
                expect(permissions.includes(permission), `${role} ${permission}`).toBe(expected);
            }
        }
    });

    it('writes only the declared grants and is idempotent', async () => {
        const { ctx, values } = buildCtx(migration.GRANTS);
        const first = await migration.up(ctx);
        const repeated = await migration.up(buildCtx([]).ctx);
        expect(first.counts?.granted).toBe(6);
        expect(values()).toEqual(migration.GRANTS);
        expect(repeated.counts).toEqual({ granted: 0, alreadyPresent: 6 });
    });
});
