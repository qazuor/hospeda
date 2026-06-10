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

/**
 * Input shape for {@link coerceResetImpliesCleanImages}.
 */
export interface ResetCoercionInput {
    /** Parsed value of `--reset`. */
    readonly reset: boolean;
    /** Parsed value of `--clean-images`. */
    readonly cleanImages: boolean;
}

/**
 * Output shape for {@link coerceResetImpliesCleanImages}.
 */
export interface ResetCoercionResult {
    /** Final value of `reset` (unchanged — passed through). */
    readonly reset: boolean;
    /** Final value of `cleanImages` after coercion. */
    readonly cleanImages: boolean;
    /** `true` when the helper had to force `cleanImages` on because of `reset`. */
    readonly coerced: boolean;
}

/**
 * GAP-078-006 + GAP-078-078 — pure flag coercion for `--reset` / `--clean-images`.
 *
 * When `reset` is `true`, `cleanImages` is forced to `true` so the Cloudinary
 * seed prefix (`hospeda/{env}/seed/`) is purged before the database is
 * reseeded; otherwise we'd leave orphan assets pointing at rows that no
 * longer exist. The flags are NOT mutually exclusive: passing both is valid,
 * passing only `--clean-images` is still a cleanup-only operation.
 *
 * The helper returns `coerced: true` only when it actually flipped the bit,
 * so the CLI can log the implicit behavior once at startup without spamming
 * when the user was already explicit.
 *
 * @param input - Raw parsed flags. See {@link ResetCoercionInput}.
 * @returns Coerced flags. See {@link ResetCoercionResult}.
 */
export function coerceResetImpliesCleanImages(input: ResetCoercionInput): ResetCoercionResult {
    const { reset, cleanImages } = input;
    if (reset && !cleanImages) {
        return { reset: true, cleanImages: true, coerced: true };
    }
    return { reset, cleanImages, coerced: false };
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
    const { resolveEnvironment } = await import('@repo/media/server');
    const { runSeed } = await import('./index.js');
    const { DEFAULT_CACHE_PATH, deleteCache, flushCache, readCache, validateCacheEntries } =
        await import('./utils/cloudinary-cache.js');
    const { STATUS_ICONS } = await import('./utils/icons.js');
    const { logger } = await import('./utils/logger.js');

    dbLogger.log(!!process.env.HOSPEDA_DATABASE_URL, '🔍 CLI: HOSPEDA_DATABASE_URL loaded');

    // Basic CLI argument parsing
    const args = process.argv.slice(2);

    /** CLI options parsed from command line arguments. */
    const options = {
        required: args.includes('--required'),
        example: args.includes('--example'),
        testUsers: args.includes('--test-users'),
        reset: args.includes('--reset'),
        migrate: args.includes('--migrate'),
        rollbackOnError: args.includes('--rollbackOnError'),
        continueOnError: args.includes('--continueOnError'),
        cleanImages: args.includes('--clean-images'),
        validateCache: args.includes('--validate-cache'),
        allowRequiredFallback: args.includes('--allow-required-fallback'),
        exclude: [] as string[]
    };

    // Validate incompatible flags
    if (options.rollbackOnError && options.continueOnError) {
        logger.error(
            `${STATUS_ICONS.Error} Cannot use --rollbackOnError and --continueOnError at the same time.`
        );
        process.exit(1);
    }

    // GAP-078-006 + GAP-078-078: --reset implies --clean-images.
    // Resetting the database without dropping the Cloudinary seed bucket
    // leaves orphan assets pointing at rows that no longer exist. The flags
    // are NOT mutually exclusive — see {@link coerceResetImpliesCleanImages}.
    const coercion = coerceResetImpliesCleanImages({
        reset: options.reset,
        cleanImages: options.cleanImages
    });
    options.cleanImages = coercion.cleanImages;
    if (coercion.coerced) {
        logger.info(
            '[seed] --reset implies --clean-images: enabling Cloudinary seed cleanup before reseeding.'
        );
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
        const mediaEnv = resolveEnvironment();

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
                const prefix = `hospeda/${mediaEnv}/seed/`;
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

    /**
     * GAP-078-079 — Maintenance-only handler for the `--validate-cache` flag.
     *
     * Loads the cloudinary cache, HEADs each cached URL, drops stale entries,
     * and flushes the cleaned cache back to disk. Sequential by design (this
     * is a maintenance flag, extra wall time is fine) so it does not add a
     * `p-limit` dependency. Independent of `--reset` and `--clean-images`.
     */
    const handleValidateCache = async (): Promise<void> => {
        const cache = readCache(DEFAULT_CACHE_PATH);
        const keys = Object.keys(cache);
        if (keys.length === 0) {
            logger.info('[seed:validate-cache] Cache is empty — nothing to validate.');
            return;
        }
        logger.info(`[seed:validate-cache] Validating ${keys.length} cached URL(s) via HEAD...`);
        const result = await validateCacheEntries({ cache });
        flushCache(DEFAULT_CACHE_PATH, cache);
        logger.info(
            `[seed:validate-cache] Done — checked=${result.checked} kept=${result.kept} removed=${result.removed}`
        );
    };

    try {
        if (options.validateCache) {
            // Maintenance-only mode: validate cache and exit. Runs BEFORE the
            // reset/clean branches so users can pass `--validate-cache` on its
            // own without kicking off a full seed.
            handleValidateCache().catch((err) => {
                logger.error(`${STATUS_ICONS.Error} Error during cache validation: ${String(err)}`);
                process.exit(1);
            });
        } else if (options.cleanImages && !options.reset) {
            // Cleanup-only mode: delete seed assets and exit without reseeding.
            handleCleanImages().catch((err) => {
                logger.error(`${STATUS_ICONS.Error} Error during image cleanup: ${String(err)}`);
                process.exit(1);
            });
        } else if (options.reset) {
            // Reset mode: clean Cloudinary seed assets FIRST, then run the
            // seed pipeline. This preserves the GAP-078-006/078 semantics
            // (reset implies a clean image bucket).
            handleCleanImages()
                .then(() => runSeed(options))
                .catch((err) => {
                    logger.error(`${STATUS_ICONS.Error} Error during reset+seed: ${String(err)}`);
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
