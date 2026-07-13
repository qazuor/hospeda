/**
 * @fileoverview
 * Unit tests for the `0010-remove-panel-admin-from-host-commerce-owner` data
 * migration, using a fully mocked `ctx.models.RRolePermissionModel` class (no
 * real database connection) — the same "mock the ctx, no real DB" style
 * `0007-remove-legacy-make-webhook-url-setting.test.ts` and
 * `0009-hos-113-points-of-interest.test.ts` use.
 *
 * The migration constructs exactly ONE `RRolePermissionModel` instance and
 * calls `.hardDelete({ role, permission }, ctx.db)` on it once per targeted
 * role (HOST, COMMERCE_OWNER), so this test spies on a single shared
 * `hardDelete` mock across both calls rather than building a per-instance
 * store.
 *
 * @module test/data-migrations/0010-remove-panel-admin-from-host-commerce-owner
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as removePanelAdminMigration from '../../src/data-migrations/0010-remove-panel-admin-from-host-commerce-owner.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos135-remove-panel-admin-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Fake `DrizzleClient` handle forwarded through as the `tx` argument. */
const FAKE_DB = {} as SeedMigrationCtx['db'];

/**
 * Builds a fully mocked `SeedMigrationCtx` whose `ctx.models.RRolePermissionModel`
 * is a class with a single shared `hardDelete` mock (so both `up()` calls —
 * one per role — are visible on the same spy), resolving `deletedCount` for
 * every call.
 */
function buildCtx(deletedCount: number): {
    ctx: SeedMigrationCtx;
    hardDelete: ReturnType<typeof vi.fn>;
} {
    const hardDelete = vi.fn().mockResolvedValue(deletedCount);

    class MockRRolePermissionModel {
        hardDelete = hardDelete;
    }

    const ctx = {
        db: FAKE_DB,
        actor: STUB_ACTOR,
        models: { RRolePermissionModel: MockRRolePermissionModel },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, hardDelete };
}

describe('0010-remove-panel-admin-from-host-commerce-owner', () => {
    it('exports the expected destructive/required meta shape', () => {
        expect(removePanelAdminMigration.meta).toEqual({
            name: '0010-remove-panel-admin-from-host-commerce-owner',
            group: 'required',
            destructive: true
        });
    });

    it('calls RRolePermissionModel.hardDelete exactly twice, once per role, with ACCESS_PANEL_ADMIN', async () => {
        // Arrange — first run against an environment that still has the bad grant.
        const { ctx, hardDelete } = buildCtx(1);

        // Act
        const result = await removePanelAdminMigration.up(ctx);

        // Assert
        expect(hardDelete).toHaveBeenCalledTimes(2);
        expect(hardDelete).toHaveBeenNthCalledWith(
            1,
            { role: RoleEnum.HOST, permission: PermissionEnum.ACCESS_PANEL_ADMIN },
            FAKE_DB
        );
        expect(hardDelete).toHaveBeenNthCalledWith(
            2,
            { role: RoleEnum.COMMERCE_OWNER, permission: PermissionEnum.ACCESS_PANEL_ADMIN },
            FAKE_DB
        );
        expect(result.counts).toEqual({
            [`${RoleEnum.HOST}-deleted`]: 1,
            [`${RoleEnum.COMMERCE_OWNER}-deleted`]: 1
        });
        expect(result.summary).toMatch(/Removed ACCESS_PANEL_ADMIN/);
    });

    it('is idempotent: does NOT throw and reports zero deletions when hardDelete matches no rows', async () => {
        // Arrange — second run (or a DB that never had the bad grant): hardDelete
        // matches zero rows and resolves 0, exactly like a real composite-PK delete
        // on an already-absent row.
        const { ctx, hardDelete } = buildCtx(0);

        // Act — must resolve without throwing (a safe no-op re-run).
        await expect(removePanelAdminMigration.up(ctx)).resolves.not.toThrow();
        const result = await removePanelAdminMigration.up(ctx);

        // Assert
        expect(hardDelete).toHaveBeenCalledTimes(4); // 2 calls x 2 up() invocations above
        expect(result.counts).toEqual({
            [`${RoleEnum.HOST}-deleted`]: 0,
            [`${RoleEnum.COMMERCE_OWNER}-deleted`]: 0
        });
        expect(result.summary).toMatch(/already absent \(idempotent no-op\)/);
    });
});
