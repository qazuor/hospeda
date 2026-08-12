/**
 * @fileoverview
 * Unit tests for the `0054-hos374-editorial-trusted-editor` data migration,
 * using a mocked query chain — no real database connection. Same style as
 * `0048-hos376-host-trade-usage-review-permissions.test.ts`.
 *
 * @module test/data-migrations/0054-hos374-editorial-trusted-editor
 */
import { RoleEnum, TRUSTED_EDITOR_PERMISSIONS } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0054-hos374-editorial-trusted-editor.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos374-trusted-editor-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

const EDITORIAL_ID = '11111111-2222-3333-4444-555555555555';

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** Rows handed to `.values()`, or `null` when `insert` was never reached. */
    readInsertValues: () => readonly Record<string, unknown>[] | null;
    /** Argument handed to `.onConflictDoUpdate()`, or `null`. */
    readConflictArg: () => Record<string, unknown> | null;
}

/**
 * Builds a fake `ctx.db` covering the two chains the migration uses.
 *
 * @param selectResult - What the user lookup returns: `[]` for an environment
 *   without the editorial account, or a one-row array with its id.
 */
function buildFakeDb(selectResult: readonly { id: string }[]): FakeDbProbe {
    let insertValues: readonly Record<string, unknown>[] | null = null;
    let conflictArg: Record<string, unknown> | null = null;

    const db = {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: () => Promise.resolve(selectResult)
                })
            })
        }),
        insert: () => ({
            values: (rows: readonly Record<string, unknown>[]) => {
                insertValues = rows;
                return {
                    onConflictDoUpdate: (arg: Record<string, unknown>) => {
                        conflictArg = arg;
                        return Promise.resolve(undefined);
                    }
                };
            }
        })
    } as unknown as SeedMigrationCtx['db'];

    return {
        db,
        readInsertValues: () => insertValues,
        readConflictArg: () => conflictArg
    };
}

function buildCtx(selectResult: readonly { id: string }[]): {
    ctx: SeedMigrationCtx;
    probe: FakeDbProbe;
} {
    const probe = buildFakeDb(selectResult);

    const ctx = {
        db: probe.db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, probe };
}

describe('0054-hos374 trusted editor — meta', () => {
    it('exports the expected required/additive meta shape', () => {
        expect(migration.meta).toEqual({
            name: '0054-hos374-editorial-trusted-editor',
            group: 'required',
            destructive: false
        });
    });
});

describe('0054-hos374 trusted editor — up()', () => {
    it('grants exactly the TRUSTED_EDITOR_PERMISSIONS bundle to the resolved user', async () => {
        const { ctx, probe } = buildCtx([{ id: EDITORIAL_ID }]);

        const result = await migration.up(ctx);

        // Asserts the payload actually handed to `.values()`. Deriving the
        // expectation from the tuple (rather than restating four literals) is
        // what makes a fifth permission joining the bundle fail here instead of
        // silently shipping a half-promoted account.
        expect(probe.readInsertValues()).toEqual(
            TRUSTED_EDITOR_PERMISSIONS.map((permission) => ({
                userId: EDITORIAL_ID,
                permission,
                effect: 'grant'
            }))
        );
        expect(result.counts?.granted).toBe(TRUSTED_EDITOR_PERMISSIONS.length);
    });

    it('upgrades a pre-existing row to grant instead of skipping it', async () => {
        // `onConflictDoNothing` would leave a stale `deny` in place for one of
        // the four and leave the account in exactly the partial state the
        // bundle's atomicity exists to prevent.
        const { ctx, probe } = buildCtx([{ id: EDITORIAL_ID }]);

        await migration.up(ctx);

        expect(probe.readConflictArg()?.set).toEqual({ effect: 'grant' });
    });

    it('is a no-op when the editorial account is absent from the environment', async () => {
        const { ctx, probe } = buildCtx([]);

        const result = await migration.up(ctx);

        expect(probe.readInsertValues()).toBeNull();
        expect(result.counts?.granted).toBe(0);
        expect(result.summary).toMatch(/absent from this environment/);
    });
});
