import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as envConfig } from 'dotenv';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST, before any other imports that use them
envConfig({
    path: path.resolve(__dirname, '../../../.env.local')
});

import { configureLogger } from '@repo/logger';
import { runExampleSeeds } from './example/index.js';
import { runRequiredSeeds } from './required/index.js';
import { closeSeedDb, initSeedDb } from './utils/db.js';
import { resetDatabase } from './utils/dbReset';
// import { runMigrations } from './utils/migrateRunner.js';
import { errorHistory } from './utils/errorHistory.js';
import { STATUS_ICONS } from './utils/icons.js';
import { logger } from './utils/logger.js';
import { createSeedContext } from './utils/seedContext.js';
import { summaryTracker } from './utils/summaryTracker.js';
import { loadSuperAdminAndGetActor } from './utils/superAdminLoader.js';
import { validateAllManifests } from './utils/validateAllManifests.js';

/**
 * Configuration options for the seed process
 */
type SeedOptions = {
    /** Whether to run required seeds (core system data) */
    required?: boolean;
    /** Whether to run example seeds (sample data) */
    example?: boolean;
    /** Whether to reset the database before seeding */
    reset?: boolean;
    /** Whether to run migrations before seeding */
    migrate?: boolean;
    /** Whether to rollback on error (incompatible with continueOnError) */
    rollbackOnError?: boolean;
    /** Whether to continue processing when encountering errors */
    continueOnError?: boolean;
    /** List of entities to exclude from seeding */
    exclude?: string[];
};

/**
 * Main seed execution function that orchestrates the entire seeding process.
 *
 * This function handles:
 * - Database initialization and cleanup
 * - Configuration validation
 * - Process timing
 * - Error handling and recovery
 * - Summary reporting
 *
 * @param options - Configuration options for the seed process
 * @returns Promise that resolves when seeding is complete
 *
 * @example
 * ```typescript
 * await runSeed({
 *   required: true,
 *   example: true,
 *   reset: true,
 *   continueOnError: false
 * });
 * ```
 *
 * @throws {Error} When seeding fails and continueOnError is false
 */
export async function runSeed(options: SeedOptions): Promise<void> {
    const { required, example, reset, migrate, exclude = [], continueOnError = false } = options;

    // Start execution timer and error tracking
    summaryTracker.startTimer();
    errorHistory.startTracking();

    // Configure logger to show complete logs during seeding
    configureLogger({
        TRUNCATE_LONG_TEXT: false,
        EXPAND_OBJECT_LEVELS: 3
    });

    // Initialize database
    initSeedDb();

    // Create seed context
    const seedContext = createSeedContext({
        continueOnError,
        resetDatabase: reset || false,
        runMigrations: migrate || false,
        exclude
    });

    logger.info('🚀 Starting seed process...');

    try {
        if (reset) {
            logger.info(
                `${STATUS_ICONS.Reset}  Executing reset${exclude.length > 0 ? ` (excluding: ${exclude.join(', ')})` : ''}`
            );
            try {
                await resetDatabase(exclude);
                summaryTracker.trackProcessStep(
                    'Reset DB',
                    'success',
                    'Database reset successfully'
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errorHistory.recordError('Database', 'Reset', 'Failed to reset database', error);
                summaryTracker.trackProcessStep(
                    'Reset DB',
                    'error',
                    'Error resetting database',
                    errorMessage
                );
                throw error;
            }
        }

        if (migrate) {
            // TODO: Implement migration runner
            // await runMigrations();
            logger.warn(`${STATUS_ICONS.Warning} Migration runner not implemented yet`);
            errorHistory.recordWarning(
                'Migrations',
                'System',
                'Migration runner not implemented yet'
            );
            summaryTracker.trackProcessStep(
                'Migrations',
                'warning',
                'Migration runner not implemented'
            );
        }

        // Validate all manifests once at the beginning
        if ((required || example) && seedContext.validateManifests) {
            try {
                await validateAllManifests(continueOnError);
                summaryTracker.trackProcessStep(
                    'Manifest Validation',
                    'success',
                    'All manifests validated successfully'
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errorHistory.recordError(
                    'Validation',
                    'Manifests',
                    'Failed to validate manifests',
                    error
                );
                summaryTracker.trackProcessStep(
                    'Manifest Validation',
                    'error',
                    'Error validating manifests',
                    errorMessage
                );
                if (!continueOnError) {
                    throw error;
                }
            }
        }

        // Load super admin if necessary (for example seeds or if it doesn't exist)
        if (example || required) {
            try {
                const superAdminActor = await loadSuperAdminAndGetActor();
                seedContext.actor = superAdminActor;
                summaryTracker.trackProcessStep(
                    'Super Admin',
                    'success',
                    'Super admin loaded/created successfully'
                );
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errorHistory.recordError(
                    'Users',
                    'SuperAdmin',
                    'Failed to load/create super admin',
                    error
                );
                summaryTracker.trackProcessStep(
                    'Super Admin',
                    'error',
                    'Error loading super admin',
                    errorMessage
                );
                throw error;
            }
        }

        if (required) {
            await runRequiredSeeds(seedContext);
        }

        if (example) {
            await runExampleSeeds(seedContext);
        }

        logger.success({ msg: `${STATUS_ICONS.Complete} Seed process complete.` });
        summaryTracker.trackProcessStep(
            'Complete Process',
            'success',
            'Seed completed successfully'
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errorHistory.recordError(
            'System',
            'MainProcess',
            'Seed process interrupted by error',
            error
        );
        summaryTracker.trackProcessStep(
            'Complete Process',
            'error',
            'Seed interrupted by error',
            errorMessage
        );

        // Show summary BEFORE final throw
        summaryTracker.print();
        errorHistory.printSummary();

        // Now throw the error
        throw error;
    } finally {
        // Stop tracking
        errorHistory.stopTracking();

        // Always close the connection
        await closeSeedDb();

        // Print final summary with execution time and error history
        summaryTracker.print();
        errorHistory.printSummary();
    }
}
