import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';
import { seedAmenities } from './amenities.seed.js';
import { seedAttractions } from './attractions.seed.js';
import { seedDestinations } from './destinations.seed.js';
import { seedFeatures } from './features.seed.js';
import { seedRolePermissions } from './rolePermissions.seed.js';
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
