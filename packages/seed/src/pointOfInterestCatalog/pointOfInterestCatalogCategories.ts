/**
 * @fileoverview
 * Seed step: HOS-142 POI catalog category assignments.
 *
 * Assigns EVERY category listed in each of the 914 catalog fixtures'
 * `categories: [{ slug, isPrimary }]` array (HOS-139 M2M shape) — unlike
 * `required/poiCategoryBackfill.seed.ts` (which backfills exactly ONE
 * `isPrimary: true` category per POI, derived from the legacy
 * `PointOfInterestTypeEnum` mapping for the 12 pre-HOS-139 fixtures), this
 * step reads each fixture's OWN, richer, already-curated category list
 * directly — a POI can carry more than one category (e.g. a primary plus
 * one or more secondary tags).
 *
 * `categories` is intentionally NOT part of `PointOfInterestCreateInputSchema`
 * (it is a M2M relation, not a column) — `normalizePointOfInterestSeedItem`
 * does not strip it, so `PointOfInterestCreateInputSchema.safeParse` silently
 * drops it during `seedPointOfInterestCatalog`'s `service.create()` call.
 * This step re-reads the SAME raw fixture files afterward specifically for
 * that field.
 *
 * Runs as a standalone step from `pointOfInterestCatalog/index.ts`, AFTER
 * BOTH `seedPoiCategories` (the 40-category catalog, part of `--required`,
 * which must run before `--poi-catalog` in every chained invocation) and
 * `seedPointOfInterestCatalog` (the 914 POIs) have completed — mirroring
 * `poiCategoryBackfill.seed.ts`'s "depends on two already-seeded entities"
 * shape.
 *
 * Per HOS-142 spec §6.3 point 3, destination↔POI RELATIONS (from
 * `destination-relations.json`) are explicitly Phase 2's responsibility (the
 * `0010-*.ts` dual-write data-migration) — the relation-sourcing mechanism is
 * new and not yet wired into any seed-time step. This file covers CATEGORIES
 * only.
 *
 * ## Idempotency
 *
 * Mirrors `poiCategoryBackfill.seed.ts`: `assignCategoryToPointOfInterest` is
 * called with no `ctx`, so a `ServiceErrorCode.ALREADY_EXISTS` failure for an
 * already-existing exact `(pointOfInterestId, categoryId)` pair resolves as
 * `{ error }` rather than throwing, and is treated as "already assigned,
 * skip" — safe to re-run.
 */
import { PoiCategoryModel, PointOfInterestModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { PointOfInterestCategoryService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { errorHistory } from '../utils/errorHistory.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/** One category assignment as carried on a raw POI catalog fixture. */
interface RawCategoryAssignment {
    readonly slug: string;
    readonly isPrimary: boolean;
}

/**
 * Shape of the subset of a raw POI catalog fixture this step reads: its
 * `slug` (lookup key) and its own `categories` array (HOS-139/HOS-142).
 */
interface RawPointOfInterestCatalogCategoriesFixture {
    readonly slug: string;
    readonly categories?: readonly RawCategoryAssignment[];
}

/**
 * Assigns every category listed on each of the 914 POI catalog fixtures to
 * its corresponding already-seeded POI.
 *
 * @param context - Seed context (actor + error/continue-on-error settings).
 *
 * @example
 * ```typescript
 * await seedPointOfInterestCatalog(seedContext);
 * await seedPointOfInterestCatalogCategories(seedContext);
 * // Assigns e.g. "casa_izquierdo" -> primary "historic_site" + secondary
 * // "architecture" + secondary "tourist_route"
 * ```
 */
export async function seedPointOfInterestCatalogCategories(context: SeedContext): Promise<void> {
    if (!context.actor) {
        throw new Error(
            `${STATUS_ICONS.Error} Actor not available in context. Super admin must be loaded first.`
        );
    }
    const actor = context.actor;

    const files = requiredManifest.pointOfInterestCatalog;
    if (files.length === 0) {
        logger.info(
            `${STATUS_ICONS.Debug} No pointOfInterestCatalog fixtures declared — skipping category assignment.`
        );
        return;
    }

    const poiModel = new PointOfInterestModel();
    const categoryModel = new PoiCategoryModel();
    const categoryService = new PointOfInterestCategoryService({});

    const rawPois = await loadJsonFiles<RawPointOfInterestCatalogCategoriesFixture>(
        'pointOfInterest',
        [...files]
    );

    logger.info(
        `${STATUS_ICONS.Seed} Assigning categories for ${rawPois.length} POI catalog fixtures (HOS-142)`
    );

    let assignedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rawPoi of rawPois) {
        const poi = await poiModel.findOne({ slug: rawPoi.slug });
        if (!poi) {
            logger.warn(
                `${STATUS_ICONS.Warning} POI "${rawPoi.slug}" not found, skipping category assignment`
            );
            continue;
        }

        for (const assignment of rawPoi.categories ?? []) {
            const category = await categoryModel.findOne({ slug: assignment.slug });
            if (!category) {
                logger.warn(
                    `${STATUS_ICONS.Warning} POI category "${assignment.slug}" not found, skipping assignment for "${rawPoi.slug}"`
                );
                continue;
            }

            let assigned = false;
            let serviceError: { code?: string; message?: string } | undefined;
            try {
                const result = await categoryService.assignCategoryToPointOfInterest(actor, {
                    pointOfInterestId: poi.id,
                    categoryId: category.id,
                    isPrimary: assignment.isPrimary
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
                summaryTracker.trackSuccess('PoiCatalog Category Assignment');
                continue;
            }

            if (serviceError?.code === ServiceErrorCode.ALREADY_EXISTS) {
                skippedCount++;
                continue;
            }

            errorCount++;
            const errorMessage = `${STATUS_ICONS.Error} Failed to assign category "${assignment.slug}" to "${rawPoi.slug}": ${serviceError?.message ?? 'Unknown error'}`;
            summaryTracker.trackError(
                'PoiCatalog Category Assignment',
                rawPoi.slug,
                serviceError?.message || 'Unknown error'
            );
            errorHistory.recordError(
                'PoiCatalog Category Assignment',
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
    }

    logger.info(
        `POI catalog category assignment: ${assignedCount} assigned, ${skippedCount} already existed, ${errorCount} errors`
    );
}
