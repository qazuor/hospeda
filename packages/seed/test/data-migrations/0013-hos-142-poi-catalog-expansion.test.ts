/**
 * @fileoverview
 * Unit tests for the `0013-hos-142-poi-catalog-expansion` data migration
 * (HOS-142 AC-2/AC-3), using fully mocked `ctx.models.*` model CLASSES (no
 * real database connection) — the same "mock the ctx, no real DB" style
 * `0009-hos-113-points-of-interest.test.ts` / `0012-hos-139-poi-categories.test.ts`
 * use.
 *
 * Fixture data (830 catalog POIs under `src/data/pointOfInterest/013-*.json`
 * through `926-*.json` as of the `0018-poi-curation-safe-subset` cleanup —
 * originally 908, minus 78 non-geolocatable POIs removed by that later pass
 * — and the destination-relations pipeline output under
 * `scripts/poi-pipeline/output/destination-relations.json`) is loaded FOR
 * REAL by the migration's own `loadJsonFiles`/`fs.readFile` calls, so a drift
 * between this test's expectations and the actual data surfaces as a real
 * failure instead of passing against a stale hand-copied fixture.
 *
 * @module test/data-migrations/0013-hos-142-poi-catalog-expansion
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as poiCatalogMigration from '../../src/data-migrations/0013-hos-142-poi-catalog-expansion.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos142-poi-catalog-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * Total POI catalog fixture count this migration inserts (HOS-142 G-1/AC-1).
 * Originally 908; `0018-poi-curation-safe-subset` removed 78 non-geolocatable
 * rows (events, gas stations, fixed-location-less circuits), leaving 830 —
 * this test reads the REAL manifest, so it reflects that later cleanup too.
 */
const EXPECTED_TOTAL_POIS = 830;

/**
 * Total destination-POI relation rows in `destination-relations.json`
 * (originally 914 PRIMARY + 646 NEARBY = 1560; `0018-poi-curation-safe-subset`
 * removed the 174 rows referencing one of the 78 deleted POIs, leaving
 * 836 PRIMARY + 550 NEARBY = 1386).
 */
const EXPECTED_TOTAL_RELATION_ENTRIES = 1386;

/**
 * The 4 relation entries that collide with a pair `0009` already created
 * (Colón/Concordia/Federación/Caseros' `pointOfInterestIds` backfill): 3
 * agree with the pipeline's `relation` value (pure no-op skip), 1 disagrees
 * (`colon`/`parque_nacional_el_palmar`, existing `PRIMARY` vs. the pipeline's
 * `NEARBY` — see the migration's own "Known conflict" JSDoc).
 */
const EXPECTED_PRE_EXISTING_MATCHING_PAIRS = 3;
const EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS = 1;
const EXPECTED_NEW_RELATIONS =
    EXPECTED_TOTAL_RELATION_ENTRIES -
    EXPECTED_PRE_EXISTING_MATCHING_PAIRS -
    EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS;

/**
 * Sum of every catalog fixture's `categories[]` array length (HOS-139/HOS-142).
 * Originally 3206 across 908 fixtures; 2907 across the 830 remaining after
 * `0018-poi-curation-safe-subset` removed 78 fixtures.
 */
const EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS = 2907;

/** The 12 original HOS-113 POI slugs, already seeded before this migration runs. */
const ORIGINAL_POI_SLUGS = [
    'autodromo_concepcion_del_uruguay',
    'playa_banco_pelay',
    'palacio_san_jose',
    'basilica_inmaculada_concepcion',
    'parque_unzue',
    'isla_del_puerto',
    'plaza_francisco_ramirez',
    'mirador_costanera',
    'complejo_termal_concordia',
    'balneario_itape',
    'parque_nacional_el_palmar',
    'termas_de_federacion'
] as const;

/** All 22 destination slugs `destination-relations.json` references. */
const ALL_DESTINATION_SLUGS = [
    'caseros',
    'ceibas',
    'chajari',
    'colon',
    'concepcion-del-uruguay',
    'concordia',
    'federacion',
    'gualeguay',
    'gualeguaychu',
    'ibicuy',
    'larroque',
    'liebig',
    'paranacito',
    'rosario-del-tala',
    'san-jose',
    'san-justo',
    'san-salvador',
    'santa-ana',
    'ubajay',
    'urdinarrain',
    'villa-elisa',
    'villaguay'
] as const;

/**
 * The 13 destination-POI pairs `0009-hos-113-points-of-interest.ts` already
 * created (implicit `relation: PRIMARY`, pre-HOS-140), verified against the
 * real 6 destination fixtures' `pointOfInterestIds` arrays at authoring time.
 */
const PRE_EXISTING_PRIMARY_PAIRS: ReadonlyArray<{ destinationSlug: string; poiSlug: string }> = [
    { destinationSlug: 'colon', poiSlug: 'balneario_itape' },
    { destinationSlug: 'colon', poiSlug: 'parque_nacional_el_palmar' },
    { destinationSlug: 'concordia', poiSlug: 'complejo_termal_concordia' },
    { destinationSlug: 'federacion', poiSlug: 'termas_de_federacion' },
    { destinationSlug: 'liebig', poiSlug: 'playa_banco_pelay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'autodromo_concepcion_del_uruguay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'playa_banco_pelay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'basilica_inmaculada_concepcion' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'parque_unzue' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'isla_del_puerto' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'plaza_francisco_ramirez' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'mirador_costanera' },
    { destinationSlug: 'caseros', poiSlug: 'palacio_san_jose' }
];

/** The 40 real POI category slugs (HOS-139 catalog), matching `src/data/poiCategory/*.json`. */
const POI_CATEGORY_SLUGS = [
    'historic_site',
    'recreation',
    'tourist_route',
    'natural_area',
    'education',
    'cultural_center',
    'services',
    'park',
    'waterfront',
    'sports_venue',
    'architecture',
    'community_center',
    'family',
    'monument',
    'entertainment',
    'industrial_heritage',
    'museum',
    'fair',
    'transport',
    'birdwatching',
    'gastronomy',
    'square',
    'religious_site',
    'beach',
    'hiking',
    'government',
    'viewpoint',
    'art',
    'shopping',
    'reserve',
    'campground',
    'health',
    'port',
    'theater',
    'nightlife',
    'thermal_complex',
    'wellness',
    'winery',
    'casino',
    'other'
] as const;

interface PoiRow {
    id: string;
    slug: string;
}

interface DestinationRow {
    id: string;
    slug: string;
}

interface RelationRow {
    destinationId: string;
    pointOfInterestId: string;
    relation: string;
}

interface CategoryRow {
    id: string;
    slug: string;
}

interface CategoryAssignmentRow {
    pointOfInterestId: string;
    categoryId: string;
    isPrimary: boolean;
}

function buildPoiModelClass(store: Map<string, PoiRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
        async create(data: { slug: string }) {
            const row = { id: `poi-${data.slug}`, ...data };
            store.set(data.slug, row);
            return row;
        }
    };
}

function buildDestinationModelClass(store: Map<string, DestinationRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
    };
}

/** Mock `RDestinationPointOfInterestModel`, keyed by the (destinationId, pointOfInterestId) PAIR only. */
function buildRelationModelClass(store: Map<string, RelationRow>) {
    return class {
        async findOne(where: { destinationId: string; pointOfInterestId: string }) {
            return store.get(`${where.destinationId}:${where.pointOfInterestId}`) ?? null;
        }
        async create(data: RelationRow) {
            store.set(`${data.destinationId}:${data.pointOfInterestId}`, data);
            return data;
        }
    };
}

function buildCategoryModelClass(store: Map<string, CategoryRow>) {
    return class {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
    };
}

function buildCategoryAssignmentModelClass(store: CategoryAssignmentRow[]) {
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
        async create(data: CategoryAssignmentRow) {
            store.push(data);
            return data;
        }
    };
}

/** Seeds a store with the 12 pre-existing HOS-113 POIs. */
function seedPoiStore(): Map<string, PoiRow> {
    return new Map(ORIGINAL_POI_SLUGS.map((slug) => [slug, { id: `poi-${slug}`, slug }]));
}

/** Seeds a store with all 22 pre-existing destinations `destination-relations.json` references. */
function seedDestinationStore(): Map<string, DestinationRow> {
    return new Map(ALL_DESTINATION_SLUGS.map((slug) => [slug, { id: `dest-${slug}`, slug }]));
}

/** Seeds a store with the 13 destination-POI pairs `0009` already created (`relation: PRIMARY`). */
function seedRelationStore(): Map<string, RelationRow> {
    const store = new Map<string, RelationRow>();
    for (const { destinationSlug, poiSlug } of PRE_EXISTING_PRIMARY_PAIRS) {
        const destinationId = `dest-${destinationSlug}`;
        const pointOfInterestId = `poi-${poiSlug}`;
        store.set(`${destinationId}:${pointOfInterestId}`, {
            destinationId,
            pointOfInterestId,
            relation: 'PRIMARY'
        });
    }
    return store;
}

/** Seeds a store with the 40 real POI category catalog rows. */
function seedCategoryStore(): Map<string, CategoryRow> {
    return new Map(POI_CATEGORY_SLUGS.map((slug) => [slug, { id: `cat-${slug}`, slug }]));
}

interface Stores {
    poiStore: Map<string, PoiRow>;
    destinationStore: Map<string, DestinationRow>;
    relationStore: Map<string, RelationRow>;
    categoryStore: Map<string, CategoryRow>;
    categoryAssignmentStore: CategoryAssignmentRow[];
}

function buildStores(): Stores {
    return {
        poiStore: seedPoiStore(),
        destinationStore: seedDestinationStore(),
        relationStore: seedRelationStore(),
        categoryStore: seedCategoryStore(),
        categoryAssignmentStore: []
    };
}

function buildCtx(stores: Stores): SeedMigrationCtx {
    return {
        db: {},
        actor: STUB_ACTOR,
        models: {
            PointOfInterestModel: buildPoiModelClass(stores.poiStore),
            DestinationModel: buildDestinationModelClass(stores.destinationStore),
            RDestinationPointOfInterestModel: buildRelationModelClass(stores.relationStore),
            PoiCategoryModel: buildCategoryModelClass(stores.categoryStore),
            RPoiCategoryModel: buildCategoryAssignmentModelClass(stores.categoryAssignmentStore)
        },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

describe('0013-hos-142-poi-catalog-expansion', () => {
    it('creates all 830 POIs, the new destination relations, and every category assignment on a first run', async () => {
        // Arrange
        const stores = buildStores();
        const ctx = buildCtx(stores);

        // Act
        const result = await poiCatalogMigration.up(ctx);

        // Assert — top-level counts (AC-2).
        expect(result.counts?.poisCreated).toBe(EXPECTED_TOTAL_POIS);
        expect(result.counts?.poisSkipped).toBe(0);
        expect(result.counts?.relationsCreated).toBe(EXPECTED_NEW_RELATIONS);
        expect(result.counts?.relationsSkipped).toBe(EXPECTED_PRE_EXISTING_MATCHING_PAIRS);
        expect(result.counts?.relationsConflicting).toBe(EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS);
        expect(result.counts?.destinationsNotFound).toBe(0);
        expect(result.counts?.relationPoisNotFound).toBe(0);
        expect(result.counts?.categoryAssignmentsCreated).toBe(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);
        expect(result.counts?.categoryAssignmentsSkipped).toBe(0);
        expect(result.counts?.categoryPoisNotFound).toBe(0);
        expect(result.counts?.categoriesNotFoundForAssignment).toBe(0);

        // Assert — actual store sizes match the reported counts.
        expect(stores.poiStore.size).toBe(EXPECTED_TOTAL_POIS + ORIGINAL_POI_SLUGS.length);
        expect(stores.relationStore.size).toBe(
            PRE_EXISTING_PRIMARY_PAIRS.length + EXPECTED_NEW_RELATIONS
        );
        expect(stores.categoryAssignmentStore).toHaveLength(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);

        // Assert — per-destination breakdown keys exist for every referenced destination
        // (R-2 mitigation: a lopsided/missing destination surfaces immediately).
        for (const slug of ALL_DESTINATION_SLUGS) {
            expect(result.counts?.[`${slug}-relationsCreated`]).toBeTypeOf('number');
            expect(result.counts?.[`${slug}-relationsSkipped`]).toBeTypeOf('number');
            expect(result.counts?.[`${slug}-relationsNotFound`]).toBe(0);
        }
    });

    it('is idempotent: a second run creates nothing (AC-3)', async () => {
        // Arrange — run once to populate every store, exactly like re-running the
        // migration against an environment where it already applied.
        const stores = buildStores();
        const ctx = buildCtx(stores);
        await poiCatalogMigration.up(ctx);

        // Act — run again against the SAME ctx/stores.
        const result = await poiCatalogMigration.up(ctx);

        // Assert — nothing new created; everything resolves as already-existing.
        expect(result.counts?.poisCreated).toBe(0);
        expect(result.counts?.poisSkipped).toBe(EXPECTED_TOTAL_POIS);
        expect(result.counts?.relationsCreated).toBe(0);
        expect(result.counts?.relationsSkipped).toBe(
            EXPECTED_PRE_EXISTING_MATCHING_PAIRS + EXPECTED_NEW_RELATIONS
        );
        // The one known conflict is stable across re-runs — never resolved, never
        // duplicated, never silently dropped.
        expect(result.counts?.relationsConflicting).toBe(EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS);
        expect(result.counts?.categoryAssignmentsCreated).toBe(0);
        expect(result.counts?.categoryAssignmentsSkipped).toBe(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);

        // No duplicate rows anywhere.
        expect(stores.poiStore.size).toBe(EXPECTED_TOTAL_POIS + ORIGINAL_POI_SLUGS.length);
        expect(stores.relationStore.size).toBe(
            PRE_EXISTING_PRIMARY_PAIRS.length + EXPECTED_NEW_RELATIONS
        );
        expect(stores.categoryAssignmentStore).toHaveLength(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);
    });

    it('never overwrites a pre-existing relation row that disagrees with the pipeline data (known conflict: colon/parque_nacional_el_palmar)', async () => {
        // Arrange
        const stores = buildStores();
        const ctx = buildCtx(stores);
        const key = 'dest-colon:poi-parque_nacional_el_palmar';
        expect(stores.relationStore.get(key)?.relation).toBe('PRIMARY');

        // Act
        await poiCatalogMigration.up(ctx);

        // Assert — the existing PRIMARY row is untouched (destructive: false), even
        // though the pipeline data says this pair should be NEARBY (ubajay is now
        // PRIMARY for this POI instead).
        expect(stores.relationStore.get(key)?.relation).toBe('PRIMARY');
        // And a NEW, correct PRIMARY row was created for ubajay for the same POI.
        expect(stores.relationStore.get('dest-ubajay:poi-parque_nacional_el_palmar')).toEqual({
            destinationId: 'dest-ubajay',
            pointOfInterestId: 'poi-parque_nacional_el_palmar',
            relation: 'PRIMARY'
        });
    });

    it('creates two independent rows for the same catalog POI when it is PRIMARY for one destination and NEARBY for another (almacen_campo_la_sonada)', async () => {
        // Arrange
        const stores = buildStores();
        const ctx = buildCtx(stores);

        // Act
        await poiCatalogMigration.up(ctx);

        // Assert — chajari holds the PRIMARY relation, federacion and santa-ana
        // hold NEARBY — three separate legitimate rows for the same POI, none of
        // them colliding on the (destinationId, pointOfInterestId) pair.
        //
        // (Previously used `actividades_nauticas` as the worked example — one of
        // the 78 POIs removed by `0018-poi-curation-safe-subset` — swapped for
        // `almacen_campo_la_sonada`, which has the same one-PRIMARY-plus-two-
        // NEARBY shape across the same three destinations.)
        const poiId = 'poi-almacen_campo_la_sonada';
        expect(stores.relationStore.get(`dest-chajari:${poiId}`)?.relation).toBe('PRIMARY');
        expect(stores.relationStore.get(`dest-federacion:${poiId}`)?.relation).toBe('NEARBY');
        expect(stores.relationStore.get(`dest-santa-ana:${poiId}`)?.relation).toBe('NEARBY');
    });

    it('counts a destination as not-found (and skips its relations) when its slug is missing from the DB', async () => {
        // Arrange — a store missing one destination, simulating a partial env.
        const stores = buildStores();
        stores.destinationStore.delete('santa-ana');
        const ctx = buildCtx(stores);

        // Act
        const result = await poiCatalogMigration.up(ctx);

        // Assert
        expect(result.counts?.destinationsNotFound).toBeGreaterThan(0);
        expect(result.counts?.['santa-ana-relationsNotFound']).toBeGreaterThan(0);
        // POIs and category assignments are still created regardless.
        expect(result.counts?.poisCreated).toBe(EXPECTED_TOTAL_POIS);
        expect(result.counts?.categoryAssignmentsCreated).toBe(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);
    });

    it('counts a category as not-found for assignment (and skips only that one assignment) when a referenced category slug is missing', async () => {
        // Arrange — drop one very common category so at least one assignment fails to resolve.
        const stores = buildStores();
        stores.categoryStore.delete('other');
        const ctx = buildCtx(stores);

        // Act
        const result = await poiCatalogMigration.up(ctx);

        // Assert
        expect(result.counts?.categoriesNotFoundForAssignment).toBeGreaterThan(0);
        expect(result.counts?.categoryAssignmentsCreated).toBeLessThan(
            EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS
        );
        expect(
            (result.counts?.categoryAssignmentsCreated ?? 0) +
                (result.counts?.categoriesNotFoundForAssignment ?? 0)
        ).toBe(EXPECTED_TOTAL_CATEGORY_ASSIGNMENTS);
    });
});
