/**
 * @fileoverview
 * Seed step: 12-POI primary-category backfill (HOS-139 spec §6.3/§7.4/§7.5).
 *
 * Assigns each of the 12 already-seeded points of interest (HOS-113 Phase 1)
 * exactly one `r_poi_category` row, marked `isPrimary = true`, per the
 * legacy `PointOfInterestTypeEnum` → new category `slug` mapping documented
 * in spec §7.4 (`POI_TYPE_TO_CATEGORY_SLUG`, `@repo/schemas`). This is a
 * one-time backfill for the 12 fixtures that existed before HOS-139 — it
 * deliberately reads a FIXED file list, not `requiredManifest.pointsOfInterest`,
 * mirroring `data-migrations/0009-hos-113-points-of-interest.ts` /
 * `0011-hos-138-poi-v2-model-core.ts`'s precedent: a future PR that adds more
 * points of interest (the 914-POI dataset, HOS-142) ships its own category
 * assignments directly rather than being silently swept into this backfill.
 *
 * Runs as a standalone step from `required/index.ts`, AFTER both
 * `seedPoiCategories` (the 40-category catalog) and `seedPointsOfInterest`
 * (the 12 POIs) have completed — unlike `destinations.seed.ts`'s
 * `postProcess`/`relationBuilder` hooks (which fire per-item during a single
 * factory's own run), this backfill depends on TWO already-seeded entities,
 * so it cannot be attached to either factory's own per-item hook without a
 * risk of running before the other entity exists.
 *
 * Uses `PointOfInterestCategoryService.assignCategoryToPointOfInterest` (not
 * a direct model insert) so the transactional `points_of_interest.type` sync
 * (spec §6.5/§7.6) runs — for these 12 POIs the derived `type` always equals
 * the value the fixture already carries (§7.4 and §7.6 are inverses for the
 * 9 overlapping concepts), so the sync is a no-op write, not a behavior
 * change.
 *
 * ## Idempotency
 *
 * `assignCategoryToPointOfInterest` is called with no `ctx`, so a
 * `ServiceErrorCode.ALREADY_EXISTS` failure for an already-existing exact
 * `(pointOfInterestId, categoryId)` pair comes back as a resolved `{ error }`
 * Result, not a thrown exception (`runWithLoggingAndValidation` only
 * re-throws when the caller passes `ctx.tx`). The returned Result's
 * `error.code` is inspected explicitly and treated as "already backfilled,
 * skip" rather than a hard failure, so re-running the required seed (or
 * `db:seed:migrate` picking up the data-migration counterpart) never
 * duplicates a relation or throws.
 */
import { PoiCategoryModel, PointOfInterestModel } from '@repo/db';
import {
    POI_TYPE_TO_CATEGORY_SLUG,
    type PointOfInterestTypeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { PointOfInterestCategoryService } from '@repo/service-core';
import { errorHistory } from '../utils/errorHistory.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * The 12 POI fixture filenames this backfill targets (HOS-113 Phase 1's
 * frozen set). See the file-level JSDoc for why this is a fixed list rather
 * than `requiredManifest.pointsOfInterest`.
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
 * Shape of the subset of a raw POI fixture item this step reads: its `slug`
 * (lookup key, POIs have no deterministic fixture id) and legacy `type`
 * (the §7.4 mapping's input).
 */
interface RawPointOfInterestBackfillFixture {
    readonly slug: string;
    readonly type: string;
}

/**
 * Backfills the primary category for each of the 12 existing seeded points
 * of interest, per §7.4's legacy `type` → category `slug` mapping.
 *
 * Resolves both the POI and the target category by `slug` (never a
 * hardcoded UUID — neither entity uses a deterministic fixture id), the same
 * resolution strategy `0009-hos-113-points-of-interest.ts` and
 * `0011-hos-138-poi-v2-model-core.ts` use, so this seed step and this spec's
 * data-migration counterpart (`data-migrations/0012-hos-139-poi-categories.ts`)
 * can never drift.
 *
 * @param context - Seed context (actor + error/continue-on-error settings).
 *
 * @example
 * ```typescript
 * await seedPoiCategories(seedContext);
 * await seedPointsOfInterest(seedContext);
 * await seedPoiCategoryBackfill(seedContext);
 * // Assigns e.g. "autodromo_concepcion_del_uruguay" → primary category "sports_venue"
 * ```
 */
export async function seedPoiCategoryBackfill(context: SeedContext): Promise<void> {
    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }
    const actor = context.actor;

    const poiModel = new PointOfInterestModel();
    const categoryModel = new PoiCategoryModel();
    const categoryService = new PointOfInterestCategoryService({});

    const rawPois = await loadJsonFiles<RawPointOfInterestBackfillFixture>('pointOfInterest', [
        ...POI_FIXTURE_FILES
    ]);

    logger.info(
        `${STATUS_ICONS.Seed} Backfilling primary categories for ${rawPois.length} points of interest (HOS-139 spec §7.4)`
    );

    let assignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawPoi of rawPois) {
        const categorySlug = POI_TYPE_TO_CATEGORY_SLUG[rawPoi.type as PointOfInterestTypeEnum];

        const poi = await poiModel.findOne({ slug: rawPoi.slug });
        if (!poi) {
            logger.warn(
                `${STATUS_ICONS.Warning} POI "${rawPoi.slug}" not found, skipping category backfill`
            );
            continue;
        }

        const category = await categoryModel.findOne({ slug: categorySlug });
        if (!category) {
            logger.warn(
                `${STATUS_ICONS.Warning} POI category "${categorySlug}" not found, skipping backfill for "${rawPoi.slug}"`
            );
            continue;
        }

        // `assignCategoryToPointOfInterest` is called with NO `ctx`, so
        // `runWithLoggingAndValidation` RESOLVES a `{ error }` Result instead of
        // throwing a `ServiceError` (HOS-139 judgment-day WARNING) — the try/catch
        // below only catches a genuinely unexpected exception (e.g. a `DbError`
        // from a real database failure, which IS always re-thrown regardless of
        // `ctx.tx`). The returned Result must be inspected explicitly to tell a
        // real success apart from a masked failure.
        let assigned = false;
        let serviceError: { code?: string; message?: string } | undefined;
        try {
            const result = await categoryService.assignCategoryToPointOfInterest(actor, {
                pointOfInterestId: poi.id,
                categoryId: category.id,
                isPrimary: true
            });
            if (result.data) {
                assigned = true;
            } else {
                serviceError = result.error;
            }
        } catch (error: unknown) {
            serviceError = error as { code?: string; message?: string };
        }

        if (assigned) {
            assignedCount++;
            logger.success({
                msg: `[${assignedCount + skippedCount} of ${rawPois.length}] - Assigned primary category "${categorySlug}" to "${rawPoi.slug}"`
            });
            summaryTracker.trackSuccess('PoiCategory Backfill');
            continue;
        }

        if (serviceError?.code === ServiceErrorCode.ALREADY_EXISTS) {
            skippedCount++;
            logger.info(
                `[${assignedCount + skippedCount} of ${rawPois.length}] - "${rawPoi.slug}" already has category "${categorySlug}" assigned, skipping`
            );
            continue;
        }

        errorCount++;
        const errorMessage = `${STATUS_ICONS.Error} Failed to backfill category for "${rawPoi.slug}": ${serviceError?.message ?? 'Unknown error'}`;
        summaryTracker.trackError(
            'PoiCategory Backfill',
            rawPoi.slug,
            serviceError?.message || 'Unknown error'
        );
        errorHistory.recordError(
            'PoiCategory Backfill',
            rawPoi.slug,
            `Failed to assign category: ${serviceError?.message}`,
            serviceError
        );

        if (context.continueOnError) {
            logger.warn(`${STATUS_ICONS.Warning} ${errorMessage}`);
        } else {
            throw new Error(errorMessage);
        }
    }

    logger.info(
        `POI category backfill: ${assignedCount} assigned, ${skippedCount} already existed, ${errorCount} errors`
    );
}
