/**
 * @fileoverview
 * Unit tests for the `0065-hos-692-purge-orphaned-commerce-fixtures` data
 * migration, using a mocked query chain — no real database connection.
 *
 * @module test/data-migrations/0065-hos-692-purge-orphaned-commerce-fixtures
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0065-hos-692-purge-orphaned-commerce-fixtures.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    readonly deletedIds: () => readonly string[];
}

function buildFakeDb(candidateIds: readonly string[]): FakeDbProbe {
    const deletedIds: string[] = [];

    const db = {
        select: () => ({
            from: () => ({
                where: (_predicate: unknown) => Promise.resolve(candidateIds.map((id) => ({ id })))
            })
        }),
        delete: () => ({
            where: (_predicate: unknown) => {
                // The migration deletes one-by-one in a loop, so this fires
                // once per candidate — record in call order.
                deletedIds.push(candidateIds[deletedIds.length] as string);
                return Promise.resolve(undefined);
            }
        })
    } as unknown as SeedMigrationCtx['db'];

    return { db, deletedIds: () => deletedIds };
}

function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

describe('0065-hos-692-purge-orphaned-commerce-fixtures', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    it('is declared destructive and required', () => {
        expect(migration.meta.destructive).toBe(true);
        expect(migration.meta.group).toBe('required');
    });

    it('is a no-op outside production', async () => {
        process.env.NODE_ENV = 'development';
        const probe = buildFakeDb(['sub-1', 'sub-2', 'sub-3']);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.deletedIds()).toHaveLength(0);
        expect(result.summary).toContain('Skipped');
    });

    it('deletes exactly the 3 orphaned subscriptions in production', async () => {
        const probe = buildFakeDb(['sub-1', 'sub-2', 'sub-3']);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.deletedIds()).toEqual(['sub-1', 'sub-2', 'sub-3']);
        expect(result.counts?.subscriptionsDeleted).toBe(3);
    });

    it('refuses to delete anything when the count does NOT match the expected 3 — never guesses', async () => {
        const probe = buildFakeDb(['sub-1', 'sub-2', 'sub-3', 'sub-4']); // a real 4th commerce sub

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.deletedIds()).toHaveLength(0);
        expect(result.counts?.subscriptionsDeleted).toBe(0);
        expect(result.summary).toContain('Refusing to delete');
    });

    it('is idempotent — a second run with zero matches is a clean no-op, not a refusal', async () => {
        const probe = buildFakeDb([]);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.deletedIds()).toHaveLength(0);
        expect(result.counts?.subscriptionsDeleted).toBe(0);
        expect(result.summary).not.toContain('Refusing to delete');
        expect(result.summary).toContain('nothing to purge');
    });
});
