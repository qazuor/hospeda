/**
 * Integration tests: HOS-147 T-005 — `DestinationModel.getPointsOfInterestMap`
 * aggregates the FULL set of a POI's categories via a correlated `json_agg`
 * subquery.
 *
 * The unit suite (`test/models/destination.model.test.ts`) mocks the DB client
 * and can only prove the mapper passes a `categories` array through — it cannot
 * prove the raw SQL subquery (hand-written column names, COALESCE, the
 * ACTIVE/non-deleted gate, correlation to the outer POI) actually returns the
 * right rows at the PostgreSQL level. This suite closes that gap against a real
 * DB, mirroring the harness from `poi-category-primary-unique.integration.test.ts`.
 *
 * Runs via `pnpm --filter @repo/db test:integration` (requires a running test
 * PostgreSQL — see packages/db/CLAUDE.md). Skipped when
 * `HOSPEDA_TEST_DATABASE_URL` is absent (plain `pnpm test`).
 *
 * Reference: HOS-147 spec.md §6 (API), §9 AC-2, R-1.
 *
 * @module test/integration/destination-poi-categories
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { DestinationModel } from '../../src/models/destination/destination.model.ts';
import {
    destinations,
    poiCategories,
    pointsOfInterest,
    rDestinationPointOfInterest,
    rPoiCategory
} from '../../src/schemas/index.ts';
import { closeTestPool, getTestDb, testData, withCleanSlate } from './helpers.ts';

const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

function poiFixture(
    overrides: Partial<typeof pointsOfInterest.$inferInsert> = {}
): typeof pointsOfInterest.$inferInsert {
    return {
        id: crypto.randomUUID(),
        slug: `test-poi-${crypto.randomUUID().slice(0, 8)}`,
        type: 'OTHER' as const,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof pointsOfInterest.$inferInsert;
}

function categoryFixture(
    overrides: Partial<typeof poiCategories.$inferInsert> = {}
): typeof poiCategories.$inferInsert {
    return {
        id: crypto.randomUUID(),
        slug: `test-category-${crypto.randomUUID().slice(0, 8)}`,
        nameI18n: { es: 'Categoría de prueba' },
        ...overrides
    } satisfies typeof poiCategories.$inferInsert;
}

beforeAll(() => {
    if (DB_AVAILABLE) {
        setDb(getTestDb());
    }
});

afterAll(async () => {
    if (DB_AVAILABLE) {
        await closeTestPool();
    }
});

describe('DestinationModel.getPointsOfInterestMap — categories[] aggregation (HOS-147)', () => {
    const model = new DestinationModel();

    it.skipIf(!DB_AVAILABLE)(
        "aggregates ALL of a POI's active categories (not just the primary), ordered by displayWeight then slug",
        async () => {
            await withCleanSlate(async (db) => {
                // Arrange — one destination, one POI (PRIMARY relation) with
                // three category rows: two ACTIVE (one primary), one on a
                // soft-deleted category that must be excluded.
                const dest = testData.destination();
                const poi = poiFixture({ slug: 'poi-multi-cat' });
                const catTermas = categoryFixture({ slug: 'termas', displayWeight: 10 });
                const catGastronomia = categoryFixture({ slug: 'gastronomia', displayWeight: 20 });
                const catDeleted = categoryFixture({
                    slug: 'deleted-cat',
                    deletedAt: new Date()
                });

                await db.insert(destinations).values(dest);
                await db.insert(pointsOfInterest).values(poi);
                await db.insert(poiCategories).values([catTermas, catGastronomia, catDeleted]);
                await db.insert(rDestinationPointOfInterest).values({
                    destinationId: dest.id,
                    pointOfInterestId: poi.id,
                    relation: 'PRIMARY'
                });
                await db.insert(rPoiCategory).values([
                    { pointOfInterestId: poi.id, categoryId: catTermas.id, isPrimary: true },
                    { pointOfInterestId: poi.id, categoryId: catGastronomia.id, isPrimary: false },
                    { pointOfInterestId: poi.id, categoryId: catDeleted.id, isPrimary: false }
                ]);

                // Act
                const map = await model.getPointsOfInterestMap([dest.id], undefined, 'ALL');

                // Assert — both active categories, ordered by displayWeight
                // (termas=10 before gastronomia=20); the soft-deleted category
                // excluded; primaryCategory still resolves to the primary.
                const entry = map.get(dest.id)?.[0];
                expect(entry?.categories).toEqual([{ slug: 'termas' }, { slug: 'gastronomia' }]);
                expect(entry?.primaryCategory?.slug).toBe('termas');
            });
        }
    );

    it.skipIf(!DB_AVAILABLE)(
        'returns an empty categories[] for a POI with no category rows',
        async () => {
            await withCleanSlate(async (db) => {
                const dest = testData.destination();
                const poi = poiFixture({ slug: 'poi-no-cat' });
                await db.insert(destinations).values(dest);
                await db.insert(pointsOfInterest).values(poi);
                await db.insert(rDestinationPointOfInterest).values({
                    destinationId: dest.id,
                    pointOfInterestId: poi.id,
                    relation: 'PRIMARY'
                });

                const map = await model.getPointsOfInterestMap([dest.id], undefined, 'ALL');

                const entry = map.get(dest.id)?.[0];
                expect(entry?.categories).toEqual([]);
                expect(entry?.primaryCategory).toBeNull();
            });
        }
    );
});
