/**
 * @fileoverview
 * Unit tests for the `0038-hos-374-cut-editor-panel-access` data migration,
 * using a fully mocked `ctx.models.RRolePermissionModel` (for the deletion
 * half, same style as `0010-remove-panel-admin-from-host-commerce-owner.test.ts`)
 * plus a mocked `ctx.db.insert(...).values(...).onConflictDoNothing().returning()`
 * chain (for the insertion half) — no real database connection.
 *
 * @module test/data-migrations/0038-hos-374-cut-editor-panel-access
 */
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as cutPanelAccessMigration from '../../src/data-migrations/0038-hos-374-cut-editor-panel-access.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos374-cut-panel-access-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The three grant lists come from the migration module itself, never re-declared
 * here. A local copy would be a third source of truth: it could agree with the
 * seed while the migration silently disagreed with both, and this suite — whose
 * whole job is to prove seed and migration cannot drift — would stay green.
 */
const { EDITOR_GRANTS_TO_REMOVE, CLIENT_MANAGER_GRANTS_TO_REMOVE, EDITOR_GRANTS_TO_ADD } =
    cutPanelAccessMigration;

/**
 * Fake `DrizzleClient` handle — only `.insert(...)` is exercised beyond the
 * passthrough. `readInsertValues()` is a getter, not a snapshot: the rows are
 * captured when `up()` calls `.values()`, which happens long after this factory
 * returns.
 */
function buildFakeDb(insertedRows: unknown[]): {
    db: SeedMigrationCtx['db'];
    readInsertValues: () => unknown[];
} {
    let insertValues: unknown[] = [];

    const db = {
        insert: () => ({
            values: (rows: unknown[]) => {
                insertValues = rows;
                return {
                    onConflictDoNothing: () => ({
                        returning: () => Promise.resolve(insertedRows)
                    })
                };
            }
        })
    } as unknown as SeedMigrationCtx['db'];

    return { db, readInsertValues: () => insertValues };
}

/**
 * Builds a fully mocked `SeedMigrationCtx` whose `ctx.models.RRolePermissionModel`
 * is a class with a single shared `hardDelete` mock (visible across every
 * `up()` call, one per targeted permission) and whose `ctx.db.insert(...)`
 * chain resolves `insertedRows` from `.returning()`.
 */
function buildCtx(
    deletedCount: number,
    insertedRows: unknown[]
): {
    ctx: SeedMigrationCtx;
    hardDelete: ReturnType<typeof vi.fn>;
    readInsertValues: () => unknown[];
} {
    const hardDelete = vi.fn().mockResolvedValue(deletedCount);

    class MockRRolePermissionModel {
        hardDelete = hardDelete;
    }

    const { db, readInsertValues } = buildFakeDb(insertedRows);

    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: { RRolePermissionModel: MockRRolePermissionModel },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, hardDelete, readInsertValues };
}

describe('0038-hos-374-cut-editor-panel-access meta', () => {
    it('exports the expected destructive/required meta shape', () => {
        expect(cutPanelAccessMigration.meta).toEqual({
            name: '0038-hos-374-cut-editor-panel-access',
            group: 'required',
            destructive: true
        });
    });
});

describe('0038-hos-374-cut-editor-panel-access — pair list matches the seed (no drift)', () => {
    it('every grant the migration removes from EDITOR is absent from the seed', () => {
        const editorPerms = ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? [];
        expect(EDITOR_GRANTS_TO_REMOVE).toHaveLength(12);
        for (const permission of EDITOR_GRANTS_TO_REMOVE) {
            expect(editorPerms, `seed EDITOR must NOT still hold ${permission}`).not.toContain(
                permission
            );
        }
    });

    it('every grant the migration adds to EDITOR is present in the seed', () => {
        const editorPerms = ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? [];
        expect(EDITOR_GRANTS_TO_ADD).toHaveLength(4);
        for (const permission of EDITOR_GRANTS_TO_ADD) {
            expect(editorPerms, `seed EDITOR must hold ${permission}`).toContain(permission);
        }
    });

    it('every grant the migration removes from CLIENT_MANAGER is absent from the seed', () => {
        const clientManagerPerms = ROLE_PERMISSIONS[RoleEnum.CLIENT_MANAGER] ?? [];
        expect(CLIENT_MANAGER_GRANTS_TO_REMOVE).toHaveLength(2);
        for (const permission of CLIENT_MANAGER_GRANTS_TO_REMOVE) {
            expect(
                clientManagerPerms,
                `seed CLIENT_MANAGER must NOT still hold ${permission}`
            ).not.toContain(permission);
        }
    });

    it('the migration never removes and re-adds the same EDITOR grant', () => {
        const removed = new Set<PermissionEnum>(EDITOR_GRANTS_TO_REMOVE);
        const overlap = EDITOR_GRANTS_TO_ADD.filter((permission) => removed.has(permission));
        expect(overlap).toEqual([]);
    });
});

describe('0038-hos-374-cut-editor-panel-access up()', () => {
    it('deletes all 12 EDITOR grants and 2 CLIENT_MANAGER grants, and inserts the 4 EDITOR additions', async () => {
        // Arrange — first run against an environment that still has the old grants.
        const insertedRows = EDITOR_GRANTS_TO_ADD.map((permission) => ({
            role: RoleEnum.EDITOR,
            permission
        }));
        const { ctx, hardDelete, readInsertValues } = buildCtx(1, insertedRows);

        // Act
        const result = await cutPanelAccessMigration.up(ctx);

        // Assert — deletion side: 12 + 2 = 14 hardDelete calls total.
        expect(hardDelete).toHaveBeenCalledTimes(14);
        for (const permission of EDITOR_GRANTS_TO_REMOVE) {
            expect(hardDelete).toHaveBeenCalledWith({ role: RoleEnum.EDITOR, permission }, ctx.db);
        }
        for (const permission of CLIENT_MANAGER_GRANTS_TO_REMOVE) {
            expect(hardDelete).toHaveBeenCalledWith(
                { role: RoleEnum.CLIENT_MANAGER, permission },
                ctx.db
            );
        }

        // Assert — insertion side: the rows actually handed to `.values()`, not
        // just the count. `.returning()` is mocked, so asserting only on its
        // result would be asserting the mock rather than the migration.
        expect(readInsertValues()).toEqual(
            EDITOR_GRANTS_TO_ADD.map((permission) => ({ role: RoleEnum.EDITOR, permission }))
        );
        expect(result.counts?.editorGrantsAdded).toBe(4);
        expect(result.summary).toMatch(/granted 4 of 4/);
    });

    it('is idempotent: does NOT throw and reports zero deletions / zero insertions on a second run', async () => {
        // Arrange — second run (or a DB that already converged): hardDelete
        // matches zero rows, and the insert's onConflictDoNothing skips every
        // row because the composite PK already exists — .returning() yields [].
        const { ctx, hardDelete } = buildCtx(0, []);

        // Act — must resolve without throwing (a safe no-op re-run).
        await expect(cutPanelAccessMigration.up(ctx)).resolves.not.toThrow();
        const result = await cutPanelAccessMigration.up(ctx);

        // Assert
        expect(hardDelete).toHaveBeenCalledTimes(28); // 14 calls x 2 up() invocations above
        expect(result.counts?.editorGrantsAdded).toBe(0);
        expect(result.summary).toMatch(/granted 0 of 4/);
    });
});
