/**
 * @fileoverview
 * Unit tests for the `0072-hos-765-billing-reconciliation-permission` data
 * migration, using a mocked insert chain — no real database connection. Same
 * style as `0067-hos-726-addon-purchase-permission.test.ts`.
 *
 * The suite's real job is to prove the migration and the seed baseline cannot
 * drift apart, and that the grant stayed as narrow as it was designed to be.
 * A widened grant here would be silent: nothing else in the codebase fails when
 * a money-writing permission reaches one more role.
 *
 * @module test/data-migrations/0072-hos-765-billing-reconciliation-permission
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0072-hos-765-billing-reconciliation-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos765-reconciliation-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The lists come from the migration module itself, never re-declared here. A
 * local copy would be a third source of truth: it could agree with the seed
 * while the migration silently disagreed with both, and this suite would stay
 * green while proving nothing.
 */
const { RECONCILIATION_PERMISSION, GRANTED_ROLES, GRANTS } = migration;

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

describe('0072-hos-765 billing reconciliation permission — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0072-hos-765-billing-reconciliation-permission',
            group: 'required',
            destructive: false
        });
    });

    it('meta.name matches the file name, which is the ledger primary key', () => {
        // The ledger keys on this string. A rename that misses it re-runs a
        // migration that already ran, or strands one that never did.
        expect(migration.meta.name).toBe('0072-hos-765-billing-reconciliation-permission');
    });
});

describe('0072-hos-765 billing reconciliation permission — exported lists shape', () => {
    it('grants exactly BILLING_RECONCILIATION_MANAGE', () => {
        expect(RECONCILIATION_PERMISSION).toBe(PermissionEnum.BILLING_RECONCILIATION_MANAGE);
    });

    it('spells the permission on the billing family convention', () => {
        // `billing.<subEntity>.<action>`, matching `billing.promoCode.read` and
        // `billing.addon.purchase`. Asserted on the LITERAL because the string is
        // what a SQL audit of role_permission or a prefix filter actually sees —
        // the TypeScript constant name is invisible to both.
        expect(RECONCILIATION_PERMISSION).toBe('billing.reconciliation.manage');
    });

    it('targets SUPER_ADMIN alone', () => {
        expect([...GRANTED_ROLES]).toEqual([RoleEnum.SUPER_ADMIN]);
    });

    it('GRANTS is 1 permission x 1 role = 1 pair', () => {
        expect(GRANTS).toHaveLength(1);
        expect(GRANTS[0]).toEqual({
            role: RoleEnum.SUPER_ADMIN,
            permission: RECONCILIATION_PERMISSION
        });
    });
});

describe('0072-hos-765 billing reconciliation permission — no drift against the seed', () => {
    it('seed SUPER_ADMIN holds the grant', () => {
        const perms = ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN] ?? [];
        expect(perms).toContain(RECONCILIATION_PERMISSION);
    });

    it('no other role holds it in the seed', () => {
        expect(EXCLUDED_ROLES.length).toBeGreaterThan(0);
        for (const role of EXCLUDED_ROLES) {
            const perms = ROLE_PERMISSIONS[role] ?? [];
            expect(perms, `seed ${role} must NOT hold ${RECONCILIATION_PERMISSION}`).not.toContain(
                RECONCILIATION_PERMISSION
            );
        }
    });

    it('ADMIN is explicitly among the roles that do not hold it', () => {
        // Instrument check, and the whole point of the grant being this narrow.
        // ADMIN is the role a reader would assume owns an admin screen, and
        // SPEC-164 deliberately revoked every billing permission from it. If
        // ADMIN ever left RoleEnum, the loop above would still pass while
        // asserting nothing about the case that matters.
        expect(EXCLUDED_ROLES).toContain(RoleEnum.ADMIN);
        expect(ROLE_PERMISSIONS[RoleEnum.ADMIN] ?? []).not.toContain(RECONCILIATION_PERMISSION);
    });

    it('is a DISTINCT permission from the billing gates it could have been folded into', () => {
        // The trap this permission exists to avoid: BILLING_MANAGE reads like the
        // right gate and already covers add-on expiry and subscription writes.
        // Attaching force-link and payment backfill to it would mean the grant
        // that lets someone expire an add-on also lets them move a real charge
        // from one customer's subscription to another's.
        expect(RECONCILIATION_PERMISSION).not.toBe(PermissionEnum.BILLING_MANAGE);
        expect(RECONCILIATION_PERMISSION).not.toBe(PermissionEnum.BILLING_READ_ALL);

        const superAdminPerms = ROLE_PERMISSIONS[RoleEnum.SUPER_ADMIN] ?? [];
        expect(superAdminPerms).toContain(PermissionEnum.BILLING_MANAGE);
        expect(superAdminPerms).toContain(RECONCILIATION_PERMISSION);
    });
});

describe('0072-hos-765 billing reconciliation permission — up()', () => {
    it('inserts the single (role, permission) pair', async () => {
        const insertedRows = GRANTS.map((grant) => ({ ...grant }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(1);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 1 of 1/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((grant) => ({ ...grant })));
        await expect(migration.up(ctxFirst)).resolves.not.toThrow();

        const { ctx: ctxSecond } = buildCtx([]);
        const result = await migration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(1);
        expect(result.summary).toMatch(/Granted 0 of 1/);
    });
});
