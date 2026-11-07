/**
 * @fileoverview
 * Integration tests for `0135-hos1867-night-catalog-items.ts` (HOS-1867).
 *
 * AC:6:12 — the night-life catalog items exist in a live environment after
 * `db:seed:migrate` (dual-write). This file runs `up()` against the REAL
 * integration database (schema only; the global setup builds it with every
 * versioned Drizzle migration) and proves the rows land, that a second run is
 * a no-op, and that a pre-existing slug which cannot satisfy the fixture makes
 * the migration throw instead of being silently skipped.
 *
 * Every test opens a transaction, runs setup + `up()` + assertions inside it,
 * then throws a sentinel so no row survives.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as nightCatalogItems from '../../src/data-migrations/0135-hos1867-night-catalog-items.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const NIGHT_AMENITIES = ['dance_floor', 'vip_area', 'cloakroom'] as const;
const NIGHT_FEATURES = ['dj_sets', 'karaoke'] as const;

/** The `type` each amenity fixture declares, asserted on the stored row. */
const AMENITY_TYPES: Record<(typeof NIGHT_AMENITIES)[number], string> = {
    dance_floor: 'ENTERTAINMENT',
    vip_area: 'SERVICES',
    cloakroom: 'SERVICES'
};

/** Stub actor — the injected context avoids bootstrapping a super admin. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1867-night-catalog-items',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
async function buildCtx(tx: DrizzleClient): Promise<SeedMigrationCtx> {
    return buildMigrationContext({ db: tx, actor: STUB_ACTOR });
}

/** Removes any night-life row so the base state is deterministic. */
async function clearNightRows(tx: DrizzleClient): Promise<void> {
    for (const slug of NIGHT_AMENITIES) {
        await tx.execute(sql`DELETE FROM amenities WHERE slug = ${slug}`);
    }
    for (const slug of NIGHT_FEATURES) {
        await tx.execute(sql`DELETE FROM features WHERE slug = ${slug}`);
    }
}

/** Serializes a string list as a PostgreSQL array literal for a `text[]` column. */
function toPgTextArray(values: readonly string[]): string {
    return `{${values.map((value) => `"${value}"`).join(',')}}`;
}

/** Inserts an alive amenity row with the given verticals. */
async function insertAmenity(
    tx: DrizzleClient,
    slug: string,
    verticals: readonly string[]
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO amenities (slug, applicable_verticals, type, is_builtin, is_featured, display_weight)
        VALUES (${slug}, ${toPgTextArray(verticals)}::text[], 'SERVICES', false, false, 50)
    `);
}

/** Inserts a soft-deleted amenity row with the given verticals. */
async function insertSoftDeletedAmenity(
    tx: DrizzleClient,
    slug: string,
    verticals: readonly string[]
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO amenities
            (slug, applicable_verticals, type, is_builtin, is_featured, display_weight, deleted_at)
        VALUES (${slug}, ${toPgTextArray(verticals)}::text[], 'SERVICES', false, false, 50, now())
    `);
}

/**
 * Inserts an alive feature row with the given verticals and category.
 * `features.category` is NOT NULL since HOS-2058 N+1, so every row declares one.
 */
async function insertFeature(
    tx: DrizzleClient,
    slug: string,
    verticals: readonly string[],
    category: string
): Promise<void> {
    await tx.execute(sql`
        INSERT INTO features
            (slug, applicable_verticals, category, is_builtin, is_featured, display_weight)
        VALUES (${slug}, ${toPgTextArray(verticals)}::text[], ${category}::feature_category_enum, false, false, 50)
    `);
}

interface AmenityRow {
    readonly slug: string;
    readonly applicable_verticals: string[];
    readonly deleted_at: string | null;
    readonly type: string;
}

interface FeatureRow {
    readonly slug: string;
    readonly applicable_verticals: string[];
    readonly deleted_at: string | null;
    readonly lifecycle_state: string;
    readonly category: string | null;
}

/** Reads every stored row for one amenity slug. */
async function readAmenityRows(tx: DrizzleClient, slug: string): Promise<AmenityRow[]> {
    const result = await tx.execute(sql`
        SELECT slug, applicable_verticals, deleted_at, type
        FROM amenities
        WHERE slug = ${slug}
    `);
    return result.rows as unknown as AmenityRow[];
}

/** Reads every stored row for one feature slug. */
async function readFeatureRows(tx: DrizzleClient, slug: string): Promise<FeatureRow[]> {
    const result = await tx.execute(sql`
        SELECT slug, applicable_verticals, deleted_at, lifecycle_state, category
        FROM features
        WHERE slug = ${slug}
    `);
    return result.rows as unknown as FeatureRow[];
}

/** Snapshot of the two catalog tables, so a no-op run is measurable. */
async function countCatalogRows(
    tx: DrizzleClient
): Promise<{ amenities: number; features: number }> {
    const result = await tx.execute(sql`
        SELECT
            (SELECT count(*) FROM amenities)::int AS amenities,
            (SELECT count(*) FROM features)::int AS features
    `);
    return result.rows[0] as unknown as { amenities: number; features: number };
}

describe('HOS-1867: 0135-hos1867-night-catalog-items (integration)', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
            );
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('creates the five night-life items on a catalog without them', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await clearNightRows(tx);

            // Act
            const result = await nightCatalogItems.up(await buildCtx(tx));

            // Assert
            expect(result.counts).toEqual({
                amenitiesCreated: 3,
                amenitiesSkipped: 0,
                featuresCreated: 2,
                featuresSkipped: 0,
                featuresCategorized: 0
            });

            for (const slug of NIGHT_AMENITIES) {
                const rows = await readAmenityRows(tx, slug);
                expect(rows, `${slug} row count`).toHaveLength(1);
                expect(rows[0]?.deleted_at, `${slug} deleted_at`).toBeNull();
                expect(rows[0]?.applicable_verticals, `${slug} verticals`).toEqual(['venue']);
                expect(rows[0]?.type, `${slug} type`).toBe(AMENITY_TYPES[slug]);
            }

            for (const slug of NIGHT_FEATURES) {
                const rows = await readFeatureRows(tx, slug);
                expect(rows, `${slug} row count`).toHaveLength(1);
                expect(rows[0]?.deleted_at, `${slug} deleted_at`).toBeNull();
                expect(rows[0]?.applicable_verticals, `${slug} verticals`).toEqual(['venue']);
                expect(rows[0]?.lifecycle_state, `${slug} lifecycle_state`).toBe('ACTIVE');
                expect(rows[0]?.category, `${slug} category`).toBe('ACTIVITIES');
            }
        });
    });

    it('is idempotent: a second run creates nothing and skips all five', async () => {
        await withRollback(async (tx) => {
            // Arrange: first run creates the rows.
            await clearNightRows(tx);
            const ctx = await buildCtx(tx);
            await nightCatalogItems.up(ctx);
            const before = await countCatalogRows(tx);

            // Act
            const second = await nightCatalogItems.up(ctx);

            // Assert
            expect(second.counts).toEqual({
                amenitiesCreated: 0,
                amenitiesSkipped: 3,
                featuresCreated: 0,
                featuresSkipped: 2,
                featuresCategorized: 0
            });
            expect(await countCatalogRows(tx)).toEqual(before);
        });
    });

    it('skips a pre-existing item that already carries the venue vertical', async () => {
        await withRollback(async (tx) => {
            // Arrange
            await clearNightRows(tx);
            await insertAmenity(tx, 'dance_floor', ['venue']);

            // Act
            const result = await nightCatalogItems.up(await buildCtx(tx));

            // Assert: dance_floor is left alone, the other four are created.
            expect(result.counts).toEqual({
                amenitiesCreated: 2,
                amenitiesSkipped: 1,
                featuresCreated: 2,
                featuresSkipped: 0,
                featuresCategorized: 0
            });
            expect(await readAmenityRows(tx, 'dance_floor')).toHaveLength(1);
        });
    });

    it('skips a pre-existing categorized feature with nothing to categorize (HOS-2058 N+1)', async () => {
        await withRollback(async (tx) => {
            // Arrange: a usable dj_sets row. Since features.category is NOT NULL, a
            // row without a category can no longer exist, so the fill branch has
            // nothing to match.
            await clearNightRows(tx);
            await insertFeature(tx, 'dj_sets', ['venue'], 'ACTIVITIES');

            // Act
            const result = await nightCatalogItems.up(await buildCtx(tx));

            // Assert: skipped as a row, category unchanged.
            expect(result.counts).toEqual({
                amenitiesCreated: 3,
                amenitiesSkipped: 0,
                featuresCreated: 1,
                featuresSkipped: 1,
                featuresCategorized: 0
            });
            const rows = await readFeatureRows(tx, 'dj_sets');
            expect(rows).toHaveLength(1);
            expect(rows[0]?.category).toBe('ACTIVITIES');
        });
    });

    it('never overwrites a category that is already set', async () => {
        await withRollback(async (tx) => {
            // Arrange: an admin already filed karaoke under another category.
            await clearNightRows(tx);
            await insertFeature(tx, 'karaoke', ['venue'], 'AUDIENCE');

            // Act
            const result = await nightCatalogItems.up(await buildCtx(tx));

            // Assert
            expect(result.counts.featuresCategorized).toBe(0);
            const rows = await readFeatureRows(tx, 'karaoke');
            expect(rows[0]?.category).toBe('AUDIENCE');
        });
    });

    it('throws when a pre-existing feature lacks the fixture vertical', async () => {
        await withRollback(async (tx) => {
            // Arrange: a hand-created karaoke scoped to accommodations only.
            await clearNightRows(tx);
            await insertFeature(tx, 'karaoke', ['accommodation'], 'ACTIVITIES');

            // Act + Assert: it must fail loudly, not skip the slug forever.
            await expect(nightCatalogItems.up(await buildCtx(tx))).rejects.toThrow(/karaoke/);
        });
    });

    it('throws when a pre-existing amenity is soft-deleted', async () => {
        await withRollback(async (tx) => {
            // Arrange: a logically deleted vip_area already owns the UNIQUE slug.
            await clearNightRows(tx);
            await insertSoftDeletedAmenity(tx, 'vip_area', ['venue']);

            // Act + Assert
            await expect(nightCatalogItems.up(await buildCtx(tx))).rejects.toThrow(/vip_area/);
        });
    });
});
