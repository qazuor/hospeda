import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedPointOfInterestCatalogCategories } from './pointOfInterestCatalogCategories.js';
import { seedPointOfInterestCatalogRelations } from './pointOfInterestCatalogRelations.js';
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
 * Three steps, in order: (1) create the 908 POI rows, (2) wire each POI's
 * destination relations (HOS-140 `relation: PRIMARY|NEARBY`) from HOS-141's
 * `destination-relations.json` pipeline output, (3) assign each fixture's
 * own `categories[]` (HOS-139 M2M) to its now-existing POI — mirroring the
 * `--required` group's own multi-step shape for the original 12
 * (`pointsOfInterest.seed.ts`, `destinations.seed.ts`'s relation builder,
 * then `poiCategoryBackfill.seed.ts`). Step 2 needs step 1's POIs to
 * already exist (relations resolve `poiSlug` to a DB id) — see
 * `pointOfInterestCatalogRelations.ts`'s own JSDoc for the idempotency
 * rules and the one known cross-environment conflict it documents. Step 2
 * is the SAME relation-sourcing mechanism the `0013-hos-142-poi-catalog-expansion.ts`
 * dual-write migration uses for already-seeded staging/prod DBs (both read
 * the shared `utils/loadDestinationRelations.ts` loader), so a fresh
 * `db:fresh-dev` and an already-seeded live env converge on identical
 * relation counts (HOS-142 AC-2).
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
        await seedPointOfInterestCatalogRelations();
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
