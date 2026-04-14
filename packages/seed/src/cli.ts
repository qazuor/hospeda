#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Load environment variables first
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per-app env strategy (SPEC-035): HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
// Cloudinary vars (HOSPEDA_CLOUDINARY_*) also live in this file.
config({ path: path.resolve(__dirname, '../../../apps/api/.env.local') });

import { dbLogger } from '@repo/db';
import { runSeed } from './index.js';
import { DEFAULT_CACHE_PATH, deleteCache } from './utils/cloudinary-cache.js';
import { STATUS_ICONS } from './utils/icons.js';
import { logger } from './utils/logger.js';

dbLogger.log(!!process.env.HOSPEDA_DATABASE_URL, '🔍 CLI: HOSPEDA_DATABASE_URL loaded');

// Basic CLI argument parsing
const args = process.argv.slice(2);

/**
 * CLI options parsed from command line arguments
 */
const options = {
    /** Whether to run required seeds */
    required: args.includes('--required'),
    /** Whether to run example seeds */
    example: args.includes('--example'),
    /** Whether to reset database before seeding */
    reset: args.includes('--reset'),
    /** Whether to run migrations before seeding */
    migrate: args.includes('--migrate'),
    /** Whether to rollback on error (incompatible with continueOnError) */
    rollbackOnError: args.includes('--rollbackOnError'),
    /** Whether to continue processing when encountering errors */
    continueOnError: args.includes('--continueOnError'),
    /** Whether to delete all seed images from Cloudinary and clear local cache */
    cleanImages: args.includes('--clean-images'),
    /** List of entities to exclude from seeding */
    exclude: [] as string[]
};

// Validate incompatible flags
if (options.rollbackOnError && options.continueOnError) {
    logger.error(
        `${STATUS_ICONS.Error} Cannot use --rollbackOnError and --continueOnError at the same time.`
    );
    process.exit(1);
}

// Parse --exclude roles,permissions
const excludeArg = args.find((arg) => arg.startsWith('--exclude='));
if (excludeArg) {
    const list = excludeArg.replace('--exclude=', '');
    options.exclude = list.split(',').map((s) => s.trim());
}

/**
 * Handles the --clean-images flag.
 *
 * When Cloudinary env vars are configured, deletes all seed images stored under
 * the `hospeda/{env}/seed/` prefix via the Cloudinary Admin API. Always deletes
 * the local cache file regardless of Cloudinary configuration.
 *
 * @returns Promise that resolves when cleanup is complete
 */
async function handleCleanImages(): Promise<void> {
    const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
    const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
    const nodeEnv = process.env.NODE_ENV ?? 'development';

    if (cloudName && apiKey && apiSecret) {
        try {
            const { CloudinaryProvider } = await import('@repo/media');
            const provider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
            const prefix = `hospeda/${nodeEnv}/seed/`;
            logger.info(`[seed:clean-images] Deleting Cloudinary assets under prefix: ${prefix}`);
            await provider.deleteByPrefix({ prefix });
            logger.info('[seed:clean-images] Cloudinary assets deleted.');
        } catch (error) {
            logger.warn(
                `[seed:clean-images] Failed to delete Cloudinary assets: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    } else {
        logger.info(
            '[seed:clean-images] Cloudinary env vars not configured — skipping remote deletion.'
        );
    }

    deleteCache(DEFAULT_CACHE_PATH);
    logger.info('[seed:clean-images] Local image cache deleted.');
}

/**
 * Main CLI entry point that parses arguments and executes the seed process.
 *
 * @example
 * ```bash
 * # Run required seeds
 * pnpm seed --required
 *
 * # Run example seeds with database reset
 * pnpm seed --example --reset
 *
 * # Run with error continuation and exclusions
 * pnpm seed --required --continueOnError --exclude=users,posts
 *
 * # Clean all seed images from Cloudinary and reset local cache
 * pnpm seed --clean-images
 * ```
 */
try {
    if (options.cleanImages) {
        handleCleanImages().catch((err) => {
            logger.error(`${STATUS_ICONS.Error} Error during image cleanup: ${String(err)}`);
            process.exit(1);
        });
    } else {
        runSeed(options);
    }
} catch (err) {
    // 🔍 DISTINCTIVE LOG: main CLI
    logger.error(`${STATUS_ICONS.Debug} [MAIN_CLI] Error at the main process level`);

    logger.error('🧨 Error during seed process:');
    logger.error(String(err));
    process.exit(1);
}
