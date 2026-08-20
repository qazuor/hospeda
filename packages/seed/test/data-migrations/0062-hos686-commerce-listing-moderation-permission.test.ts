/**
 * @fileoverview
 * Unit tests for the `0062-hos686-commerce-listing-moderation-permission` data
 * migration, using a mocked insert chain — no real database connection. Same
 * style as `0048-hos376-host-trade-usage-review-permissions.test.ts`.
 *
 * @module test/data-migrations/0062-hos686-commerce-listing-moderation-permission
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0062-hos686-commerce-listing-moderation-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos686-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The lists come from the migration module itself, never re-declared here. A
 * local copy would be a third source of truth: it could agree with the seed
 * while the migration silently disagreed with both, and this suite — whose whole
 * job is to prove seed and migration cannot drift — would stay green.
 */
const { STAFF_PERMISSIONS, GRANTED_ROLES, GRANTS } = migration;

/** Every role that must NOT receive the grant. */
const EXCLUDED_ROLES: readonly RoleEnum[] = Object.values(RoleEnum).filter(
    (role) => !GRANTED_ROLES.includes(role)
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

describe('0062-hos686 commerce listing moderation — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0062-hos686-commerce-listing-moderation-permission',
            group: 'required',
            destructive: false
        });
    });
});

describe('0062-hos686 commerce listing moderation — exported lists shape', () => {
    it('grants exactly COMMERCE_MODERATION_CHANGE', () => {
        expect(STAFF_PERMISSIONS).toEqual([PermissionEnum.COMMERCE_MODERATION_CHANGE]);
    });

    it('does NOT grant COMMERCE_MODERATE_REVIEW — that is a different authority', () => {
        // The naming trap named in HOS-589 §6.7: `commerce.moderateReview`
        // moderates reviews ABOUT a listing, not the listing.
        expect(STAFF_PERMISSIONS).not.toContain(PermissionEnum.COMMERCE_MODERATE_REVIEW);
    });

    it('targets only SUPER_ADMIN and ADMIN', () => {
        expect([...GRANTED_ROLES].sort()).toEqual([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN].sort());
    });

    it('GRANTS is 1 permission x 2 roles = 2 pairs', () => {
        expect(GRANTS).toHaveLength(2);
        expect(GRANTS.filter((g) => g.role === RoleEnum.SUPER_ADMIN)).toHaveLength(1);
        expect(GRANTS.filter((g) => g.role === RoleEnum.ADMIN)).toHaveLength(1);
    });
});

describe('0062-hos686 commerce listing moderation — no drift against the seed', () => {
    it.each([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN])('seed %s holds the grant', (role) => {
        const perms = ROLE_PERMISSIONS[role] ?? [];
        for (const permission of STAFF_PERMISSIONS) {
            expect(perms, `seed ${role} must hold ${permission}`).toContain(permission);
        }
    });

    it('no other role holds it in the seed — a listing owner must not clear their own rejection', () => {
        expect(EXCLUDED_ROLES.length).toBeGreaterThan(0);
        for (const role of EXCLUDED_ROLES) {
            const perms = ROLE_PERMISSIONS[role] ?? [];
            expect(perms, `seed ${role} must NOT hold COMMERCE_MODERATION_CHANGE`).not.toContain(
                PermissionEnum.COMMERCE_MODERATION_CHANGE
            );
        }
    });

    it('COMMERCE_OWNER is explicitly among the roles that do not hold it', () => {
        // Instrument check: if COMMERCE_OWNER ever left RoleEnum, the loop above
        // would still pass while asserting nothing about the case that matters.
        expect(EXCLUDED_ROLES).toContain(RoleEnum.COMMERCE_OWNER);
    });
});

describe('0062-hos686 commerce listing moderation — up()', () => {
    it('inserts both (role, permission) pairs', async () => {
        const insertedRows = GRANTS.map((g) => ({ ...g }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(2);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 2 of 2/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((g) => ({ ...g })));
        await expect(migration.up(ctxFirst)).resolves.not.toThrow();

        const { ctx: ctxSecond } = buildCtx([]);
        const result = await migration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(2);
        expect(result.summary).toMatch(/Granted 0 of 2/);
    });
});
