/**
 * @fileoverview
 * Seed step: HOS-142 POI catalog destination relations.
 *
 * Wires the destination↔POI relations for the catalog POIs on a FRESH DB,
 * sourced from HOS-141's pipeline output
 * (`scripts/poi-pipeline/output/destination-relations.json`) via the shared
 * loader (`utils/loadDestinationRelations.ts`) — the SAME loader and SAME
 * source the `0013-hos-142-poi-catalog-expansion.ts` dual-write migration
 * uses to backfill these relations onto an already-seeded staging/prod DB.
 * Both paths therefore converge on identical relation counts (HOS-142 AC-2).
 *
 * Runs as a standalone step from `pointOfInterestCatalog/index.ts`, AFTER
 * `seedPointOfInterestCatalog` (the 908 POIs) — this step needs their DB
 * ids to resolve `poiSlug` — and before or after
 * `seedPointOfInterestCatalogCategories` (independent of it; ordered before
 * it here purely to mirror `0013`'s own step order: POIs, then relations,
 * then categories).
 *
 * `destination-relations.json` also references 6 of the original 12
 * HOS-113 POIs (not just the 908 catalog ones) — resolved by `slug` the
 * same way, since both share the same `points_of_interest` table. By the
 * time this step runs, `--required` has already seeded those 12 POIs AND
 * their 13 pre-HOS-140 relations (`destinations.seed.ts`'s
 * `pointOfInterestRelationBuilder`, implicit `relation: PRIMARY`) — so this
 * step's first encounter with those 6 slugs is via the idempotency check
 * below, not a fresh insert.
 *
 * ## Idempotency
 *
 * Mirrors `0013-hos-142-poi-catalog-expansion.ts` exactly (same source data,
 * same conflict): a row is identified by the PAIR
 * `(destinationId, pointOfInterestId)` — the table's actual composite
 * PRIMARY KEY (`relation` is a plain column with a default, HOS-140 never
 * moved it into the PK) — not the triple including `relation`:
 *
 *   - No existing row → create with the pipeline's `relation` value.
 *   - Existing row, SAME `relation` → skip (already correct, re-running is
 *     safe).
 *   - Existing row, DIFFERENT `relation` → skip WITHOUT overwriting (never
 *     destructive), counted separately as `conflicting`.
 *
 * **Known conflict, reproduced on a fresh DB too**: `destinations.seed.ts`'s
 * `pointOfInterestRelationBuilder` already creates
 * `(colon, parque_nacional_el_palmar)` as `PRIMARY` (Colón's
 * `pointOfInterestIds` fixture array, pre-HOS-140) by the time this step
 * runs. HOS-141's pipeline data reassigns that POI's PRIMARY destination to
 * `ubajay` and lists `colon` as only `NEARBY`. This step does NOT overwrite
 * the existing row — same resolution `0013` applies for the live-env path,
 * so fresh and already-seeded environments converge on the identical
 * outcome for this one pair.
 *
 * Uses `@repo/db` models directly (not `PointOfInterestService`'s
 * `addPointOfInterestToDestination`) — deliberately, so the pre-existing-row
 * check can read the CURRENT `relation` value and distinguish "same" from
 * "conflicting" (the service only reports a generic `ALREADY_EXISTS`
 * either way, which would collapse that distinction and lose the R-2
 * visibility this step is meant to provide).
 *
 * ## Testability: injectable model dependencies
 *
 * `seedPointOfInterestCatalogRelations` takes an OPTIONAL {@link
 * PointOfInterestCatalogRelationsDeps} argument, defaulting to real
 * `@repo/db` model instances. This is NOT how the sibling
 * `pointOfInterestCatalogCategories.ts` is written (it constructs
 * `new PointOfInterestModel()` etc. directly, with no seam) — that
 * asymmetry is deliberate, not an oversight: `vi.mock('@repo/db', ...)`
 * does not reliably intercept classes imported by a package's OWN `src/`
 * files under this repo's `vite-tsconfig-paths` + `pool: 'forks'` vitest
 * config (verified by reproducing the identical "Database not initialized"
 * failure against the already-merged `pointOfInterestCatalogCategories.ts`
 * when driven the same way) — the mock only takes effect for whichever
 * module resolves `@repo/db` from the TEST file itself, not from a
 * downstream `src/` module that imports it independently. Constructor
 * injection sidesteps that limitation entirely without touching the
 * vitest config or the sibling file.
 *
 * @module pointOfInterestCatalog/pointOfInterestCatalogRelations
 */
import { DestinationModel, PointOfInterestModel, RDestinationPointOfInterestModel } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { loadDestinationRelations } from '../utils/loadDestinationRelations.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Minimal shape of each model this step needs — narrow `Pick`s of the real
 * `@repo/db` model classes, so a test can inject a lightweight stub without
 * implementing every unrelated method those classes expose.
 */
export interface PointOfInterestCatalogRelationsDeps {
    readonly destinationModel: Pick<DestinationModel, 'findOne'>;
    readonly poiModel: Pick<PointOfInterestModel, 'findOne'>;
    readonly relationModel: Pick<RDestinationPointOfInterestModel, 'findOne' | 'create'>;
}

/**
 * Wires every destination↔POI relation from HOS-141's pipeline output onto
 * already-seeded destinations and POIs (HOS-142 §6.3 point 3 / G-5).
 *
 * @param deps - Model dependencies. Defaults to real `@repo/db` instances;
 * tests inject stubs instead (see this file's "Testability" JSDoc note).
 *
 * @example
 * ```typescript
 * await seedPointOfInterestCatalog(seedContext);
 * await seedPointOfInterestCatalogRelations();
 * // Wires relations like:
 * // (chajari, acceso_oficina_turismo) -> PRIMARY
 * // (santa-ana, actividades_nauticas) -> PRIMARY
 * // (chajari, actividades_nauticas) -> NEARBY
 * ```
 */
export async function seedPointOfInterestCatalogRelations(
    deps: PointOfInterestCatalogRelationsDeps = {
        destinationModel: new DestinationModel(),
        poiModel: new PointOfInterestModel(),
        relationModel: new RDestinationPointOfInterestModel()
    }
): Promise<void> {
    const { destinationModel, poiModel, relationModel } = deps;

    const rawRelations = await loadDestinationRelations();

    logger.info(
        `${STATUS_ICONS.Seed} Wiring ${rawRelations.length} destination-POI relations (HOS-142)`
    );

    let createdCount = 0;
    let skippedCount = 0;
    let conflictingCount = 0;
    let destinationsNotFoundCount = 0;
    let poisNotFoundCount = 0;

    const destinationIdBySlug = new Map<string, string>();
    const poiIdBySlug = new Map<string, string>();

    for (const rawRelation of rawRelations) {
        let destinationId = destinationIdBySlug.get(rawRelation.destinationSlug);
        if (destinationId === undefined) {
            const destination = await destinationModel.findOne({
                slug: rawRelation.destinationSlug
            });
            if (!destination) {
                destinationsNotFoundCount++;
                logger.warn(
                    `${STATUS_ICONS.Warning} Destination "${rawRelation.destinationSlug}" not found, skipping relation for POI "${rawRelation.poiSlug}"`
                );
                continue;
            }
            destinationId = destination.id;
            destinationIdBySlug.set(rawRelation.destinationSlug, destinationId);
        }

        let pointOfInterestId = poiIdBySlug.get(rawRelation.poiSlug);
        if (pointOfInterestId === undefined) {
            const poi = await poiModel.findOne({ slug: rawRelation.poiSlug });
            if (!poi) {
                poisNotFoundCount++;
                logger.warn(
                    `${STATUS_ICONS.Warning} POI "${rawRelation.poiSlug}" not found, skipping relation for destination "${rawRelation.destinationSlug}"`
                );
                continue;
            }
            pointOfInterestId = poi.id;
            poiIdBySlug.set(rawRelation.poiSlug, pointOfInterestId);
        }

        const existing = await relationModel.findOne({ destinationId, pointOfInterestId });
        if (existing) {
            if (existing.relation === rawRelation.relation) {
                skippedCount++;
            } else {
                conflictingCount++;
                logger.warn(
                    `${STATUS_ICONS.Warning} Relation (${rawRelation.destinationSlug}, ${rawRelation.poiSlug}) already exists as "${existing.relation}", pipeline data says "${rawRelation.relation}" — keeping the existing row (not destructive)`
                );
            }
            continue;
        }

        await relationModel.create({
            destinationId,
            pointOfInterestId,
            relation: rawRelation.relation
        });
        createdCount++;
        summaryTracker.trackSuccess('PoiCatalog Destination Relation');
    }

    logger.info(
        `POI catalog destination relations: ${createdCount} created, ${skippedCount} already ` +
            `existed, ${conflictingCount} conflicting, ${destinationsNotFoundCount} destinations ` +
            `not found, ${poisNotFoundCount} POIs not found`
    );
}
