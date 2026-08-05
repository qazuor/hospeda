/**
 * @fileoverview
 * Unit tests for the `0039-event-organizer-permissions` data migration, using a
 * mocked `ctx.db.insert(...).values(...).onConflictDoNothing().returning()`
 * chain (same style as `0026-alliance-lead-permissions.test.ts` /
 * `0038-hos-374-cut-editor-panel-access.test.ts`) — no real database
 * connection.
 *
 * @module test/data-migrations/0039-event-organizer-permissions
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as eventOrganizerPermissionsMigration from '../../src/data-migrations/0039-event-organizer-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-event-organizer-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The grant lists come from the migration module itself, never re-declared
 * here. A local copy would be a third source of truth: it could agree with
 * the seed while the migration silently disagreed with both, and this suite
 * — whose whole job is to prove seed and migration cannot drift — would stay
 * green.
 */
const { EVENT_ORGANIZER_FULL_FAMILY, EDITOR_EVENT_ORGANIZER_GRANTS, GRANTS } =
    eventOrganizerPermissionsMigration;

/** The five family members EDITOR must NOT receive from this migration. */
const EDITOR_EXCLUDED_PERMISSIONS: readonly PermissionEnum[] = EVENT_ORGANIZER_FULL_FAMILY.filter(
    (permission) => !EDITOR_EVENT_ORGANIZER_GRANTS.includes(permission)
);

/**
 * Fake `DrizzleClient` handle — only `.insert(...)` is exercised.
 * `readInsertValues()` is a getter, not a snapshot: the rows are captured
 * when `up()` calls `.values()`, which happens long after this factory
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

function buildCtx(insertedRows: unknown[]): {
    ctx: SeedMigrationCtx;
    readInsertValues: () => unknown[];
} {
    const { db, readInsertValues } = buildFakeDb(insertedRows);

    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, readInsertValues };
}

describe('0039-event-organizer-permissions meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(eventOrganizerPermissionsMigration.meta).toEqual({
            name: '0039-event-organizer-permissions',
            group: 'required',
            destructive: false
        });
    });
});

describe('0039-event-organizer-permissions — exported lists shape', () => {
    it('the full family has exactly 6 members', () => {
        expect(EVENT_ORGANIZER_FULL_FAMILY).toHaveLength(6);
        expect(EVENT_ORGANIZER_FULL_FAMILY).toEqual([
            PermissionEnum.EVENT_ORGANIZER_CREATE,
            PermissionEnum.EVENT_ORGANIZER_VIEW,
            PermissionEnum.EVENT_ORGANIZER_UPDATE,
            PermissionEnum.EVENT_ORGANIZER_DELETE,
            PermissionEnum.EVENT_ORGANIZER_RESTORE,
            PermissionEnum.EVENT_ORGANIZER_HARD_DELETE
        ]);
    });

    it('EDITOR receives only EVENT_ORGANIZER_CREATE', () => {
        expect(EDITOR_EVENT_ORGANIZER_GRANTS).toEqual([PermissionEnum.EVENT_ORGANIZER_CREATE]);
    });

    it('GRANTS has 6 (SUPER_ADMIN) + 6 (ADMIN) + 1 (EDITOR) = 13 pairs', () => {
        expect(GRANTS).toHaveLength(13);
        expect(GRANTS.filter((g) => g.role === RoleEnum.SUPER_ADMIN)).toHaveLength(6);
        expect(GRANTS.filter((g) => g.role === RoleEnum.ADMIN)).toHaveLength(6);
        expect(GRANTS.filter((g) => g.role === RoleEnum.EDITOR)).toHaveLength(1);
    });
});

describe('0039-event-organizer-permissions — no drift against the seed', () => {
    it('every SUPER_ADMIN grant is present in the seed', () => {
        const superAdminPerms = ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN] ?? [];
        for (const permission of EVENT_ORGANIZER_FULL_FAMILY) {
            expect(superAdminPerms, `seed SUPER_ADMIN must hold ${permission}`).toContain(
                permission
            );
        }
    });

    it('every ADMIN grant is present in the seed', () => {
        const adminPerms = ROLE_PERMISSIONS[RoleEnum.ADMIN] ?? [];
        for (const permission of EVENT_ORGANIZER_FULL_FAMILY) {
            expect(adminPerms, `seed ADMIN must hold ${permission}`).toContain(permission);
        }
    });

    it('EDITOR holds EVENT_ORGANIZER_CREATE in the seed', () => {
        const editorPerms = ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? [];
        for (const permission of EDITOR_EVENT_ORGANIZER_GRANTS) {
            expect(editorPerms, `seed EDITOR must hold ${permission}`).toContain(permission);
        }
    });

    it('EDITOR does NOT hold the other five family members, in either the seed or the migration lists', () => {
        const editorPerms = ROLE_PERMISSIONS[RoleEnum.EDITOR] ?? [];
        expect(EDITOR_EXCLUDED_PERMISSIONS).toHaveLength(5);
        for (const permission of EDITOR_EXCLUDED_PERMISSIONS) {
            expect(
                EDITOR_EVENT_ORGANIZER_GRANTS,
                `migration must not grant ${permission} to EDITOR`
            ).not.toContain(permission);
            expect(editorPerms, `seed EDITOR must NOT hold ${permission}`).not.toContain(
                permission
            );
        }
    });
});

describe('0039-event-organizer-permissions up()', () => {
    it('inserts all 13 (role, permission) pairs', async () => {
        const insertedRows = GRANTS.map((g) => ({ ...g }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await eventOrganizerPermissionsMigration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the
        // count from the mocked `.returning()`.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(13);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 13 of 13/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        // First run: everything gets inserted for real.
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((g) => ({ ...g })));
        await expect(eventOrganizerPermissionsMigration.up(ctxFirst)).resolves.not.toThrow();

        // Second run: onConflictDoNothing skips every row, .returning() yields [].
        const { ctx: ctxSecond } = buildCtx([]);
        const result = await eventOrganizerPermissionsMigration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(13);
        expect(result.summary).toMatch(/Granted 0 of 13/);
    });
});
