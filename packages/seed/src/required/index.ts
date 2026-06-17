import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAiPrompts } from './aiPrompts.seed.js';
import { seedAiSettings } from './aiSettings.seed.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedBillingAddons } from './billingAddons.seed.js';
import { seedBillingEntitlements } from './billingEntitlements.seed.js';
import { seedBillingLimits } from './billingLimits.seed.js';
import { seedBillingPlans } from './billingPlans.seed.js';
import { seedBillingPromoCodes } from './billingPromoCodes.seed.js';
import { seedCommercePlan } from './commercePlan.seed.js';
import { seedContentModerationData } from './contentModeration.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedExchangeRateConfig } from './exchangeRateConfig.seed.js';
import { seedExchangeRates } from './exchangeRates.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedInternalTags } from './internalTags.seed.js';
import { seedPostTags } from './postTags.seed.js';
import { seedRevalidationConfig } from './revalidationConfig.seed.js';
import { seedRolePermissions } from './rolePermissions.seed.js';
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
 * - Destinations with their relationships
 * - Sponsorship levels and packages
 * - Billing entitlements, limits, plans, and add-ons
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
 * @returns Promise that resolves when all required seeds are complete
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
 * // 10. Destinations with attractions
 * // 11. Sponsorship levels
 * // 12. Sponsorship packages
 * // 13. Billing entitlements
 * // 14. Billing limits
 * // 15. Billing plans
 * // 16. Billing add-ons
 * // 17. Billing promo codes
 * // 18. Exchange rate config
 * // 19. Exchange rates
 * // 20. Revalidation config
 * // 21. AI prompt versions (default system prompts)
 * // 22. AI settings costCeilings defaults (SPEC-211 T-002)
 * ```
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runRequiredSeeds(context: SeedContext): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  INITIALIZING REQUIRED DATA LOAD`);

    try {
        // 1. Seed the reserved system user — must be first because downstream seeds
        //    (INTERNAL tags, SYSTEM tags, PostTags) reference SYSTEM_USER_ID as assignedById.
        await seedSystemUser();

        // 2. Seed INTERNAL tags (SPEC-086 R-2) — admin-only operational labels.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        await seedInternalTags();

        // 3. Seed SYSTEM tags (SPEC-086 R-3) — platform-wide organizational tags.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        await seedSystemTags();

        // 4. Seed PostTags (SPEC-086 R-4) — public SEO-driven blog post taxonomy.
        //    Must run after system user (createdById = SYSTEM_USER_ID).
        await seedPostTags();

        // Super admin already loaded in main context
        // 5. Load remaining users (excluding super admin)
        await seedUsers(context);

        // 3. Load role permissions (after users to have the actor)
        await seedRolePermissions();

        // 3.1 Seed moderation bootstrap data (SPEC-195)
        await seedContentModerationData();

        // 4. Load amenities (before attractions to have ID mapping)
        await seedAmenities(context);

        // 5. Load features (before attractions to have ID mapping)
        await seedFeatures(context);

        // 6. Load attractions (before destinations to have ID mapping)
        await seedAttractions(context);

        // 7. Load destinations (uses ID mapping for relationships)
        await seedDestinations(context);

        // 8. Load sponsorship levels (before packages to have ID mapping)
        await seedSponsorshipLevels(context);

        // 9. Load sponsorship packages (uses ID mapping for eventLevelId)
        await seedSponsorshipPackages(context);

        // 10. Load billing entitlements (before plans to have entitlements available)
        await seedBillingEntitlements(context);

        // 11. Load billing limits (before plans to have limit definitions available)
        await seedBillingLimits(context);

        // 12. Load billing plans (uses entitlements and limits)
        await seedBillingPlans(context);

        // 12.1 Load the commerce-listing plan (SPEC-239 T-049). Separate from
        //      ALL_PLANS so it stays excluded from accommodation plan lists;
        //      stamps billing_plans.product_domain='commerce'.
        await seedCommercePlan(context);

        // 13. Load billing add-ons (after plans, uses entitlements and limits)
        await seedBillingAddons(context);

        // 14. Load billing promo codes (default discount codes)
        await seedBillingPromoCodes(context);

        // 15. Load exchange rate config (before rates to have config available)
        await seedExchangeRateConfig(context);

        // 16. Load exchange rates (initial reference rates)
        await seedExchangeRates(context);

        // 17. Load revalidation config (per-entity-type ISR configuration)
        await seedRevalidationConfig(context);

        // 18. Load AI prompt defaults (system prompts for all AI features)
        await seedAiPrompts();

        // 19. Seed AI settings costCeilings defaults (SPEC-211 T-002)
        //     Idempotent: skips if costCeilings is already set by an operator.
        await seedAiSettings();

        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: seed script uses console.log for visual spacing in terminal output
        console.log('\n\n');
        logger.success({ msg: `${STATUS_ICONS.Success}  REQUIRED DATA LOAD COMPLETED` });
    } catch (error) {
        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: seed script uses console.log for visual spacing in terminal output
        console.log('\n\n');
        logger.error(`${STATUS_ICONS.Error}  REQUIRED DATA LOAD INTERRUPTED`);
        logger.error(`   Error: ${(error as Error).message}`);

        // If we shouldn't continue on error, re-throw the exception
        if (!context.continueOnError) {
            throw error;
        }
    } finally {
        // Always show summary, regardless of errors
        summaryTracker.print();
    }
}
