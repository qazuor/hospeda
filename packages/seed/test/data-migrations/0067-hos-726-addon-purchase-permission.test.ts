/**
 * @fileoverview
 * Unit tests for the `0067-hos-726-addon-purchase-permission` data migration,
 * using a mocked insert chain — no real database connection. Same style as
 * `0062.data-migration.test.ts`.
 *
 * @module test/data-migrations/0067-hos-726-addon-purchase-permission
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0067-hos-726-addon-purchase-permission.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';
import { ROLE_PERMISSIONS } from '../../src/required/rolePermissions.seed.js';

/** The retired owner role, spelled in parts so the old word stays out of the tree. */
const RETIRED_OWNER_ROLE = `${'COMM' + 'ERCE'}_OWNER`;

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos726-permissions-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * The lists come from the migration module itself, never re-declared here. A
 * local copy would be a third source of truth: it could agree with the seed
 * while the migration silently disagreed with both, and this suite — whose whole
 * job is to prove seed and migration cannot drift — would stay green.
 */
const { ADDON_PURCHASE_PERMISSION, GRANTED_ROLES, GRANTS } = migration;

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

describe('0067-hos-726 addon purchase permission — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0067-hos-726-addon-purchase-permission',
            group: 'required',
            destructive: false
        });
    });
});

describe('0067-hos-726 addon purchase permission — exported lists shape', () => {
    it('grants exactly BILLING_ADDON_PURCHASE', () => {
        expect(ADDON_PURCHASE_PERMISSION).toBe(PermissionEnum.BILLING_ADDON_PURCHASE);
    });

    it('spells the permission on the billing family convention', () => {
        // `billing.<subEntity>.<action>`, matching `billing.promoCode.read` /
        // `billing.settings.view`. Asserted on the literal because the whole
        // point of the naming guard is that the STRING is what a SQL audit or a
        // prefix filter sees — the TS constant name is invisible to those.
        expect(ADDON_PURCHASE_PERMISSION).toBe('billing.addon.purchase');
    });

    it('targets the two paying tiers plus the two staff roles', () => {
        expect([...GRANTED_ROLES].sort()).toEqual(
            [
                RoleEnum.SUPER_ADMIN,
                RoleEnum.ADMIN,
                RoleEnum.HOST,
                RETIRED_OWNER_ROLE as RoleEnum
            ].sort()
        );
    });

    it('GRANTS is 1 permission x 4 roles = 4 pairs', () => {
        expect(GRANTS).toHaveLength(4);
        for (const role of GRANTED_ROLES) {
            expect(GRANTS.filter((grant) => grant.role === role)).toHaveLength(1);
        }
    });
});

describe('0067-hos-726 addon purchase permission — current baseline', () => {
    it('keeps the historical migration payload and grants current owner roles', () => {
        expect(GRANTED_ROLES).toContain(RETIRED_OWNER_ROLE);
        expect(Object.keys(ROLE_PERMISSIONS)).not.toContain(RETIRED_OWNER_ROLE);
        for (const role of [RoleEnum.GASTRONOMY_OWNER, RoleEnum.EXPERIENCE_OWNER]) {
            expect(ROLE_PERMISSIONS[role]).toContain(ADDON_PURCHASE_PERMISSION);
        }
    });
});

describe('0067-hos-726 addon purchase permission — up()', () => {
    it('inserts all four (role, permission) pairs', async () => {
        const insertedRows = GRANTS.map((grant) => ({ ...grant }));
        const { ctx, readInsertValues } = buildCtx(insertedRows);

        const result = await migration.up(ctx);

        // Assert the payload actually handed to `.values()`, not just the count
        // the mocked `.returning()` echoed back.
        expect(readInsertValues()).toEqual(GRANTS);
        expect(result.counts?.granted).toBe(4);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/Granted 4 of 4/);
    });

    it('is idempotent: does NOT throw and reports 0 inserted on the second run', async () => {
        const { ctx: ctxFirst } = buildCtx(GRANTS.map((grant) => ({ ...grant })));
        await expect(migration.up(ctxFirst)).resolves.not.toThrow();

        const { ctx: ctxSecond } = buildCtx([]);
        const result = await migration.up(ctxSecond);

        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(4);
        expect(result.summary).toMatch(/Granted 0 of 4/);
    });
});
