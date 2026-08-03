/**
 * @fileoverview
 * Unit tests for the `0034-hos-372-commerce-media-to-relational` data
 * migration, using a fully mocked `ctx.db` (no real database connection).
 *
 * The contract these tests protect is the migration's idempotency: it must
 * insert nothing for a listing that already owns media rows. Getting that wrong
 * duplicates every gallery on an environment where the migration is re-run —
 * and because it only ever INSERTs, there is no self-correcting path back.
 *
 * The row SHAPE (ordering, featured flag, moderation defaults) is covered by
 * `test/commerce-media-builder.test.ts`, since both this migration and the
 * baseline seeders go through the same builder.
 *
 * @module test/data-migrations/0034-hos-372-commerce-media-to-relational
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as migration from '../../src/data-migrations/0034-hos-372-commerce-media-to-relational.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const GASTRONOMY_ID = '390a09a5-dee0-5a59-83b1-21d4a62bd0c5';
const EXPERIENCE_ID = '686b70d4-aa3f-57c6-8958-a83eca33cd69';

const PHOTO_BLOCK = {
    featuredImage: { url: 'https://cdn.example.com/featured.jpg' },
    gallery: [{ url: 'https://cdn.example.com/g1.jpg' }]
};

interface InsertCapture {
    readonly rows: unknown[];
}

/**
 * Builds a `ctx.db` mock covering the four SELECTs the migration issues, in
 * order: gastronomy listings, gastronomy media ids, experience listings,
 * experience media ids.
 *
 * @param selectBatches - Rows each successive `select()` chain resolves to.
 * @returns The mock db plus the captured inserts.
 */
function buildDbMock(selectBatches: ReadonlyArray<readonly unknown[]>): {
    db: SeedMigrationCtx['db'];
    inserts: InsertCapture[];
} {
    const inserts: InsertCapture[] = [];
    let selectCall = 0;

    const db = {
        // Listing rows are read with raw SQL so the migration keeps compiling
        // after the `media` columns leave the Drizzle schema. Each vertical
        // issues two: a column-existence probe, then the data read.
        execute: vi.fn(() => {
            const batch = selectBatches[selectCall] ?? [];
            selectCall += 1;
            return Promise.resolve({ rows: batch });
        }),
        select: vi.fn(() => {
            const batch = selectBatches[selectCall] ?? [];
            selectCall += 1;
            // The media-id queries chain `.from().where()`. A REAL promise with
            // `where` attached avoids hand-rolling a thenable — its `then` is
            // the native one, not a property we define.
            const awaitable = Promise.resolve(batch) as Promise<unknown[]> & {
                where: ReturnType<typeof vi.fn>;
            };
            awaitable.where = vi.fn(() => Promise.resolve(batch));
            return { from: vi.fn(() => awaitable) };
        }),
        insert: vi.fn(() => ({
            values: vi.fn((rows: unknown[]) => {
                inserts.push({ rows });
                return Promise.resolve();
            })
        }))
    } as unknown as SeedMigrationCtx['db'];

    return { db, inserts };
}

/** A single row from the column-existence probe: the column is present. */
const COLUMN_PRESENT = [{ exists: 1 }];

/**
 * Builds the query sequence the migration issues, in order, so tests describe
 * intent instead of counting call positions:
 *   gastronomy column probe → gastronomy rows → gastronomy media ids
 *   experience column probe → experience rows → experience media ids
 */
function sequence(input: {
    gastronomyRows?: readonly unknown[];
    gastronomyMigrated?: readonly unknown[];
    experienceRows?: readonly unknown[];
    experienceMigrated?: readonly unknown[];
}): ReadonlyArray<readonly unknown[]> {
    return [
        COLUMN_PRESENT,
        input.gastronomyRows ?? [],
        input.gastronomyMigrated ?? [],
        COLUMN_PRESENT,
        input.experienceRows ?? [],
        input.experienceMigrated ?? []
    ];
}

/** Wraps a db mock into the minimal ctx the migration reads. */
function buildCtx(selectBatches: ReadonlyArray<readonly unknown[]>) {
    const { db, inserts } = buildDbMock(selectBatches);
    const actor = { id: 'actor-1', roles: [RoleEnum.SUPER_ADMIN], permissions: [] } as Actor;
    return { ctx: { db, actor } as unknown as SeedMigrationCtx, inserts };
}

describe('0034-hos-372-commerce-media-to-relational', () => {
    it('should declare a non-destructive migration', () => {
        // It only INSERTs; the JSONB blob is left for the schema migration that
        // drops the column to remove.
        expect(migration.meta.destructive).toBe(false);
    });

    it('should insert rows for listings whose blob carries photos', async () => {
        const { ctx, inserts } = buildCtx(
            sequence({
                gastronomyRows: [{ id: GASTRONOMY_ID, media: PHOTO_BLOCK }],
                experienceRows: [{ id: EXPERIENCE_ID, media: PHOTO_BLOCK }]
            })
        );

        const result = await migration.up(ctx);

        expect(inserts).toHaveLength(2);
        expect(inserts[0]?.rows).toHaveLength(2);
        expect(inserts[1]?.rows).toHaveLength(2);
        expect(result.summary).toContain('2 photo(s) across 1 gastronomy listing(s)');
        expect(result.summary).toContain('2 photo(s) across 1 experience listing(s)');
    });

    it('should no-op on a database where the media columns are already dropped', async () => {
        // The cutover is complete there, so there is nothing left to move. An
        // empty probe result must short-circuit rather than letting the data
        // read hit a column that no longer exists.
        const { ctx, inserts } = buildCtx([[], [], [], [], [], []]);

        const result = await migration.up(ctx);

        expect(inserts).toHaveLength(0);
        expect(result.summary).toContain('0 photo(s) across 0 gastronomy listing(s)');
        expect(result.summary).toContain('0 photo(s) across 0 experience listing(s)');
    });

    it('should insert nothing when the listings already own media rows', async () => {
        // The idempotency contract: re-running must not duplicate a gallery.
        const { ctx, inserts } = buildCtx(
            sequence({
                gastronomyRows: [{ id: GASTRONOMY_ID, media: PHOTO_BLOCK }],
                gastronomyMigrated: [{ gastronomyId: GASTRONOMY_ID }],
                experienceRows: [{ id: EXPERIENCE_ID, media: PHOTO_BLOCK }],
                experienceMigrated: [{ experienceId: EXPERIENCE_ID }]
            })
        );

        const result = await migration.up(ctx);

        expect(inserts).toHaveLength(0);
        expect(result.summary).toContain('0 photo(s) across 0 gastronomy listing(s)');
    });

    it('should backfill only the listings that are still missing rows', async () => {
        // The real shape of a partially-migrated environment.
        const OTHER_ID = 'c0ffee00-0000-4000-a000-000000000001';
        const { ctx, inserts } = buildCtx(
            sequence({
                gastronomyRows: [
                    { id: GASTRONOMY_ID, media: PHOTO_BLOCK },
                    { id: OTHER_ID, media: PHOTO_BLOCK }
                ],
                gastronomyMigrated: [{ gastronomyId: GASTRONOMY_ID }]
            })
        );

        await migration.up(ctx);

        expect(inserts).toHaveLength(1);
        expect(inserts[0]?.rows).toHaveLength(2);
    });

    it('should ignore listings with no photos in the blob', async () => {
        const { ctx, inserts } = buildCtx(
            sequence({
                gastronomyRows: [
                    { id: GASTRONOMY_ID, media: null },
                    { id: 'b0000000-0000-4000-a000-000000000002', media: {} },
                    // Videos-only: they belong in the `videos` column, never in
                    // the media tables, so this must produce no rows either.
                    {
                        id: 'b0000000-0000-4000-a000-000000000003',
                        media: { videos: [{ url: 'https://youtube.com/watch?v=x' }] }
                    },
                    { id: 'b0000000-0000-4000-a000-000000000004', media: { gallery: [] } }
                ]
            })
        );

        const result = await migration.up(ctx);

        expect(inserts).toHaveLength(0);
        expect(result.summary).toContain('0 photo(s) across 0 gastronomy listing(s)');
    });
});
