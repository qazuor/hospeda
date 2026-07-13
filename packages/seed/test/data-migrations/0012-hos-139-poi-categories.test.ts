/**
 * @fileoverview
 * Unit tests for the `0012-hos-139-poi-categories` data migration (HOS-139
 * AC-4), using fully mocked `ctx.models.*` model CLASSES (no real database)
 * — the same "mock the ctx, no real DB" style as the
 * `0011-hos-138-poi-v2-model-core` test. Fixture data (the 40 category rows
 * and the 12 POI rows' legacy `type`) is loaded FOR REAL from
 * `src/data/poiCategory/*.json` / `src/data/pointOfInterest/*.json` via the
 * migration's own `loadJsonFiles` calls, so a drift between a fixture and
 * this test surfaces as a real failure instead of passing against a stale
 * copy.
 *
 * This is the deterministic core of AC-4 ("all 12 existing seeded POIs have
 * exactly one `r_poi_category` row marked `isPrimary = true`, matching §7.4's
 * mapping table") and AC-8's sync assertion for the backfill path — it runs
 * everywhere (no `HOSPEDA_TEST_DATABASE_URL` needed), unlike a real-DB
 * integration test.
 *
 * @module test/data-migrations/0012-hos-139-poi-categories
 */
import { deriveTypeFromCategorySlug, POI_TYPE_TO_CATEGORY_SLUG, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as poiCategoriesMigration from '../../src/data-migrations/0012-hos-139-poi-categories.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos139-poi-categories-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Total POI category catalog fixture count (HOS-139 spec §6.3). */
const EXPECTED_TOTAL_CATEGORIES = 40;

/** Total POI fixture count this migration backfills (HOS-113 Phase 1's frozen set). */
const EXPECTED_TOTAL_POIS = 12;

/**
 * HOS-139 spec §7.4's legacy `type` → new category `slug` mapping table,
 * hardcoded here (independent of `POI_TYPE_TO_CATEGORY_SLUG`'s own source)
 * so a future accidental edit to the mapping constant is caught by this
 * test rather than silently propagating.
 */
const EXPECTED_TYPE_TO_SLUG: Record<string, string> = {
    BEACH: 'beach',
    STADIUM: 'sports_venue',
    PARK: 'park',
    MUSEUM: 'museum',
    PLAZA: 'square',
    MONUMENT: 'monument',
    VIEWPOINT: 'viewpoint',
    NATURAL: 'natural_area',
    OTHER: 'other'
};

/** The 12 existing seeded POI slugs and their pre-HOS-139 legacy `type` (spec §5). */
const POI_SLUG_TO_LEGACY_TYPE: Record<string, string> = {
    autodromo_concepcion_del_uruguay: 'STADIUM',
    playa_banco_pelay: 'BEACH',
    palacio_san_jose: 'MUSEUM',
    basilica_inmaculada_concepcion: 'MONUMENT',
    parque_unzue: 'PARK',
    isla_del_puerto: 'NATURAL',
    plaza_francisco_ramirez: 'PLAZA',
    mirador_costanera: 'VIEWPOINT',
    complejo_termal_concordia: 'OTHER',
    balneario_itape: 'BEACH',
    parque_nacional_el_palmar: 'PARK',
    termas_de_federacion: 'OTHER'
};

interface CategoryRow {
    id: string;
    slug: string;
    nameI18n?: unknown;
}

interface PoiRow {
    id: string;
    slug: string;
    type: string;
}

interface RelationRow {
    pointOfInterestId: string;
    categoryId: string;
    isPrimary: boolean;
}

/** Mock `PoiCategoryModel`-shaped class backed by an in-memory `slug -> row` store. */
function buildCategoryModelClass(store: Map<string, CategoryRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
        async create(data: Record<string, unknown>) {
            const slug = data.slug as string;
            const row: CategoryRow = { id: `cat-${slug}`, slug, ...data };
            store.set(slug, row);
            return row;
        }
    };
}

/** Mock `PointOfInterestModel`-shaped class backed by an in-memory `slug -> row` store. */
function buildPoiModelClass(store: Map<string, PoiRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
        async update(where: { id: string }, data: Partial<PoiRow>) {
            const row = [...store.values()].find((r) => r.id === where.id);
            if (!row) return null;
            Object.assign(row, data);
            return row;
        }
    };
}

/** Mock `RPoiCategoryModel`-shaped class backed by an in-memory array of relation rows. */
function buildRelationModelClass(store: RelationRow[]) {
    return class {
        async findOne(where: { pointOfInterestId: string; categoryId: string }) {
            return (
                store.find(
                    (r) =>
                        r.pointOfInterestId === where.pointOfInterestId &&
                        r.categoryId === where.categoryId
                ) ?? null
            );
        }
        async create(data: RelationRow) {
            store.push(data);
            return data;
        }
    };
}

/** Seeds a store with the 12 POI slugs in their pre-migration state (real legacy `type`). */
function seedPoiStore(): Map<string, PoiRow> {
    return new Map(
        Object.entries(POI_SLUG_TO_LEGACY_TYPE).map(([slug, type]) => [
            slug,
            { id: `poi-${slug}`, slug, type }
        ])
    );
}

function buildCtx(
    categoryStore: Map<string, CategoryRow>,
    poiStore: Map<string, PoiRow>,
    relationStore: RelationRow[]
): SeedMigrationCtx {
    return {
        db: {},
        actor: STUB_ACTOR,
        models: {
            PoiCategoryModel: buildCategoryModelClass(categoryStore),
            PointOfInterestModel: buildPoiModelClass(poiStore),
            RPoiCategoryModel: buildRelationModelClass(relationStore)
        },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

describe('HOS-139 spec §7.4 legacy type -> category slug mapping table', () => {
    it('POI_TYPE_TO_CATEGORY_SLUG matches the spec §7.4 table exactly', () => {
        expect(POI_TYPE_TO_CATEGORY_SLUG).toEqual(EXPECTED_TYPE_TO_SLUG);
    });

    it('every mapped slug round-trips back to the SAME legacy type via deriveTypeFromCategorySlug (§7.4/§7.6 are inverses)', () => {
        for (const [legacyType, slug] of Object.entries(EXPECTED_TYPE_TO_SLUG)) {
            expect(deriveTypeFromCategorySlug(slug)).toBe(legacyType);
        }
    });
});

describe('0012-hos-139-poi-categories', () => {
    it('creates all 40 catalog categories and backfills a primary category for all 12 POIs', async () => {
        // Arrange — empty category catalog (fresh DB shape), 12 real POIs.
        const categoryStore = new Map<string, CategoryRow>();
        const poiStore = seedPoiStore();
        const relationStore: RelationRow[] = [];
        const ctx = buildCtx(categoryStore, poiStore, relationStore);

        // Act
        const result = await poiCategoriesMigration.up(ctx);

        // Assert — counts.
        expect(result.counts).toEqual({
            categoriesCreated: EXPECTED_TOTAL_CATEGORIES,
            categoriesSkipped: 0,
            relationsCreated: EXPECTED_TOTAL_POIS,
            relationsSkipped: 0,
            poisNotFound: 0,
            categoriesNotFoundForBackfill: 0,
            // §7.4 and §7.6 are inverses for these 9 overlapping concepts, so
            // the derived type always equals what the fixture already has —
            // the sync write is a no-op for every one of the 12 POIs.
            typeSynced: 0
        });

        // Assert — every relation row is marked primary (spec §6.3: "each
        // marked isPrimary = true (single row per POI...)").
        expect(relationStore).toHaveLength(EXPECTED_TOTAL_POIS);
        expect(relationStore.every((r) => r.isPrimary)).toBe(true);
    });

    it('AC-4: each of the 12 POIs maps to exactly one primary category matching spec §7.4, and the derived type equals deriveTypeFromCategorySlug(primary slug)', async () => {
        // Arrange
        const categoryStore = new Map<string, CategoryRow>();
        const poiStore = seedPoiStore();
        const relationStore: RelationRow[] = [];
        const ctx = buildCtx(categoryStore, poiStore, relationStore);

        // Act
        await poiCategoriesMigration.up(ctx);

        // Assert — "exactly one primary category per POI" (AC-4).
        const relationsByPoi = new Map<string, RelationRow[]>();
        for (const relation of relationStore) {
            const existing = relationsByPoi.get(relation.pointOfInterestId) ?? [];
            existing.push(relation);
            relationsByPoi.set(relation.pointOfInterestId, existing);
        }
        for (const poi of poiStore.values()) {
            const relations = relationsByPoi.get(poi.id) ?? [];
            expect(relations).toHaveLength(1);
            expect(relations[0]?.isPrimary).toBe(true);
        }

        // Assert — the assigned category matches spec §7.4's mapping table,
        // and the derived `type` equals deriveTypeFromCategorySlug(primary
        // slug), for EVERY one of the 12 POIs individually (not just in
        // aggregate).
        const categoryById = new Map(
            [...categoryStore.values()].map((category) => [category.id, category])
        );
        for (const poi of poiStore.values()) {
            const [relation] = relationsByPoi.get(poi.id) ?? [];
            expect(relation).toBeDefined();

            const category = relation && categoryById.get(relation.categoryId);
            expect(category).toBeDefined();

            const expectedSlug = EXPECTED_TYPE_TO_SLUG[poi.type];
            expect(category?.slug).toBe(expectedSlug);

            // The derived type from the primary category's slug must equal
            // the POI's (unchanged, since typeSynced=0) legacy type.
            expect(deriveTypeFromCategorySlug(category?.slug ?? '')).toBe(poi.type);
        }
    });

    it('is idempotent: a second run skips every category and every POI-category relation already backfilled', async () => {
        // Arrange — run once to populate categories + relations, then re-run.
        const categoryStore = new Map<string, CategoryRow>();
        const poiStore = seedPoiStore();
        const relationStore: RelationRow[] = [];
        const ctx = buildCtx(categoryStore, poiStore, relationStore);
        await poiCategoriesMigration.up(ctx);

        // Act
        const result = await poiCategoriesMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            categoriesCreated: 0,
            categoriesSkipped: EXPECTED_TOTAL_CATEGORIES,
            relationsCreated: 0,
            relationsSkipped: EXPECTED_TOTAL_POIS,
            poisNotFound: 0,
            categoriesNotFoundForBackfill: 0,
            typeSynced: 0
        });
        // No duplicate relation rows were created.
        expect(relationStore).toHaveLength(EXPECTED_TOTAL_POIS);
    });

    it('counts a POI as not-found (and backfills nothing for it) when its slug is missing from the DB', async () => {
        // Arrange — a store missing one POI, simulating a partial required-seed env.
        const categoryStore = new Map<string, CategoryRow>();
        const poiStore = seedPoiStore();
        poiStore.delete('palacio_san_jose');
        const relationStore: RelationRow[] = [];
        const ctx = buildCtx(categoryStore, poiStore, relationStore);

        // Act
        const result = await poiCategoriesMigration.up(ctx);

        // Assert
        expect(result.counts?.poisNotFound).toBe(1);
        expect(result.counts?.relationsCreated).toBe(EXPECTED_TOTAL_POIS - 1);
        expect(relationStore).toHaveLength(EXPECTED_TOTAL_POIS - 1);
    });

    it('syncs points_of_interest.type when the stored value disagrees with the derived value', async () => {
        // Arrange — the migration's category-slug lookup key
        // (`POI_TYPE_TO_CATEGORY_SLUG[rawPoi.type]`) is read from the REAL
        // fixture JSON on disk (`loadJsonFiles`), not from the mocked
        // `poiStore` — only `poi.type` (read via the mocked model's
        // `findOne`) is the corruptible "already stored" value the sync
        // compares against. Corrupting `poiStore`'s type to `OTHER` while
        // the real fixture's legacy type stays `BEACH` simulates a POI whose
        // stored `type` has drifted out of sync with its primary category:
        // the backfill still resolves the "beach" category (from the real
        // fixture), derives `BEACH` from it, sees the stored `OTHER`
        // disagrees, and corrects it.
        const categoryStore = new Map<string, CategoryRow>();
        const poiStore = seedPoiStore();
        const corrupted = poiStore.get('playa_banco_pelay');
        if (corrupted) corrupted.type = 'OTHER'; // real fixture legacy type is BEACH
        const relationStore: RelationRow[] = [];
        const ctx = buildCtx(categoryStore, poiStore, relationStore);

        // Act
        const result = await poiCategoriesMigration.up(ctx);

        // Assert — exactly 1 type-sync write, correcting the stored value to
        // the derived one (BEACH, from the "beach" category).
        expect(result.counts?.typeSynced).toBe(1);
        expect(poiStore.get('playa_banco_pelay')?.type).toBe('BEACH');
    });
});
