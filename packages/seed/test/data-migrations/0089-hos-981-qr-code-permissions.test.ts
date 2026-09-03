/**
 * @fileoverview
 * Unit tests for the `0089-hos-981-qr-code-permissions` data migration, using a
 * mocked insert chain — no real database connection. Same style as
 * `0072-hos-765-billing-reconciliation-permission.test.ts`.
 *
 * The suite's real job is to prove three things that would otherwise fail
 * silently:
 *
 *   1. The migration and the seed baseline cannot drift apart. That pair is the
 *      whole HOS-25 dual-write rule; when they disagree, fresh databases and
 *      live ones end up with different access and nothing complains.
 *   2. **Nobody gains or loses access.** The permissions are a SPLIT of what
 *      `SETTINGS_MANAGE` already opened, not a re-shuffle of who can do what, so
 *      the grant list must be exactly the roles that already hold
 *      `SETTINGS_MANAGE`. A widened grant here is invisible — no other test in
 *      the repo fails when a permission reaches one more role.
 *   3. `SETTINGS_MANAGE` is NOT revoked. It gates far more than QR codes, and a
 *      migration that tidied it away would take SEO defaults and system tags
 *      with it.
 *
 * @module test/data-migrations/0089-hos-981-qr-code-permissions
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0089-hos-981-qr-code-permissions.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos981-qr-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The lists come from the migration module itself, never re-declared here. A
 * local copy would be a third source of truth: it could agree with the seed
 * while the migration silently disagreed with both, and this suite would stay
 * green while proving nothing.
 */
const { QR_CODE_PERMISSIONS, GRANTED_ROLES, GRANTS } = migration;

/** Every role that must NOT receive the grants. */
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

describe('0089-hos-981 QR-code permissions — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0089-hos-981-qr-code-permissions',
            group: 'required',
            destructive: false
        });
    });

    it('meta.name matches the file name, which is the ledger primary key', () => {
        // The ledger keys on this string. A rename that misses it re-runs a
        // migration that already ran, or strands one that never did.
        expect(migration.meta.name).toBe('0089-hos-981-qr-code-permissions');
    });
});

describe('0089-hos-981 QR-code permissions — exported lists shape', () => {
    it('grants exactly the four QR verbs', () => {
        expect([...QR_CODE_PERMISSIONS]).toEqual([
            PermissionEnum.QR_CODE_VIEW,
            PermissionEnum.QR_CODE_CREATE,
            PermissionEnum.QR_CODE_UPDATE,
            PermissionEnum.QR_CODE_DELETE
        ]);
    });

    it('spells them on the platform family convention', () => {
        // Asserted on the LITERAL strings, because those are what a SQL audit of
        // `role_permission` or a prefix filter actually sees — the TypeScript
        // constant name is invisible to both. `platform.qrCode.*` mirrors
        // `platform.featureFlag.manage`, the panel area's existing precedent.
        expect([...QR_CODE_PERMISSIONS]).toEqual([
            'platform.qrCode.view',
            'platform.qrCode.create',
            'platform.qrCode.update',
            'platform.qrCode.delete'
        ]);
    });

    it('targets SUPER_ADMIN and ADMIN', () => {
        expect([...GRANTED_ROLES]).toEqual([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]);
    });

    it('GRANTS is 4 permissions x 2 roles = 8 pairs, with no duplicates', () => {
        expect(GRANTS).toHaveLength(8);
        const unique = new Set(GRANTS.map((g) => `${g.role}|${g.permission}`));
        expect(unique.size).toBe(GRANTS.length);
    });
});

describe('0089-hos-981 QR-code permissions — no drift against the seed', () => {
    it.each([RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN])('seed %s holds all four', (role) => {
        const perms = ROLE_PERMISSIONS[role] ?? [];
        for (const permission of QR_CODE_PERMISSIONS) {
            expect(perms, `seed ${role} must hold ${permission}`).toContain(permission);
        }
    });

    it('no other role holds any of them in the seed', () => {
        expect(EXCLUDED_ROLES.length).toBeGreaterThan(0);
        for (const role of EXCLUDED_ROLES) {
            const perms = ROLE_PERMISSIONS[role] ?? [];
            for (const permission of QR_CODE_PERMISSIONS) {
                expect(perms, `seed ${role} must NOT hold ${permission}`).not.toContain(permission);
            }
        }
    });

    /**
     * The invariant the owner asked for in so many words: this release makes the
     * QR manager DELEGABLE, it does not change who can reach it today. So the
     * set of roles granted the QR verbs must be exactly the set that already
     * holds `SETTINGS_MANAGE` — computed from the seed, not restated, so the
     * assertion tracks the seed if `SETTINGS_MANAGE` ever moves.
     */
    it('is granted to exactly the roles that already hold SETTINGS_MANAGE', () => {
        const settingsRoles = Object.values(RoleEnum).filter((role) =>
            (ROLE_PERMISSIONS[role] ?? []).includes(PermissionEnum.SETTINGS_MANAGE)
        );

        expect(settingsRoles.length).toBeGreaterThan(0);
        expect([...GRANTED_ROLES].sort()).toEqual([...settingsRoles].sort());
    });

    /**
     * The routes stopped asking for `SETTINGS_MANAGE`, but the permission itself
     * must stay exactly where it was: it gates SEO defaults, system tags and
     * more. A migration that "tidied up" by revoking it would take all of that
     * with it, and this is the assertion that would notice.
     */
    it('does not revoke SETTINGS_MANAGE from anyone', () => {
        for (const role of [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN]) {
            expect(ROLE_PERMISSIONS[role] ?? []).toContain(PermissionEnum.SETTINGS_MANAGE);
        }
    });
});

describe('0089-hos-981 QR-code permissions — up()', () => {
    it('inserts all eight (role, permission) pairs', async () => {
        const insertedRows = GRANTS.map((grant) => ({ ...grant }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(8);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 8 of 8/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((grant) => ({ ...grant })));
        await expect(migration.up(ctxFirst)).resolves.not.toThrow();

        const { ctx: ctxSecond } = buildCtx([]);
        const result = await migration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(8);
        expect(result.summary).toMatch(/Granted 0 of 8/);
    });
});
