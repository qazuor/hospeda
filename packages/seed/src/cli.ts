#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Result of evaluating the production safety gate for destructive cleanup
 * operations such as `pnpm seed --clean-images`.
 */
export interface ProdCleanupGateResult {
    /** Whether the operation is allowed to proceed. */
    readonly allowed: boolean;
    /** Human-readable reason when {@link allowed} is `false`. */
    readonly reason?: string;
}

/**
 * Pure helper that decides whether a destructive cleanup operation is allowed
 * to run, given a snapshot of the relevant environment variables.
 *
 * GAP-078-117 / GAP-078-234: in any production-like environment
 * (`VERCEL_ENV=production` OR `NODE_ENV=production`) the operation MUST be
 * explicitly opted into via `HOSPEDA_ALLOW_PROD_CLEANUP=true`. Any other
 * value (including unset, `'1'`, `'yes'`) is rejected.
 *
 * @param env - The environment snapshot to evaluate (defaults to `process.env`).
 * @returns A {@link ProdCleanupGateResult} describing the decision.
 */
export function evaluateProdCleanupGate(
    env: NodeJS.ProcessEnv = process.env
): ProdCleanupGateResult {
    const isProd = env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
    if (!isProd) {
        return { allowed: true };
    }
    if (env.HOSPEDA_ALLOW_PROD_CLEANUP === 'true') {
        return { allowed: true };
    }
    return {
        allowed: false,
        reason: 'Refusing to delete Cloudinary assets in production. Set HOSPEDA_ALLOW_PROD_CLEANUP=true to override.'
    };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * True when this module is being executed as a CLI entry point (not imported
 * as a library). Side effects (dotenv loading, DB import, runSeed) only run
 * in that case so unit tests can safely import {@link evaluateProdCleanupGate}.
 */
const IS_CLI_ENTRY = process.argv[1]
    ? path.resolve(process.argv[1]) === path.resolve(__filename)
    : false;

if (IS_CLI_ENTRY) {
    // Dynamic imports keep heavy side-effecting modules (dotenv, @repo/db,
    // seed runner) out of the dependency graph for library consumers.
    const { config } = await import('dotenv');

    // Per-app env strategy (SPEC-035): HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
    // Cloudinary vars (HOSPEDA_CLOUDINARY_*) also live in this file.
    config({ path: path.resolve(__dirname, '../../../apps/api/.env.local') });

    const { dbLogger } = await import('@repo/db');
    const { runSeed } = await import('./index.js');
    const { DEFAULT_CACHE_PATH, deleteCache } = await import('./utils/cloudinary-cache.js');
    const { STATUS_ICONS } = await import('./utils/icons.js');
    const { logger } = await import('./utils/logger.js');

    dbLogger.log(!!process.env.HOSPEDA_DATABASE_URL, '🔍 CLI: HOSPEDA_DATABASE_URL loaded');

    // Basic CLI argument parsing
    const args = process.argv.slice(2);

    /** CLI options parsed from command line arguments. */
    const options = {
        required: args.includes('--required'),
        example: args.includes('--example'),
        reset: args.includes('--reset'),
        migrate: args.includes('--migrate'),
        rollbackOnError: args.includes('--rollbackOnError'),
        continueOnError: args.includes('--continueOnError'),
        cleanImages: args.includes('--clean-images'),
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
     */
    const handleCleanImages = async (): Promise<void> => {
        const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
        const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
        const nodeEnv = process.env.NODE_ENV ?? 'development';

        // GAP-078-117 / GAP-078-234: production safety gate.
        const gate = evaluateProdCleanupGate(process.env);
        if (!gate.allowed) {
            logger.error(`${STATUS_ICONS.Error} [seed:clean-images] ${gate.reason}`);
            process.exit(1);
        }

        if (cloudName && apiKey && apiSecret) {
            try {
                const { CloudinaryProvider } = await import('@repo/media/server');
                const provider = new CloudinaryProvider({ cloudName, apiKey, apiSecret });
                const prefix = `hospeda/${nodeEnv}/seed/`;
                logger.info(
                    `[seed:clean-images] Deleting Cloudinary assets under prefix: ${prefix}`
                );
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
    };

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
}
