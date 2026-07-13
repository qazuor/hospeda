/**
 * @fileoverview
 * Data migration: 0012-hos-139-poi-categories
 *
 * Dual-write counterpart (HOS-25) for HOS-139 (POI categories model). The
 * structural migration `0053_*.sql` adds the `poi_categories` and
 * `r_poi_category` tables, and this spec's baseline seed
 * (`required/poiCategories.seed.ts` + 40 fixtures under
 * `src/data/poiCategory/*.json`, plus `required/poiCategoryBackfill.seed.ts`)
 * populates both on a FRESH DB. This migration applies the identical content
 * to an already-seeded staging/prod DB (which predates the tables entirely),
 * so both paths converge (spec §7.5, AC-3/AC-4):
 *
 * 1. Inserts the 40 `poi_categories` catalog rows (spec §6.3), skipping any
 *    slug that already exists.
 * 2. Backfills one `r_poi_category` row per already-existing POI (the 12
 *    fixtures from HOS-113 Phase 1), marked `isPrimary = true`, per the
 *    legacy `type` → category `slug` mapping (spec §7.4,
 *    `POI_TYPE_TO_CATEGORY_SLUG` in `@repo/schemas`), skipping any
 *    `(pointOfInterestId, categoryId)` pair that already exists.
 * 3. Syncs `points_of_interest.type` to the derived value from the primary
 *    category (spec §6.5/§7.6, `deriveTypeFromCategorySlug`) for each
 *    backfilled POI — for these 12 POIs the derived value always equals what
 *    is already stored (§7.4 and §7.6 are inverses for the 9 overlapping
 *    concepts), so this write is idempotent-safe and a behavioral no-op, not
 *    a data change.
 *
 * Row data is read directly from the same fixture JSON files the baseline
 * seed reads (via `loadJsonFiles`), reusing `normalizePoiCategorySeedItem`
 * from `poiCategories.seed.ts`, so the two can never drift.
 *
 * ## Idempotency
 *
 * - Categories are created only when no row with the same `slug` already
 *   exists (`poi_categories.slug` is UNIQUE).
 * - Backfill relations are created only when no `(pointOfInterestId,
 *   categoryId)` row already exists in `r_poi_category`.
 * - Both POIs and categories are resolved by `slug`, never by a hardcoded
 *   UUID: neither entity uses a deterministic fixture id, and staging/prod
 *   ids differ from local dev ids.
 * - The 12 POI fixture filenames are deliberately a FIXED list, not
 *   `requiredManifest.pointsOfInterest` — mirrors `0009-hos-113-points-of-interest.ts`
 *   / `0011-hos-138-poi-v2-model-core.ts`'s precedent: a future PR that adds
 *   more points of interest (the 914-POI dataset, HOS-142) ships its own
 *   category assignments directly, rather than being silently swept into
 *   this one-time backfill.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation is an INSERT-if-missing (categories, then
 * backfill relations) plus a conditional UPDATE that only ever writes the
 * SAME value the row already has for these 12 POIs (see point 3 above).
 * Nothing is ever deleted or overwritten with different content.
 */
import type { PoiCategory, PointOfInterest } from '@repo/schemas';
import {
    deriveTypeFromCategorySlug,
    POI_TYPE_TO_CATEGORY_SLUG,
    type PointOfInterestTypeEnum
} from '@repo/schemas';
import { normalizePoiCategorySeedItem } from '../required/poiCategories.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0012-hos-139-poi-categories',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 40 POI category fixture filenames this migration inserts (HOS-139
 * spec §6.3), matching `manifest-required.json`'s `poiCategories` array.
 */
const POI_CATEGORY_FIXTURE_FILES = [
    '001-poi-category-historic_site.json',
    '002-poi-category-recreation.json',
    '003-poi-category-tourist_route.json',
    '004-poi-category-natural_area.json',
    '005-poi-category-education.json',
    '006-poi-category-cultural_center.json',
    '007-poi-category-services.json',
    '008-poi-category-park.json',
    '009-poi-category-waterfront.json',
    '010-poi-category-sports_venue.json',
    '011-poi-category-architecture.json',
    '012-poi-category-community_center.json',
    '013-poi-category-family.json',
    '014-poi-category-monument.json',
    '015-poi-category-entertainment.json',
    '016-poi-category-industrial_heritage.json',
    '017-poi-category-museum.json',
    '018-poi-category-fair.json',
    '019-poi-category-transport.json',
    '020-poi-category-birdwatching.json',
    '021-poi-category-gastronomy.json',
    '022-poi-category-square.json',
    '023-poi-category-religious_site.json',
    '024-poi-category-beach.json',
    '025-poi-category-hiking.json',
    '026-poi-category-government.json',
    '027-poi-category-viewpoint.json',
    '028-poi-category-art.json',
    '029-poi-category-shopping.json',
    '030-poi-category-reserve.json',
    '031-poi-category-campground.json',
    '032-poi-category-health.json',
    '033-poi-category-port.json',
    '034-poi-category-theater.json',
    '035-poi-category-nightlife.json',
    '036-poi-category-thermal_complex.json',
    '037-poi-category-wellness.json',
    '038-poi-category-winery.json',
    '039-poi-category-casino.json',
    '040-poi-category-other.json'
] as const;

/**
 * The 12 POI fixture filenames this migration backfills a primary category
 * onto (HOS-113 Phase 1's frozen set). Deliberately a fixed list — see the
 * file-level JSDoc's idempotency note.
 */
const POI_FIXTURE_FILES = [
    '001-point-of-interest-autodromo_concepcion_del_uruguay.json',
    '002-point-of-interest-playa_banco_pelay.json',
    '003-point-of-interest-palacio_san_jose.json',
    '004-point-of-interest-basilica_inmaculada_concepcion.json',
    '005-point-of-interest-parque_unzue.json',
    '006-point-of-interest-isla_del_puerto.json',
    '007-point-of-interest-plaza_francisco_ramirez.json',
    '008-point-of-interest-mirador_costanera.json',
    '009-point-of-interest-complejo_termal_concordia.json',
    '010-point-of-interest-balneario_itape.json',
    '011-point-of-interest-parque_nacional_el_palmar.json',
    '012-point-of-interest-termas_de_federacion.json'
] as const;

/**
 * Shape of a raw POI category fixture item, as loaded from
 * `src/data/poiCategory/*.json`, before normalization.
 */
interface RawPoiCategoryFixture {
    readonly id: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/**
 * Shape of the subset of a raw POI fixture item this migration reads: its
 * `slug` (lookup key) and legacy `type` (the §7.4 mapping's input).
 */
interface RawPointOfInterestBackfillFixture {
    readonly slug: string;
    readonly type: string;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const categoryModel = new ctx.models.PoiCategoryModel();
    const poiModel = new ctx.models.PointOfInterestModel();
    const relationModel = new ctx.models.RPoiCategoryModel();

    const counts: Record<string, number> = {
        categoriesCreated: 0,
        categoriesSkipped: 0,
        relationsCreated: 0,
        relationsSkipped: 0,
        poisNotFound: 0,
        categoriesNotFoundForBackfill: 0,
        typeSynced: 0
    };

    // ── POI categories catalog (idempotent by slug) ─────────────────────────
    const rawCategories = await loadJsonFiles<RawPoiCategoryFixture>('poiCategory', [
        ...POI_CATEGORY_FIXTURE_FILES
    ]);

    for (const rawCategory of rawCategories) {
        const existing = await categoryModel.findOne({ slug: rawCategory.slug }, ctx.db);
        if (existing) {
            counts.categoriesSkipped = (counts.categoriesSkipped ?? 0) + 1;
            continue;
        }

        const normalized = normalizePoiCategorySeedItem(rawCategory);
        await categoryModel.create(normalized as Partial<PoiCategory>, ctx.db);
        counts.categoriesCreated = (counts.categoriesCreated ?? 0) + 1;
    }

    // ── 12-POI primary-category backfill (idempotent by composite key) ─────
    const rawPois = await loadJsonFiles<RawPointOfInterestBackfillFixture>('pointOfInterest', [
        ...POI_FIXTURE_FILES
    ]);

    for (const rawPoi of rawPois) {
        const categorySlug = POI_TYPE_TO_CATEGORY_SLUG[rawPoi.type as PointOfInterestTypeEnum];

        const poi = await poiModel.findOne({ slug: rawPoi.slug }, ctx.db);
        if (!poi) {
            counts.poisNotFound = (counts.poisNotFound ?? 0) + 1;
            continue;
        }

        const category = await categoryModel.findOne({ slug: categorySlug }, ctx.db);
        if (!category) {
            counts.categoriesNotFoundForBackfill = (counts.categoriesNotFoundForBackfill ?? 0) + 1;
            continue;
        }

        const existingRelation = await relationModel.findOne(
            { pointOfInterestId: poi.id, categoryId: category.id },
            ctx.db
        );
        if (existingRelation) {
            counts.relationsSkipped = (counts.relationsSkipped ?? 0) + 1;
            continue;
        }

        await relationModel.create(
            { pointOfInterestId: poi.id, categoryId: category.id, isPrimary: true },
            ctx.db
        );
        counts.relationsCreated = (counts.relationsCreated ?? 0) + 1;

        // Keep points_of_interest.type in sync with the primary category
        // (spec §6.5/§7.6). For these 9 direct-mapping slugs the derived
        // value always equals what the row already has, but the check keeps
        // this migration correct-by-construction rather than relying on that
        // coincidence.
        const derivedType = deriveTypeFromCategorySlug(category.slug);
        if (poi.type !== derivedType) {
            await poiModel.update(
                { id: poi.id },
                { type: derivedType } as Partial<PointOfInterest>,
                ctx.db
            );
            counts.typeSynced = (counts.typeSynced ?? 0) + 1;
        }
    }

    return {
        summary: `HOS-139 POI categories: ${counts.categoriesCreated} categories created (${counts.categoriesSkipped} already existed), ${counts.relationsCreated} POI-category backfill relations created (${counts.relationsSkipped} already existed, ${counts.typeSynced} types synced).`,
        counts
    };
}
