/**
 * Integration tests: HOS-139 AC-1 — `r_poi_category_primary_idx` runtime
 * rejection (partial unique index enforcing "at most one primary category
 * per POI").
 *
 * The structural properties of the index (name, columns, WHERE predicate)
 * are already covered by the in-process schema test
 * `test/schemas/destination/r_poi_category.dbschema.test.ts` — that suite
 * inspects Drizzle metadata only and never touches a real database, so it
 * cannot prove the index actually rejects a violating INSERT at the
 * PostgreSQL level. This suite closes that gap against a real DB.
 *
 * Mirrors the harness from `promo-code-effect-migration.integration.test.ts`:
 * same imports, same connection helper (`getTestDb`/`setDb`/`closeTestPool`),
 * same `withCleanSlate` + `it.skipIf(!DB_AVAILABLE)` pattern. Runs via:
 *   pnpm --filter @repo/db test:integration
 * (requires a running test PostgreSQL — see packages/db/CLAUDE.md). When
 * `HOSPEDA_TEST_DATABASE_URL` is absent (e.g. a plain local `pnpm test`
 * invocation), every test in this file is skipped with a clear message.
 *
 * Reference: HOS-139 spec.md §6.2, §9 AC-1.
 *
 * @module test/integration/poi-category-primary-unique
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { poiCategories, pointsOfInterest, rPoiCategory } from '../../src/schemas/index.ts';
import { closeTestPool, getTestDb, withCleanSlate } from './helpers.ts';

// ---------------------------------------------------------------------------
// DB availability guard (matches jsonb-merge.test.ts / promo-code-effect
// suite's pattern). The globalSetup injects HOSPEDA_TEST_DATABASE_URL when
// invoked via `pnpm --filter @repo/db test:integration`.
// ---------------------------------------------------------------------------
const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

// ---------------------------------------------------------------------------
// Minimal fixture factories — smallest payload satisfying each table's NOT
// NULL columns (mirrors `test/integration/helpers.ts`'s `testData` shape,
// kept local since `points_of_interest`/`poi_categories` have no shared
// factory yet).
// ---------------------------------------------------------------------------

/** Minimal valid `points_of_interest` row (slug + type are the only required, no-default columns). */
function poiFixture(
    overrides: Partial<typeof pointsOfInterest.$inferInsert> = {}
): typeof pointsOfInterest.$inferInsert {
    return {
        id: crypto.randomUUID(),
        slug: `test-poi-${crypto.randomUUID().slice(0, 8)}`,
        type: 'OTHER' as const,
        ...overrides
    } satisfies typeof pointsOfInterest.$inferInsert;
}

/** Minimal valid `poi_categories` row (slug + nameI18n are the only required, no-default columns). */
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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('r_poi_category_primary_idx — HOS-139 AC-1 runtime rejection', () => {
    /**
     * AC-1 — a second `isPrimary = true` row for the SAME POI (a different
     * category, to avoid colliding with the composite PK on
     * `(pointOfInterestId, categoryId)`) is rejected by the partial unique
     * index at the database level.
     */
    it.skipIf(!DB_AVAILABLE)(
        'rejects a second isPrimary=true row for the same POI (different category)',
        async () => {
            await withCleanSlate(async (db) => {
                // Arrange — one POI, two distinct categories.
                const poi = poiFixture();
                const categoryA = categoryFixture({ slug: 'primary-idx-category-a' });
                const categoryB = categoryFixture({ slug: 'primary-idx-category-b' });
                await db.insert(pointsOfInterest).values(poi);
                await db.insert(poiCategories).values([categoryA, categoryB]);

                // Act — first isPrimary=true row succeeds.
                await db.insert(rPoiCategory).values({
                    pointOfInterestId: poi.id,
                    categoryId: categoryA.id,
                    isPrimary: true
                });

                // Assert — a second isPrimary=true row for the same POI, a
                // different category (so the composite PK does not also
                // reject it), is rejected by `r_poi_category_primary_idx`.
                await expect(
                    db.insert(rPoiCategory).values({
                        pointOfInterestId: poi.id,
                        categoryId: categoryB.id,
                        isPrimary: true
                    })
                ).rejects.toThrow();
            });
        }
    );

    /**
     * Happy-path sanity: a POI may have several non-primary category rows
     * alongside its one primary — the index only restricts `isPrimary =
     * true` rows, so this must NOT throw (confirms the index is not
     * overly restrictive).
     */
    it.skipIf(!DB_AVAILABLE)(
        'happy path: one primary + several non-primary categories for the same POI is accepted',
        async () => {
            await withCleanSlate(async (db) => {
                const poi = poiFixture();
                const categoryPrimary = categoryFixture({ slug: 'primary-idx-category-primary' });
                const categorySecondary = categoryFixture({
                    slug: 'primary-idx-category-secondary'
                });
                await db.insert(pointsOfInterest).values(poi);
                await db.insert(poiCategories).values([categoryPrimary, categorySecondary]);

                await db.insert(rPoiCategory).values({
                    pointOfInterestId: poi.id,
                    categoryId: categoryPrimary.id,
                    isPrimary: true
                });

                // Should NOT throw — isPrimary defaults to false.
                await db.insert(rPoiCategory).values({
                    pointOfInterestId: poi.id,
                    categoryId: categorySecondary.id
                });

                const rows = await db.query.rPoiCategory.findMany({
                    where: (fields, { eq }) => eq(fields.pointOfInterestId, poi.id)
                });
                expect(rows).toHaveLength(2);
                expect(rows.filter((r) => r.isPrimary)).toHaveLength(1);
            });
        }
    );

    /**
     * Cross-POI isolation: two DIFFERENT POIs may each independently have
     * their own `isPrimary = true` row — the partial unique index is scoped
     * per `pointOfInterestId`, not global.
     */
    it.skipIf(!DB_AVAILABLE)(
        'two different POIs may each have their own isPrimary=true row',
        async () => {
            await withCleanSlate(async (db) => {
                const poiA = poiFixture();
                const poiB = poiFixture();
                const category = categoryFixture({ slug: 'primary-idx-category-shared' });
                await db.insert(pointsOfInterest).values([poiA, poiB]);
                await db.insert(poiCategories).values(category);

                await db.insert(rPoiCategory).values({
                    pointOfInterestId: poiA.id,
                    categoryId: category.id,
                    isPrimary: true
                });

                // Should NOT throw — different POI, same category, both primary.
                await db.insert(rPoiCategory).values({
                    pointOfInterestId: poiB.id,
                    categoryId: category.id,
                    isPrimary: true
                });

                const rows = await db.query.rPoiCategory.findMany({
                    where: (fields, { eq }) => eq(fields.categoryId, category.id)
                });
                expect(rows).toHaveLength(2);
                expect(rows.every((r) => r.isPrimary)).toBe(true);
            });
        }
    );
});
