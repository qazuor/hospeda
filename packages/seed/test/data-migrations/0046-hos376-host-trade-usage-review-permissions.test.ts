/**
 * @fileoverview
 * Unit tests for the `0046-hos376-host-trade-usage-review-permissions` data
 * migration, using a mocked insert chain — no real database connection. Same
 * style as `0039-event-organizer-permissions.test.ts`.
 *
 * @module test/data-migrations/0046-hos376-host-trade-usage-review-permissions
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0046-hos376-host-trade-usage-review-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos376-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The lists come from the migration module itself, never re-declared here. A
 * local copy would be a third source of truth: it could agree with the seed
 * while the migration silently disagreed with both, and this suite — whose
 * whole job is to prove seed and migration cannot drift — would stay green.
 */
const { STAFF_PERMISSIONS, HOST_PERMISSIONS, GRANTS } = migration;

/** What HOST must NOT receive: everything staff gets minus the host grant. */
const HOST_EXCLUDED: readonly PermissionEnum[] = STAFF_PERMISSIONS.filter(
    (permission) => !HOST_PERMISSIONS.includes(permission)
);

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

describe('0046-hos376 permissions — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0046-hos376-host-trade-usage-review-permissions',
            group: 'required',
            destructive: false
        });
    });
});

describe('0046-hos376 permissions — exported lists shape', () => {
    it('staff receives all five HOS-376 permissions', () => {
        expect(STAFF_PERMISSIONS).toEqual([
            PermissionEnum.HOST_TRADE_REVIEW_CREATE,
            PermissionEnum.HOST_TRADE_REVIEW_VIEW_ALL,
            PermissionEnum.HOST_TRADE_REVIEW_MODERATE,
            PermissionEnum.HOST_TRADE_USAGE_VIEW_ALL,
            PermissionEnum.HOST_TRADE_USAGE_MANAGE
        ]);
    });

    it('HOST receives only HOST_TRADE_REVIEW_CREATE', () => {
        expect(HOST_PERMISSIONS).toEqual([PermissionEnum.HOST_TRADE_REVIEW_CREATE]);
    });

    it('GRANTS has 5 (SUPER_ADMIN) + 5 (ADMIN) + 1 (HOST) = 11 pairs', () => {
        expect(GRANTS).toHaveLength(11);
        expect(GRANTS.filter((g) => g.role === RoleEnum.SUPER_ADMIN)).toHaveLength(5);
        expect(GRANTS.filter((g) => g.role === RoleEnum.ADMIN)).toHaveLength(5);
        expect(GRANTS.filter((g) => g.role === RoleEnum.HOST)).toHaveLength(1);
    });

    it('grants no permission to any role beyond those three', () => {
        const roles = new Set(GRANTS.map((g) => g.role));
        expect([...roles].sort()).toEqual(
            [RoleEnum.ADMIN, RoleEnum.HOST, RoleEnum.SUPER_ADMIN].sort()
        );
    });
});

describe('0046-hos376 permissions — no drift against the seed', () => {
    it('every SUPER_ADMIN grant is present in the seed', () => {
        const perms = ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN] ?? [];
        for (const permission of STAFF_PERMISSIONS) {
            expect(perms, `seed SUPER_ADMIN must hold ${permission}`).toContain(permission);
        }
    });

    it('every ADMIN grant is present in the seed', () => {
        const perms = ROLE_PERMISSIONS[RoleEnum.ADMIN] ?? [];
        for (const permission of STAFF_PERMISSIONS) {
            expect(perms, `seed ADMIN must hold ${permission}`).toContain(permission);
        }
    });

    it('HOST holds the review-create grant in the seed', () => {
        const perms = ROLE_PERMISSIONS[RoleEnum.HOST] ?? [];
        for (const permission of HOST_PERMISSIONS) {
            expect(perms, `seed HOST must hold ${permission}`).toContain(permission);
        }
    });

    it('HOST does NOT hold the staff-only four, in either the seed or the migration', () => {
        const perms = ROLE_PERMISSIONS[RoleEnum.HOST] ?? [];
        expect(HOST_EXCLUDED).toHaveLength(4);
        for (const permission of HOST_EXCLUDED) {
            expect(
                HOST_PERMISSIONS,
                `migration must not grant ${permission} to HOST`
            ).not.toContain(permission);
            expect(perms, `seed HOST must NOT hold ${permission}`).not.toContain(permission);
        }
    });
});

describe('0046-hos376 permissions — up()', () => {
    it('inserts all 11 (role, permission) pairs', async () => {
        const insertedRows = GRANTS.map((g) => ({ ...g }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(11);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 11 of 11/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((g) => ({ ...g })));
        await expect(migration.up(ctxFirst)).resolves.not.toThrow();

        const { ctx: ctxSecond } = buildCtx([]);
        const result = await migration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(11);
        expect(result.summary).toMatch(/Granted 0 of 11/);
    });
});
