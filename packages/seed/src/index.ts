import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as envConfig } from 'dotenv';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per-app env strategy (SPEC-035): HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
// packages/seed has no env of its own; it borrows the API app's env file.
// Cloudinary vars (HOSPEDA_CLOUDINARY_*) also live in this file.
envConfig({
    path: path.resolve(__dirname, '../../../apps/api/.env.local')
});

import { configureLogger } from '@repo/logger';
import { CloudinaryProvider } from '@repo/media';
import { runExampleSeeds } from './example/index.js';
import { runRequiredSeeds } from './required/index.js';
import { DEFAULT_CACHE_PATH, readCache } from './utils/cloudinary-cache.js';
import { closeSeedDb, initSeedDb } from './utils/db.js';
import { resetDatabase } from './utils/dbReset';
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
 * - Optional Cloudinary image upload (when HOSPEDA_CLOUDINARY_* env vars are set)
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
    const { required, example, reset, exclude = [], continueOnError = false } = options;

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

    // Initialise Cloudinary provider if env vars are present (opt-in)
    const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
    const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
    const nodeEnv = process.env.NODE_ENV ?? 'development';

    let imageProvider: CloudinaryProvider | undefined;
    if (cloudName && apiKey && apiSecret) {
        imageProvider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
        logger.info('[seed] Cloudinary configured — seed images will be uploaded.');
    } else {
        logger.info('[seed] Cloudinary env vars not configured -- images will use original URLs');
    }

    const imageCache = imageProvider ? readCache(DEFAULT_CACHE_PATH) : undefined;

    // Create seed context
    const seedContext = createSeedContext({
        continueOnError,
        resetDatabase: reset || false,
        exclude,
        imageProvider,
        imageCache,
        imageCachePath: imageProvider ? DEFAULT_CACHE_PATH : undefined,
        imageEnv: nodeEnv
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
                // Register super admin in idMapper so accommodations (and other entities)
                // can reference "super-admin-user" as ownerId
                seedContext.idMapper.setMapping(
                    'users',
                    'super-admin-user',
                    superAdminActor.id,
                    'Super Admin'
                );
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
