/**
 * HOS-2349 (D-15, AC-C51a): `mcpActivity.view` reaches SUPER_ADMIN and only
 * SUPER_ADMIN, both on a fresh DB (the baseline) and on a live one (the
 * data-migration). The two halves are asserted against each other so the
 * dual-write cannot drift.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0183-hos2349-mcp-activity-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos2349-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

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

describe('HOS-2349 MCP activity permission seed grant', () => {
    it('declares an additive migration granting the permission to SUPER_ADMIN only', () => {
        expect(migration.meta).toEqual({
            name: '0183-hos2349-mcp-activity-permission',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            { role: RoleEnum.SUPER_ADMIN, permission: PermissionEnum.MCP_ACTIVITY_VIEW }
        ]);
    });

    it('keeps the baseline in step: only SUPER_ADMIN holds the permission, never ADMIN', () => {
        const holders = Object.entries(ROLE_PERMISSIONS)
            .filter(([, permissions]) => permissions.includes(PermissionEnum.MCP_ACTIVITY_VIEW))
            .map(([role]) => role);
        expect(holders).toEqual([RoleEnum.SUPER_ADMIN]);
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN]).not.toContain(PermissionEnum.MCP_ACTIVITY_VIEW);
    });

    it('grants on a live DB exactly what the baseline grants on a fresh one', () => {
        const baseline = Object.entries(ROLE_PERMISSIONS)
            .filter(([, permissions]) => permissions.includes(PermissionEnum.MCP_ACTIVITY_VIEW))
            .map(([role]) => ({ role, permission: PermissionEnum.MCP_ACTIVITY_VIEW }));
        expect(migration.GRANTS).toEqual(baseline);
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
