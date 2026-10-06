/**
 * @fileoverview
 * Unit tests for the `0062-hos686-commerce-listing-moderation-permission` data
 * migration, using a mocked insert chain — no real database connection. Same
 * style as `0048-hos376-host-trade-usage-review-permissions.test.ts`.
 *
 * @module test/data-migrations/0062-hos686-commerce-listing-moderation-permission
 */
import { RoleEnum } from '@repo/schemas';
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

describe('0062-hos686 commerce listing moderation — retired by HOS-1417', () => {
    it('grants nothing: commerce.moderationChange was retired by migration 0126', () => {
        expect(STAFF_PERMISSIONS).toEqual([]);
        expect(GRANTS).toEqual([]);
    });

    it('still targets only SUPER_ADMIN and ADMIN', () => {
        expect([...GRANTED_ROLES].sort()).toEqual([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN].sort());
    });

    it('the seed baseline does not grant the retired permission either', () => {
        for (const perms of Object.values(ROLE_PERMISSIONS)) {
            expect(perms).not.toContain('commerce.moderationChange');
        }
    });
});

describe('0062-hos686 commerce listing moderation — up()', () => {
    it('is a no-op that never touches the database', async () => {
        const { ctx, readInsertValues } = buildCtx([]);

        const result = await migration.up(ctx);

        expect(readInsertValues()).toEqual([]);
        expect(result.counts?.granted).toBe(0);
        expect(result.counts?.alreadyPresent).toBe(0);
        expect(result.summary).toMatch(/No-op/);
    });

    it('is idempotent across runs', async () => {
        const { ctx: first } = buildCtx([]);
        const { ctx: second } = buildCtx([]);

        await expect(migration.up(first)).resolves.toBeDefined();
        const result = await migration.up(second);

        expect(result.counts?.granted).toBe(0);
    });
});
