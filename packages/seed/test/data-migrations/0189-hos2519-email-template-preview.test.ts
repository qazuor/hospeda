import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0189-hos2519-email-template-preview.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const actor: Actor = { id: 'actor-hos2519-seed-test', role: RoleEnum.SUPER_ADMIN, permissions: [] };

function buildCtx(inserted: unknown[]): {
    ctx: SeedMigrationCtx;
    values: () => unknown[];
    conflictHandled: () => boolean;
    tables: () => unknown[];
} {
    let captured: unknown[] = [];
    let onConflict = false;
    const insertedInto: unknown[] = [];
    const db = {
        insert: (table: unknown) => {
            insertedInto.push(table);
            return {
                values: (rows: unknown[]) => {
                    captured = rows;
                    return {
                        onConflictDoNothing: () => {
                            onConflict = true;
                            return { returning: async () => inserted };
                        }
                    };
                }
            };
        }
    };
    return {
        ctx: { db, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx,
        values: () => captured,
        conflictHandled: () => onConflict,
        tables: () => insertedInto
    };
}

describe('HOS-2519 email template preview seed migration', () => {
    it('AC-6.2: is required, additive, and grants only SUPER_ADMIN and ADMIN', () => {
        // Assert
        expect(migration.meta).toEqual({
            name: '0189-hos2519-email-template-preview',
            group: 'required',
            destructive: false
        });
        expect(migration.GRANTS).toEqual([
            {
                role: RoleEnum.SUPER_ADMIN,
                permission: PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW
            },
            { role: RoleEnum.ADMIN, permission: PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW }
        ]);
    });

    it('AC-6.2: the baseline grants the same two roles and nobody else (dual-write)', () => {
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            expect(ROLE_PERMISSIONS[role]).toContain(PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW);
        }
        expect(
            Object.values(ROLE_PERMISSIONS)
                .flat()
                .filter((permission) => permission === PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW)
        ).toHaveLength(2);
    });

    it('AC-6.2: writes only the declared grants, with onConflictDoNothing', async () => {
        // Arrange
        const { ctx, values, conflictHandled, tables } = buildCtx([...migration.GRANTS]);

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({ granted: 2, alreadyPresent: 0 });
        expect(values()).toEqual(migration.GRANTS);
        expect(conflictHandled()).toBe(true);
        expect(tables()).toHaveLength(1);
        // Compared by name: the test and the module under test may hold distinct
        // instances of the drizzle table object (same pattern as 0007's test).
        expect(getTableName(tables()[0] as Parameters<typeof getTableName>[0])).toBe(
            getTableName(rolePermission)
        );
        expect(getTableName(rolePermission)).toBe('role_permission');
    });

    it('AC-6.2: is idempotent when the rows already exist', async () => {
        // Act
        const result = await migration.up(buildCtx([]).ctx);

        // Assert
        expect(result.counts).toEqual({ granted: 0, alreadyPresent: 2 });
    });
});
