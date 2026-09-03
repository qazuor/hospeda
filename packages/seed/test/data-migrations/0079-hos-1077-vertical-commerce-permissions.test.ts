/**
 * @fileoverview
 * Unit tests for the `0079-hos-1077-vertical-commerce-permissions` data
 * migration, against a mocked Drizzle chain — no real database connection.
 * Same style as `0062-hos686-commerce-listing-moderation-permission.test.ts`.
 *
 * The migration's job is to make a live environment look like a freshly seeded
 * one, so the assertions that matter most are the no-drift ones: every literal
 * this migration declares must equal what `ROLE_PERMISSIONS` grants. A test that
 * re-declared the lists locally would compare its own copy against the seed and
 * stay green while the migration disagreed with both.
 *
 * @module test/data-migrations/0079-hos-1077-vertical-commerce-permissions
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0079-hos-1077-vertical-commerce-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1077-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

const {
    STAFF_PERMISSIONS,
    STAFF_ROLES,
    GASTRONOMY_OWNER_PERMISSIONS,
    EXPERIENCE_OWNER_PERMISSIONS,
    GRANTS
} = migration;

/** Every `gastronomy.*` / `experience.*` value the enum defines. */
const ALL_VERTICAL_PERMISSIONS = Object.values(PermissionEnum).filter(
    (value) => value.startsWith('gastronomy.') || value.startsWith('experience.')
);

/**
 * A Drizzle stub covering the two shapes this migration uses: the
 * `insert().values().onConflictDoNothing().returning()` chain, and the
 * `selectDistinct().from().where()` owner lookup.
 *
 * @param params.ownersByCall - Owner rows returned by successive `selectDistinct`
 *   calls, in `VERTICAL_OWNER_SOURCES` order (gastronomy, then experience).
 * @param params.insertedByCall - Rows echoed by successive `returning()` calls,
 *   in call order (role_permission first, then one per vertical with owners).
 */
function buildCtx(params: {
    ownersByCall: Array<Array<{ ownerId: string | null }>>;
    insertedByCall: unknown[][];
}): { ctx: SeedMigrationCtx; readInsertValues: () => unknown[][] } {
    const insertValues: unknown[][] = [];
    let insertCall = 0;
    let selectCall = 0;

    const db = {
        insert: () => ({
            values: (rows: unknown[]) => {
                insertValues.push(rows);
                const echoed = params.insertedByCall[insertCall] ?? [];
                insertCall += 1;
                return {
                    onConflictDoNothing: () => ({
                        returning: () => Promise.resolve(echoed)
                    })
                };
            }
        }),
        selectDistinct: () => ({
            from: () => ({
                where: () => {
                    const rows = params.ownersByCall[selectCall] ?? [];
                    selectCall += 1;
                    return Promise.resolve(rows);
                }
            })
        })
    } as unknown as SeedMigrationCtx['db'];

    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, readInsertValues: () => insertValues };
}

describe('0079-hos-1077 vertical commerce permissions — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0079-hos-1077-vertical-commerce-permissions',
            group: 'required',
            destructive: false
        });
    });

    it('is NOT marked destructive — every statement is an additive upsert', () => {
        // The production gate demands `--allow-destructive` for a `true` here.
        // Marking an insert-only migration destructive trains operators to pass
        // a blanket opt-in that also unblocks genuinely destructive ones.
        expect(migration.meta.destructive).toBe(false);
    });
});

describe('0079-hos-1077 vertical commerce permissions — exported lists', () => {
    it('grants the twelve admin-tier vertical permissions to staff', () => {
        expect(STAFF_PERMISSIONS).toHaveLength(12);
        expect([...STAFF_ROLES].sort()).toEqual([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN].sort());
    });

    it('does NOT hand an editOwn to staff — that is an owner authority', () => {
        expect(STAFF_PERMISSIONS).not.toContain(PermissionEnum.GASTRONOMY_EDIT_OWN);
        expect(STAFF_PERMISSIONS).not.toContain(PermissionEnum.EXPERIENCE_EDIT_OWN);
    });

    it('removes nothing: every grant is an addition', () => {
        // The expand half of expand/contract. A legacy `commerce.*` value
        // appearing in this migration at all would mean it is touching the rows
        // release 2 owns.
        for (const grant of GRANTS) {
            expect(grant.permission.startsWith('commerce.')).toBe(false);
        }
    });

    it('gives each owner role its OWN vertical and not the other', () => {
        // The whole product point. If either list carried the other vertical's
        // editOwn, the split would have re-created the coupling it removes.
        expect(GASTRONOMY_OWNER_PERMISSIONS).toContain(PermissionEnum.GASTRONOMY_EDIT_OWN);
        expect(GASTRONOMY_OWNER_PERMISSIONS).not.toContain(PermissionEnum.EXPERIENCE_EDIT_OWN);
        expect(GASTRONOMY_OWNER_PERMISSIONS).not.toContain(PermissionEnum.EXPERIENCE_CREATE);

        expect(EXPERIENCE_OWNER_PERMISSIONS).toContain(PermissionEnum.EXPERIENCE_EDIT_OWN);
        expect(EXPERIENCE_OWNER_PERMISSIONS).not.toContain(PermissionEnum.GASTRONOMY_EDIT_OWN);
        expect(EXPERIENCE_OWNER_PERMISSIONS).not.toContain(PermissionEnum.GASTRONOMY_CREATE);
    });

    it('gives neither owner role an admin-tier authority over listings', () => {
        // Scoped to the two vertical families on purpose: an owner legitimately
        // holds unrelated `.delete` permissions (`media.delete`,
        // `userBookmark.delete`). What they must never hold is admin-tier
        // authority over LISTINGS — theirs or anyone's.
        const ADMIN_TIER_SUFFIXES = ['.viewAll', '.editAll', '.delete', '.moderationChange'];
        for (const permissions of [GASTRONOMY_OWNER_PERMISSIONS, EXPERIENCE_OWNER_PERMISSIONS]) {
            const verticalOnes = permissions.filter(
                (permission) =>
                    permission.startsWith('gastronomy.') || permission.startsWith('experience.')
            );
            expect(verticalOnes.length).toBeGreaterThan(0);
            for (const permission of verticalOnes) {
                for (const suffix of ADMIN_TIER_SUFFIXES) {
                    expect(permission.endsWith(suffix), `${permission} is admin-tier`).toBe(false);
                }
            }
        }
    });

    it('addresses every (role, permission) pair at most once', () => {
        const keys = GRANTS.map((g) => `${g.role}::${g.permission}`);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('0079-hos-1077 vertical commerce permissions — no drift against the seed', () => {
    it.each([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN])('seed %s holds all twelve', (role) => {
        const perms = ROLE_PERMISSIONS[role] ?? [];
        for (const permission of STAFF_PERMISSIONS) {
            expect(perms, `seed ${role} must hold ${permission}`).toContain(permission);
        }
    });

    it('the GASTRONOMY_OWNER list equals the seed exactly', () => {
        expect([...GASTRONOMY_OWNER_PERMISSIONS].sort()).toEqual(
            [...(ROLE_PERMISSIONS[RoleEnum.GASTRONOMY_OWNER] ?? [])].sort()
        );
    });

    it('the EXPERIENCE_OWNER list equals the seed exactly', () => {
        expect([...EXPERIENCE_OWNER_PERMISSIONS].sort()).toEqual(
            [...(ROLE_PERMISSIONS[RoleEnum.EXPERIENCE_OWNER] ?? [])].sort()
        );
    });

    it('no role outside SUPER_ADMIN/ADMIN and the two owners holds a vertical permission', () => {
        const allowed = new Set<RoleEnum>([
            RoleEnum.SUPER_ADMIN,
            RoleEnum.ADMIN,
            RoleEnum.GASTRONOMY_OWNER,
            RoleEnum.EXPERIENCE_OWNER
        ]);
        for (const role of Object.values(RoleEnum)) {
            if (allowed.has(role)) {
                continue;
            }
            const perms: readonly string[] = ROLE_PERMISSIONS[role] ?? [];
            for (const permission of ALL_VERTICAL_PERMISSIONS) {
                expect(perms, `seed ${role} must NOT hold ${permission}`).not.toContain(permission);
            }
        }
    });

    it('COMMERCE_OWNER keeps its legacy permissions and gains none of the new ones', () => {
        // Expand, not contract: the legacy role is untouched, which is what
        // stops anyone losing access before release 2 runs.
        const perms: readonly string[] = ROLE_PERMISSIONS[RoleEnum.COMMERCE_OWNER] ?? [];
        expect(perms).toContain(PermissionEnum.COMMERCE_EDIT_OWN);
        expect(perms).toContain(PermissionEnum.COMMERCE_CREATE);
        for (const permission of ALL_VERTICAL_PERMISSIONS) {
            expect(perms).not.toContain(permission);
        }
    });
});

describe('0079-hos-1077 vertical commerce permissions — up()', () => {
    it('inserts every role_permission pair and one user_role row per listing owner', async () => {
        const { ctx, readInsertValues } = buildCtx({
            ownersByCall: [[{ ownerId: 'owner-gastro' }], [{ ownerId: 'owner-exp' }]],
            insertedByCall: [GRANTS.map((g) => ({ ...g })), [{}], [{}]]
        });

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        const [rolePermissionRows, gastronomyOwnerRows, experienceOwnerRows] = readInsertValues();
        expect(rolePermissionRows).toEqual(GRANTS);
        expect(gastronomyOwnerRows).toEqual([
            expect.objectContaining({
                userId: 'owner-gastro',
                role: RoleEnum.GASTRONOMY_OWNER
            })
        ]);
        expect(experienceOwnerRows).toEqual([
            expect.objectContaining({
                userId: 'owner-exp',
                role: RoleEnum.EXPERIENCE_OWNER
            })
        ]);

        expect(result.counts?.rolePermissionsGranted).toBe(GRANTS.length);
        expect(result.counts?.ownerRolesGranted).toBe(2);
        expect(result.counts?.ownerRolesConsidered).toBe(2);
    });

    it('gives a gastronomy-only owner the gastronomy role and NOT the experience one', async () => {
        // The reason the owner grant reads the listings instead of copying
        // COMMERCE_OWNER: copying would hand both roles to somebody who only
        // ever ran a restaurant, re-creating the exact coupling being removed.
        const { ctx, readInsertValues } = buildCtx({
            ownersByCall: [[{ ownerId: 'owner-gastro' }], []],
            insertedByCall: [[], [{}]]
        });

        await migration.up(ctx);

        const inserts = readInsertValues();
        const userRoleRows = inserts.slice(1).flat() as Array<{ userId: string; role: RoleEnum }>;
        expect(userRoleRows).toHaveLength(1);
        expect(userRoleRows[0]?.role).toBe(RoleEnum.GASTRONOMY_OWNER);
        expect(userRoleRows.some((row) => row.role === RoleEnum.EXPERIENCE_OWNER)).toBe(false);
    });

    it('gives an owner of BOTH verticals both roles', async () => {
        const { ctx, readInsertValues } = buildCtx({
            ownersByCall: [[{ ownerId: 'owner-both' }], [{ ownerId: 'owner-both' }]],
            insertedByCall: [[], [{}], [{}]]
        });

        await migration.up(ctx);

        const userRoleRows = readInsertValues().slice(1).flat() as Array<{
            userId: string;
            role: RoleEnum;
        }>;
        expect(userRoleRows.map((row) => row.role).sort()).toEqual(
            [RoleEnum.EXPERIENCE_OWNER, RoleEnum.GASTRONOMY_OWNER].sort()
        );
        expect(userRoleRows.every((row) => row.userId === 'owner-both')).toBe(true);
    });

    it('skips the user_role insert entirely when a vertical has no owners', async () => {
        const { ctx, readInsertValues } = buildCtx({
            ownersByCall: [[], []],
            insertedByCall: [[]]
        });

        const result = await migration.up(ctx);

        // One insert only: the role_permission batch.
        expect(readInsertValues()).toHaveLength(1);
        expect(result.counts?.ownerRolesConsidered).toBe(0);
        expect(result.counts?.ownerRolesGranted).toBe(0);
    });

    it('drops owner rows with a null ownerId instead of inserting a null user_role', async () => {
        const { ctx, readInsertValues } = buildCtx({
            ownersByCall: [[{ ownerId: null }], []],
            insertedByCall: [[]]
        });

        const result = await migration.up(ctx);

        expect(readInsertValues()).toHaveLength(1);
        expect(result.counts?.ownerRolesConsidered).toBe(0);
    });

    it('is idempotent: reports 0 inserted on a second run and does not throw', async () => {
        const { ctx: first } = buildCtx({
            ownersByCall: [[{ ownerId: 'owner-gastro' }], [{ ownerId: 'owner-exp' }]],
            insertedByCall: [GRANTS.map((g) => ({ ...g })), [{}], [{}]]
        });
        await expect(migration.up(first)).resolves.not.toThrow();

        const { ctx: second } = buildCtx({
            ownersByCall: [[{ ownerId: 'owner-gastro' }], [{ ownerId: 'owner-exp' }]],
            insertedByCall: [[], [], []]
        });
        const result = await migration.up(second);

        expect(result.counts?.rolePermissionsGranted).toBe(0);
        expect(result.counts?.rolePermissionsAlreadyPresent).toBe(GRANTS.length);
        expect(result.counts?.ownerRolesGranted).toBe(0);
        expect(result.counts?.ownerRolesConsidered).toBe(2);
    });
});
