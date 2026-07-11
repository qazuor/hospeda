/**
 * @fileoverview
 * Unit tests for the `0009-hos-113-points-of-interest` data migration,
 * using fully mocked `ctx.models.*` model CLASSES (no real database
 * connection) — the same "mock the ctx, no real DB" style
 * `0007-remove-legacy-make-webhook-url-setting.test.ts` uses, chosen over
 * an `*.integration.test.ts` because this migration's I/O is (a) real
 * filesystem reads of the fixture JSON files via `loadJsonFiles` (safe,
 * deterministic, no DB) and (b) a handful of `findOne`/`create` calls this
 * test can intercept directly.
 *
 * Fixture data is loaded FOR REAL from `src/data/pointOfInterest/*.json`
 * and the 6 `src/data/destination/*.json` files, so a drift between this
 * test's expectations and the actual fixture content (e.g. someone editing
 * a `pointOfInterestIds` array) surfaces as a real test failure rather than
 * silently passing against a stale hand-copied fixture.
 *
 * @module test/data-migrations/0009-hos-113-points-of-interest
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as poiMigration from '../../src/data-migrations/0009-hos-113-points-of-interest.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos113-poi-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** The 6 destination slugs the migration targets, mapped to a fake DB id. */
const DESTINATION_ROWS_BY_SLUG: ReadonlyMap<string, { id: string; slug: string }> = new Map(
    ['colon', 'concordia', 'federacion', 'liebig', 'concepcion-del-uruguay', 'caseros'].map(
        (slug) => [slug, { id: `dest-${slug}`, slug }]
    )
);

/** Total relation-row count implied by the 6 fixtures' `pointOfInterestIds` arrays (2+1+1+1+7+1). */
const EXPECTED_TOTAL_RELATIONS = 13;

/** Total POI fixture count (HOS-113 Phase 1). */
const EXPECTED_TOTAL_POIS = 12;

/**
 * Builds a mock `PointOfInterestModel`-shaped class backed by an in-memory
 * `slug -> row` store the test can seed/inspect across calls.
 */
function buildPoiModelClass(store: Map<string, { id: string; slug: string }>) {
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

/**
 * Builds a mock `DestinationModel`-shaped class backed by a fixed
 * `slug -> row` lookup (destinations are never created by this migration —
 * only resolved).
 */
function buildDestinationModelClass(rows: ReadonlyMap<string, { id: string; slug: string }>) {
    return class {
        async findOne(where: { slug: string }) {
            return rows.get(where.slug) ?? null;
        }
    };
}

/**
 * Builds a mock `RDestinationPointOfInterestModel`-shaped class backed by an
 * in-memory `"destinationId:pointOfInterestId" -> true` set.
 */
function buildRelationModelClass(pairs: Set<string>) {
    return class {
        async findOne(where: { destinationId: string; pointOfInterestId: string }) {
            const key = `${where.destinationId}:${where.pointOfInterestId}`;
            return pairs.has(key)
                ? { destinationId: where.destinationId, pointOfInterestId: where.pointOfInterestId }
                : null;
        }
        async create(data: { destinationId: string; pointOfInterestId: string }) {
            pairs.add(`${data.destinationId}:${data.pointOfInterestId}`);
            return data;
        }
    };
}

/**
 * Builds a fully mocked `SeedMigrationCtx` around fresh, empty in-memory
 * stores. `ctx.db` is never dereferenced directly by this migration (it is
 * only forwarded as the `tx` argument to mocked model methods, which ignore
 * it), so an empty object stub is sufficient.
 */
function buildCtx(): {
    ctx: SeedMigrationCtx;
    poiStore: Map<string, { id: string; slug: string }>;
    relationPairs: Set<string>;
} {
    const poiStore = new Map<string, { id: string; slug: string }>();
    const relationPairs = new Set<string>();

    const ctx = {
        db: {},
        actor: STUB_ACTOR,
        models: {
            PointOfInterestModel: buildPoiModelClass(poiStore),
            DestinationModel: buildDestinationModelClass(DESTINATION_ROWS_BY_SLUG),
            RDestinationPointOfInterestModel: buildRelationModelClass(relationPairs)
        },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;

    return { ctx, poiStore, relationPairs };
}

describe('0009-hos-113-points-of-interest', () => {
    it('creates all 12 POIs and all 13 destination-POI relations on a first run', async () => {
        // Arrange
        const { ctx, poiStore, relationPairs } = buildCtx();

        // Act
        const result = await poiMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            poisCreated: EXPECTED_TOTAL_POIS,
            poisSkipped: 0,
            relationsCreated: EXPECTED_TOTAL_RELATIONS,
            relationsSkipped: 0,
            destinationsNotFound: 0,
            poisNotFound: 0
        });
        expect(poiStore.size).toBe(EXPECTED_TOTAL_POIS);
        expect(relationPairs.size).toBe(EXPECTED_TOTAL_RELATIONS);
        expect(result.summary).toMatch(/12 POIs created/);
    });

    it('is idempotent: a second run against already-populated stores creates nothing', async () => {
        // Arrange — run once to populate the stores, exactly like re-running the migration
        // against an environment where it already applied.
        const { ctx } = buildCtx();
        await poiMigration.up(ctx);

        // Act — run again against the SAME ctx/stores.
        const result = await poiMigration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            poisCreated: 0,
            poisSkipped: EXPECTED_TOTAL_POIS,
            relationsCreated: 0,
            relationsSkipped: EXPECTED_TOTAL_RELATIONS,
            destinationsNotFound: 0,
            poisNotFound: 0
        });
    });

    it('counts a destination as not-found (and skips its relations) when its slug is missing from the DB', async () => {
        // Arrange — a store missing one of the 6 targeted destinations, simulating an
        // environment where that destination fixture has not been seeded (e.g. a partial
        // required-data run).
        const partialDestinations = new Map(DESTINATION_ROWS_BY_SLUG);
        partialDestinations.delete('colon');

        const poiStore = new Map<string, { id: string; slug: string }>();
        const relationPairs = new Set<string>();
        const ctx = {
            db: {},
            actor: STUB_ACTOR,
            models: {
                PointOfInterestModel: buildPoiModelClass(poiStore),
                DestinationModel: buildDestinationModelClass(partialDestinations),
                RDestinationPointOfInterestModel: buildRelationModelClass(relationPairs)
            },
            services: {},
            helpers: {}
        } as unknown as SeedMigrationCtx;

        // Act
        const result = await poiMigration.up(ctx);

        // Assert — Colón normally contributes 2 relations (balneario_itape,
        // parque_nacional_el_palmar); both are skipped, the rest (11) still created.
        expect(result.counts?.destinationsNotFound).toBe(1);
        expect(result.counts?.relationsCreated).toBe(EXPECTED_TOTAL_RELATIONS - 2);
        // POIs are still created regardless of destination availability.
        expect(result.counts?.poisCreated).toBe(EXPECTED_TOTAL_POIS);
    });
});
