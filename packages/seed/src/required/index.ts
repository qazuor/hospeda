import { describeError } from '../utils/errorSerialization.js';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAiPrompts } from './aiPrompts.seed.js';
import { seedAiSettings } from './aiSettings.seed.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedContentModerationData } from './contentModeration.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedExchangeRateConfig } from './exchangeRateConfig.seed.js';
import { seedExchangeRates } from './exchangeRates.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedInternalTags } from './internalTags.seed.js';
import { seedPoiCategories } from './poiCategories.seed.js';
import { seedPoiCategoryBackfill } from './poiCategoryBackfill.seed.js';
import { seedPointsOfInterest } from './pointsOfInterest.seed.js';
import { seedPostTags } from './postTags.seed.js';
import { seedRevalidationConfig } from './revalidationConfig.seed.js';
import { seedRolePermissions } from './rolePermissions.seed.js';
import type { FailedRequiredSeedStep, RequiredSeedStep } from './runSteps.js';
import { runRequiredSteps } from './runSteps.js';
import { seedSocialAutomation } from './socialAutomation.seed.js';
import { seedSponsorshipLevels } from './sponsorshipLevels.seed.js';
import { seedSponsorshipPackages } from './sponsorshipPackages.seed.js';
import { seedSystemTags } from './systemTags.seed.js';
import { seedSystemUser } from './systemUser.seed.js';
import { seedUsers } from './users.seed.js';

/**
 * Executes all required seeds in the correct order.
 *
 * Required seeds contain core system data that is essential for the application
 * to function properly. This includes:
 * - System user (SPEC-086 R-1) — must run first; referenced as assignedById by tags
 * - Users (excluding super admin)
 * - Role permissions
 * - Amenities and features
 * - Attractions
 * - Points of interest (HOS-113)
 * - Destinations with their relationships (attractions + points of interest)
 * - Sponsorship levels and packages
 * - Exchange rate configuration and initial rates
 * - Revalidation configuration per entity type
 *
 * The seeds are executed in a specific order to ensure that:
 * - System user exists before any seed that needs assignedById
 * - Dependencies are available before they're needed
 * - ID mappings are established for relationship building
 * - The super admin actor is available for all operations
 *
 * @param context - Seed context with configuration and utilities
 * @returns The steps that failed (only non-empty under `continueOnError`, where every step runs
 *   regardless of earlier failures; the caller must turn a non-empty list into a non-zero exit)
 *
 * @example
 * ```typescript
 * await runRequiredSeeds(seedContext);
 * // Executes in order:
 * // 1. System user (SPEC-086 R-1, non-loginable, used as assignedById)
 * // 2. INTERNAL tags (SPEC-086 R-2)
 * // 3. SYSTEM tags (SPEC-086 R-3)
 * // 4. PostTags (SPEC-086 R-4)
 * // 5. Users (excluding super admin)
 * // 6. Role permissions
 * // 7. Amenities
 * // 8. Features
 * // 9. Attractions
 * // 9.1 POI categories catalog (HOS-139)
 * // 9.2 Points of interest (HOS-113)
 * // 9.3 POI category backfill for the 12 existing POIs (HOS-139)
 * // 10. Destinations with attractions + points of interest
 * // 11. Sponsorship levels
 * // 12. Sponsorship packages
 * // 13. Exchange rate config
 * // 14. Exchange rates
 * // 15. Revalidation config
 * // 16. AI prompt versions (default system prompts)
 * // 17. AI settings costCeilings defaults (SPEC-211 T-002)
 * // 18. Social automation catalog (SPEC-254 T-015)
 * ```
 *
 * @throws {Error} The first failing step's error, when continueOnError is false
 */
export async function runRequiredSeeds(context: SeedContext): Promise<{
    /** Steps that failed under `continueOnError`; always empty otherwise (a failure throws). */
    readonly failedSteps: readonly FailedRequiredSeedStep[];
}> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  INITIALIZING REQUIRED DATA LOAD`);

    // Each entry is isolated by `runRequiredSteps`: with `continueOnError` a failing step
    // no longer cancels the ones after it (HOS-735). Order below IS the dependency order.
    const steps: readonly RequiredSeedStep[] = [
        // 1. Seed the reserved system user — must be first because downstream seeds
        //    (INTERNAL tags, SYSTEM tags, PostTags) reference SYSTEM_USER_ID as assignedById.
        { name: 'SystemUser', run: () => seedSystemUser() },

        // 2. Seed INTERNAL tags (SPEC-086 R-2) — admin-only operational labels.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        { name: 'InternalTags', run: () => seedInternalTags() },

        // 3. Seed SYSTEM tags (SPEC-086 R-3) — platform-wide organizational tags.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        { name: 'SystemTags', run: () => seedSystemTags() },

        // 4. Seed PostTags (SPEC-086 R-4) — public SEO-driven blog post taxonomy.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        { name: 'PostTags', run: () => seedPostTags() },

        // Super admin already loaded in main context
        // 5. Load remaining users (excluding super admin)
        { name: 'Users', run: () => seedUsers(context) },

        // 3. Load role permissions (after users to have the actor)
        { name: 'RolePermissions', run: () => seedRolePermissions() },

        // 3.1 Seed moderation bootstrap data (SPEC-195)
        { name: 'ContentModerationData', run: () => seedContentModerationData() },

        // 4. Load amenities (before attractions to have ID mapping)
        { name: 'Amenities', run: () => seedAmenities(context) },

        // 5. Load features (before attractions to have ID mapping)
        { name: 'Features', run: () => seedFeatures(context) },

        // 6. Load attractions (before destinations to have ID mapping)
        { name: 'Attractions', run: () => seedAttractions(context) },

        // 6.05 Load the POI category catalog (HOS-139) — a standalone catalog,
        //      independent of points of interest or destinations. Must run
        //      before the backfill step below (6.2), and before points of
        //      interest for a stable, predictable ordering, though the two
        //      seeds have no direct dependency on each other.
        { name: 'PoiCategories', run: () => seedPoiCategories(context) },

        // 6.1 Load points of interest (HOS-113) — before destinations, same
        //     reason as attractions: the destination↔POI relationship seed
        //     step (run as part of seedDestinations below) needs the POI
        //     seed-id → real-id mapping already populated.
        { name: 'PointsOfInterest', run: () => seedPointsOfInterest(context) },

        // 6.2 Backfill primary categories for the 12 existing POIs (HOS-139
        //     spec §6.3/§7.4). Must run AFTER both 6.05 (categories exist)
        //     and 6.1 (POIs exist) — resolves both by `slug`.
        { name: 'PoiCategoryBackfill', run: () => seedPoiCategoryBackfill(context) },

        // 7. Load destinations (uses ID mapping for attraction + POI relationships)
        { name: 'Destinations', run: () => seedDestinations(context) },

        // 8. Load sponsorship levels (before packages to have ID mapping)
        { name: 'SponsorshipLevels', run: () => seedSponsorshipLevels(context) },

        // 9. Load sponsorship packages (uses ID mapping for eventLevelId)
        { name: 'SponsorshipPackages', run: () => seedSponsorshipPackages(context) },

        // 10. Load exchange rate config (before rates to have config available)
        { name: 'ExchangeRateConfig', run: () => seedExchangeRateConfig(context) },

        // 11. Load exchange rates (initial reference rates)
        { name: 'ExchangeRates', run: () => seedExchangeRates(context) },

        // 12. Load revalidation config (per-entity-type ISR configuration)
        { name: 'RevalidationConfig', run: () => seedRevalidationConfig(context) },

        // 13. Load AI prompt defaults (system prompts for all AI features)
        { name: 'AiPrompts', run: () => seedAiPrompts() },

        // 14. Seed AI settings costCeilings defaults (SPEC-211 T-002)
        //     Idempotent: skips if costCeilings is already set by an operator.
        { name: 'AiSettings', run: () => seedAiSettings() },

        // 15. Seed social automation catalog (SPEC-254 T-015)
        //     Platforms, platform-formats, settings, campaign, batch, audiences,
        //     footer, hashtag-sets, hashtags. All idempotent, model-direct.
        { name: 'SocialAutomation', run: () => seedSocialAutomation() }
    ];

    let failedSteps: readonly FailedRequiredSeedStep[] = [];

    try {
        ({ failedSteps } = await runRequiredSteps({
            steps,
            continueOnError: context.continueOnError
        }));

        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsole: seed script uses console.log for visual spacing in terminal output
        console.log('\n\n');
        if (failedSteps.length === 0) {
            logger.success({ msg: `${STATUS_ICONS.Success}  REQUIRED DATA LOAD COMPLETED` });
        } else {
            logger.error(
                `${STATUS_ICONS.Error}  REQUIRED DATA LOAD COMPLETED WITH ${failedSteps.length} FAILED STEP(S)`
            );
            for (const failed of failedSteps) {
                logger.error(`   - ${failed.name}: ${describeError(failed.error).message}`);
            }
        }
    } catch (error) {
        // Only reachable with `continueOnError: false`: the first failing step aborts.
        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsole: seed script uses console.log for visual spacing in terminal output
        console.log('\n\n');
        logger.error(`${STATUS_ICONS.Error}  REQUIRED DATA LOAD INTERRUPTED`);
        logger.error(`   Error: ${describeError(error).message}`);
        throw error;
    } finally {
        // Always show summary, regardless of errors
        summaryTracker.print();
    }

    return { failedSteps };
}
