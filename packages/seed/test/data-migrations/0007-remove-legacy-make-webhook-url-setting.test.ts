/**
 * @fileoverview
 * Unit tests for the `0007-remove-legacy-make-webhook-url-setting` data
 * migration's vault-credential safety guard, using a fully mocked
 * `SeedMigrationCtx` (no real database connection).
 *
 * Unlike the other data-migration tests in this suite (which run against the
 * real worktree PostgreSQL database inside a rolled-back transaction — see
 * `owner-test-daily-trial.integration.test.ts`), this migration's guard logic
 * is a single guarded SELECT + a call to `ctx.helpers.safeDelete`, both of
 * which are cheap to mock directly. Mocking keeps the test fast and DB-free
 * while still exercising the exact branch the migration's JSDoc documents as
 * its safety contract:
 *
 * - An ACTIVE `make_webhook_url` vault credential exists  -> `safeDelete` IS
 *   called against the legacy `social_settings` row.
 * - No active vault credential exists (not yet migrated)  -> `safeDelete` is
 *   NEVER called, and the result reports the row as skipped.
 *
 * @module test/data-migrations/0007-remove-legacy-make-webhook-url-setting
 */
import { socialSettings } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as removeLegacySetting from '../../src/data-migrations/0007-remove-legacy-make-webhook-url-setting.js';
import type { SafeDeleteResult, SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos64-legacy-setting-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * Builds a mocked `ctx.db` whose `.select().from().where().limit()` chain
 * resolves to `rows` — enough to satisfy the migration's single guarded
 * SELECT against `social_credentials`.
 */
function buildDbMock(rows: readonly unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    return { select } as unknown as SeedMigrationCtx['db'];
}

/**
 * Builds a fully mocked `SeedMigrationCtx`. `models`/`services` are stubbed
 * as empty objects since this migration never touches them.
 */
function buildCtx(args: {
    readonly vaultCredentialRows: readonly unknown[];
    readonly safeDeleteResult?: SafeDeleteResult;
}): { ctx: SeedMigrationCtx; safeDelete: ReturnType<typeof vi.fn> } {
    const safeDelete = vi.fn().mockResolvedValue(args.safeDeleteResult ?? { deleted: true });

    const ctx = {
        db: buildDbMock(args.vaultCredentialRows),
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: { safeDelete }
    } as unknown as SeedMigrationCtx;

    return { ctx, safeDelete };
}

describe('0007-remove-legacy-make-webhook-url-setting', () => {
    it('calls ctx.helpers.safeDelete against the legacy social_settings row when an active vault credential exists', async () => {
        // Arrange — the guard SELECT finds one active make_webhook_url vault credential.
        const { ctx, safeDelete } = buildCtx({
            vaultCredentialRows: [{ id: 'cred-uuid' }],
            safeDeleteResult: { deleted: true }
        });

        // Act
        const result = await removeLegacySetting.up(ctx);

        // Assert
        expect(safeDelete).toHaveBeenCalledTimes(1);
        const callArg = safeDelete.mock.calls[0]?.[0] as {
            table: unknown;
            where: unknown;
            reason: string;
        };
        expect(getTableName(callArg.table as Parameters<typeof getTableName>[0])).toBe(
            getTableName(socialSettings)
        );
        expect(callArg.where).toBeDefined();
        expect(callArg.reason).toMatch(/make_webhook_url/);
        expect(result.counts).toEqual({ deleted: 1 });
    });

    it('does NOT call ctx.helpers.safeDelete and reports skipped when no active vault credential exists', async () => {
        // Arrange — the guard SELECT finds zero rows (environment not yet migrated to the vault).
        const { ctx, safeDelete } = buildCtx({ vaultCredentialRows: [] });

        // Act
        const result = await removeLegacySetting.up(ctx);

        // Assert
        expect(safeDelete).not.toHaveBeenCalled();
        expect(result.counts).toEqual({ deleted: 0, skipped: 1 });
        expect(result.summary).toMatch(/Skipped/);
    });

    it('reports the safeDelete skip reason when safeDelete itself withholds the delete (e.g. active FK)', async () => {
        // Arrange — vault credential exists, but safeDelete's own guard (FK reference
        // or operator-edit detection) withholds the physical DELETE.
        const { ctx, safeDelete } = buildCtx({
            vaultCredentialRows: [{ id: 'cred-uuid' }],
            safeDeleteResult: {
                deleted: false,
                skipped: true,
                reason: 'active FK reference'
            }
        });

        // Act
        const result = await removeLegacySetting.up(ctx);

        // Assert
        expect(safeDelete).toHaveBeenCalledTimes(1);
        expect(result.counts).toEqual({ deleted: 0, skipped: 1 });
        expect(result.summary).toMatch(/active FK reference/);
    });
});
