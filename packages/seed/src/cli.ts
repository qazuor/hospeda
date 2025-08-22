#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Load environment variables first
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../../.env.local') });

import { dbLogger } from '@repo/db';
import { runSeed } from './index.js';
import { STATUS_ICONS } from './utils/icons.js';
import { logger } from './utils/logger.js';

dbLogger.log(!!process.env.DATABASE_URL, '🔍 CLI: DATABASE_URL loaded');

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
 * Main CLI entry point that parses arguments and executes the seed process
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
 * ```
 */
try {
    runSeed(options);
} catch (err) {
    // 🔍 DISTINCTIVE LOG: main CLI
    logger.error(`${STATUS_ICONS.Debug} [MAIN_CLI] Error at the main process level`);

    logger.error('🧨 Error during seed process:');
    logger.error(String(err));
    process.exit(1);
}
