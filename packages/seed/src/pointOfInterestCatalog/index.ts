import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedPointOfInterestCatalogCategories } from './pointOfInterestCatalogCategories.js';
import { seedPointOfInterestCatalog } from './pointsOfInterestCatalog.seed.js';

/**
 * Executes the dedicated `--poi-catalog` seed group (HOS-142 G-2).
 *
 * Unlike `--test-users` (which must NEVER run against production),
 * `--poi-catalog` is real, permanent production content and must run in
 * EVERY path that seeds real content: `pnpm db:fresh`, `pnpm db:fresh-dev`,
 * `pnpm db:seed`, and the production day-1 bootstrap command (see
 * `docs/deployment/first-time-setup.md` Phase 4). It must never be folded
 * into `--required` (which stays small/fast for every FK-baseline-only
 * consumer) or `--example` (dev/demo-only, excluded from production
 * bootstrap) — see HOS-142 spec §6.2 for the full rationale.
 *
 * Requires `--required` to have run previously in the same invocation (or a
 * prior one) — `poiCategories.seed.ts` and `destinations.seed.ts` must have
 * already seeded the category catalog and the destinations these POIs
 * relate to.
 *
 * Two steps, in order: (1) create the 914 POI rows, (2) assign each
 * fixture's own `categories[]` (HOS-139 M2M) to its now-existing POI —
 * mirroring the `--required` group's own two-step shape for the original 12
 * (`pointsOfInterest.seed.ts` then `poiCategoryBackfill.seed.ts`).
 * Destination↔POI RELATIONS are NOT seeded here — per HOS-142 spec §6.3
 * point 3, that is Phase 2's `0010-*.ts` dual-write data-migration's
 * responsibility (a new relation-sourcing mechanism, `destination-relations.json`,
 * not yet wired into any seed-time step).
 *
 * @param context - Seed context with configuration and utilities
 * @returns Promise that resolves when the POI catalog seeding completes
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runPointOfInterestCatalogSeeds(context: SeedContext): Promise<void> {
    logger.info(`${STATUS_ICONS.Seed} Initializing POI catalog load (HOS-142)...\n`);

    try {
        await seedPointOfInterestCatalog(context);
        await seedPointOfInterestCatalogCategories(context);

        logger.success({ msg: `${STATUS_ICONS.Success} POI catalog load completed.` });
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error} POI catalog load interrupted`);
        logger.error(`   Error: ${(error as Error).message}`);

        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        summaryTracker.print();
    }
}
