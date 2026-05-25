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
import { CloudinaryProvider, resolveEnvironment } from '@repo/media/server';
import { runExampleSeeds } from './example/index.js';
import { runRequiredSeeds } from './required/index.js';
import { runTestUserSeeds } from './test-users/index.js';
import { DEFAULT_CACHE_PATH, flushCache, readCache } from './utils/cloudinary-cache.js';
import { closeSeedDb, initSeedDb } from './utils/db.js';
import { resetDatabase } from './utils/dbReset';
import { errorHistory } from './utils/errorHistory.js';
import { STATUS_ICONS } from './utils/icons.js';
import { logger } from './utils/logger.js';
import { createImageProcessingCounters, createSeedContext } from './utils/seedContext.js';
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
    /**
     * Whether to run the SPEC-143 test-users seed group (local dev only).
     * Intentionally separate from `example` so staging/prod seed runs never
     * include these accounts.
     */
    testUsers?: boolean;
    /** Whether to reset the database before seeding */
    reset?: boolean;
    /** Whether to rollback on error (incompatible with continueOnError) */
    rollbackOnError?: boolean;
    /** Whether to continue processing when encountering errors */
    continueOnError?: boolean;
    /** List of entities to exclude from seeding */
    exclude?: string[];
    /**
     * When `true`, fetch/upload failures on required-source images are tolerated
     * (warn + keep original URL) instead of aborting the run. Maps to the CLI
     * flag `--allow-required-fallback` (GAP-078-036 / GAP-078-116).
     */
    allowRequiredFallback?: boolean;
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
    const {
        required,
        example,
        testUsers,
        reset,
        exclude = [],
        continueOnError = false,
        allowRequiredFallback = false
    } = options;

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
    const mediaEnv = resolveEnvironment();

    let imageProvider: CloudinaryProvider | undefined;
    if (cloudName && apiKey && apiSecret) {
        imageProvider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
        logger.info('[seed] Cloudinary configured — seed images will be uploaded.');
    } else {
        logger.info('[seed] Cloudinary env vars not configured -- images will use original URLs');
    }

    const imageCache = imageProvider ? readCache(DEFAULT_CACHE_PATH) : undefined;
    const imageCounters = createImageProcessingCounters();

    // Create seed context
    const seedContext = createSeedContext({
        continueOnError,
        resetDatabase: reset || false,
        exclude,
        imageProvider,
        imageCache,
        imageCachePath: imageProvider ? DEFAULT_CACHE_PATH : undefined,
        imageEnv: mediaEnv,
        allowRequiredFallback,
        imageCounters
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

        // Validate all manifests once at the beginning.
        // testUsers does NOT use the manifest system, so it's excluded here.
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

        // Load super admin if necessary (for example/required seeds or if it doesn't exist).
        // testUsers does NOT require a super-admin actor — it inserts via UserModel directly.
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
            seedContext.seedSource = 'required';
            await runRequiredSeeds(seedContext);
        }

        if (example) {
            seedContext.seedSource = 'example';
            await runExampleSeeds(seedContext);
        }

        if (testUsers) {
            // Local-dev-only group for SPEC-143 Block 1. Requires `--required`
            // to have been run previously (billingPlans.seed.ts must have
            // seeded the plan slugs the test users subscribe to).
            seedContext.seedSource = 'example';
            await runTestUserSeeds(seedContext);
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

        // GAP-078-033 — deferred cache flush. Every `updateCacheEntry` call
        // during the run only mutated the in-memory `imageCache`; write the
        // accumulated state to disk exactly once here, regardless of whether
        // the run succeeded or threw. Failure during flush must not mask a
        // real seed error, so we log and swallow.
        if (imageProvider && imageCache) {
            try {
                flushCache(DEFAULT_CACHE_PATH, imageCache);
            } catch (flushError) {
                logger.warn(
                    `[seed:images] Failed to flush cloudinary cache: ${flushError instanceof Error ? flushError.message : String(flushError)}`
                );
            }
        }

        // Print final summary with execution time and error history
        summaryTracker.print();
        errorHistory.printSummary();

        // Print image processing tally (GAP-078-036)
        logger.info(
            `[seed:images] tally uploaded=${imageCounters.uploaded} cached=${imageCounters.cached} failures=${imageCounters.failures} skippedExample=${imageCounters.skippedExample}`
        );
    }
}
