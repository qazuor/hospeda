/**
 * @fileoverview
 * Unit tests for the `0011-hos-138-poi-v2-model-core` data migration, using
 * fully mocked `ctx.models.*` model CLASSES (no real database) — the same
 * "mock the ctx, no real DB" style as the `0009-hos-113-points-of-interest`
 * test. Fixture data is loaded FOR REAL from `src/data/pointOfInterest/*.json`,
 * so a drift between a fixture's `nameI18n`/`descriptionI18n` content and this
 * test surfaces as a real failure instead of passing against a stale copy.
 *
 * @module test/data-migrations/0011-hos-138-poi-v2-model-core
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import * as poiV2Migration from '../../src/data-migrations/0011-hos-138-poi-v2-model-core.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos138-poi-v2-migration-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Total POI fixture count (the 12 that existed when HOS-138 landed). */
const EXPECTED_TOTAL_POIS = 12;

interface PoiRow {
    id: string;
    slug: string;
    nameI18n: unknown;
    descriptionI18n?: unknown;
    translationMeta?: unknown;
}

/**
 * Builds a mock `PointOfInterestModel`-shaped class backed by an in-memory
 * `slug -> row` store. `update({ id }, data)` applies the patch to the matching
 * row, mirroring `BaseModel.update`'s where-object signature.
 */
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

/** Seeds a store with the 12 POI slugs in their pre-migration state (nameI18n = null). */
function seedPreMigrationStore(): Map<string, PoiRow> {
    const slugs = [
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
    ];
    return new Map(slugs.map((slug) => [slug, { id: `poi-${slug}`, slug, nameI18n: null }]));
}

function buildCtx(store: Map<string, PoiRow>): SeedMigrationCtx {
    return {
        db: {},
        actor: STUB_ACTOR,
        models: { PointOfInterestModel: buildPoiModelClass(store) },
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

describe('0011-hos-138-poi-v2-model-core', () => {
    it('backfills nameI18n/descriptionI18n/translationMeta on all 12 pre-migration POIs', async () => {
        // Arrange
        const store = seedPreMigrationStore();
        const ctx = buildCtx(store);

        // Act
        const result = await poiV2Migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            poisUpdated: EXPECTED_TOTAL_POIS,
            poisSkipped: 0,
            poisNotFound: 0
        });

        // Every row now carries real, per-locale i18n content sourced from the
        // fixtures (not a null and not a placeholder-in-all-slots for names).
        const palacio = store.get('palacio_san_jose');
        expect(palacio?.nameI18n).toEqual({
            es: 'Palacio San José',
            en: 'San José Palace',
            pt: 'Palácio San José'
        });
        expect(palacio?.descriptionI18n).toBeDefined();
        expect(palacio?.translationMeta).toBeDefined();
    });

    it('is idempotent: a second run skips every POI that already has nameI18n', async () => {
        // Arrange — run once to populate nameI18n, then re-run.
        const store = seedPreMigrationStore();
        const ctx = buildCtx(store);
        await poiV2Migration.up(ctx);

        // Act
        const result = await poiV2Migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({
            poisUpdated: 0,
            poisSkipped: EXPECTED_TOTAL_POIS,
            poisNotFound: 0
        });
    });

    it('counts a POI as not-found (and updates nothing) when its slug is missing from the DB', async () => {
        // Arrange — a store missing one POI, simulating a partial required-seed env.
        const store = seedPreMigrationStore();
        store.delete('palacio_san_jose');
        const ctx = buildCtx(store);

        // Act
        const result = await poiV2Migration.up(ctx);

        // Assert
        expect(result.counts?.poisNotFound).toBe(1);
        expect(result.counts?.poisUpdated).toBe(EXPECTED_TOTAL_POIS - 1);
    });

    it('does not overwrite a POI whose nameI18n was already curated', async () => {
        // Arrange — one row already has curated content (e.g. baseline fresh-DB seed).
        const store = seedPreMigrationStore();
        const curated = store.get('parque_unzue');
        if (curated) curated.nameI18n = { es: 'Custom', en: 'Custom', pt: 'Custom' };
        const ctx = buildCtx(store);

        // Act
        await poiV2Migration.up(ctx);

        // Assert — the curated row is untouched.
        expect(store.get('parque_unzue')?.nameI18n).toEqual({
            es: 'Custom',
            en: 'Custom',
            pt: 'Custom'
        });
    });
});
