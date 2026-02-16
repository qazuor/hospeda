import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedBillingAddons } from './billingAddons.seed.js';
import { seedBillingEntitlements } from './billingEntitlements.seed.js';
import { seedBillingLimits } from './billingLimits.seed.js';
import { seedBillingPlans } from './billingPlans.seed.js';
import { seedBillingPromoCodes } from './billingPromoCodes.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedExchangeRateConfig } from './exchangeRateConfig.seed.js';
import { seedExchangeRates } from './exchangeRates.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedRolePermissions } from './rolePermissions.seed.js';
import { seedSponsorshipLevels } from './sponsorshipLevels.seed.js';
import { seedSponsorshipPackages } from './sponsorshipPackages.seed.js';
import { seedUsers } from './users.seed.js';

/**
 * Executes all required seeds in the correct order.
 *
 * Required seeds contain core system data that is essential for the application
 * to function properly. This includes:
 * - Users (excluding super admin)
 * - Role permissions
 * - Amenities and features
 * - Attractions
 * - Destinations with their relationships
 * - Sponsorship levels and packages
 * - Billing entitlements, limits, plans, and add-ons
 * - Exchange rate configuration and initial rates
 *
 * The seeds are executed in a specific order to ensure that:
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
 * // 1. Users (excluding super admin)
 * // 2. Role permissions
 * // 3. Amenities
 * // 4. Features
 * // 5. Attractions
 * // 6. Destinations with attractions
 * // 7. Sponsorship levels
 * // 8. Sponsorship packages
 * // 9. Billing entitlements
 * // 10. Billing limits
 * // 11. Billing plans
 * // 12. Billing add-ons
 * // 13. Billing promo codes
 * // 14. Exchange rate config
 * // 15. Exchange rates
 * ```
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runRequiredSeeds(context: SeedContext): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  INITIALIZING REQUIRED DATA LOAD`);

    try {
        // Super admin already loaded in main context
        // 1. Load remaining users (excluding super admin)
        await seedUsers(context);

        // 2. Load role permissions (after users to have the actor)
        await seedRolePermissions();

        // 3. Load amenities (before attractions to have ID mapping)
        await seedAmenities(context);

        // 4. Load features (before attractions to have ID mapping)
        await seedFeatures(context);

        // 5. Load attractions (before destinations to have ID mapping)
        await seedAttractions(context);

        // 6. Load destinations (uses ID mapping for relationships)
        await seedDestinations(context);

        // 7. Load sponsorship levels (before packages to have ID mapping)
        await seedSponsorshipLevels(context);

        // 8. Load sponsorship packages (uses ID mapping for eventLevelId)
        await seedSponsorshipPackages(context);

        // 9. Load billing entitlements (before plans to have entitlements available)
        await seedBillingEntitlements(context);

        // 10. Load billing limits (before plans to have limit definitions available)
        await seedBillingLimits(context);

        // 11. Load billing plans (uses entitlements and limits)
        await seedBillingPlans(context);

        // 12. Load billing add-ons (after plans, uses entitlements and limits)
        await seedBillingAddons(context);

        // 13. Load billing promo codes (default discount codes)
        await seedBillingPromoCodes(context);

        // 14. Load exchange rate config (before rates to have config available)
        await seedExchangeRateConfig(context);

        // 15. Load exchange rates (initial reference rates)
        await seedExchangeRates(context);

        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
        console.log('\n\n');
        logger.success({ msg: `${STATUS_ICONS.Success}  REQUIRED DATA LOAD COMPLETED` });
    } catch (error) {
        logger.info(`${separator}`);
        // biome-ignore lint/suspicious/noConsoleLog: <explanation>
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
