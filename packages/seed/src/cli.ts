#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedMigrationGroup } from './data-migrations/types.js';

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
 * (`NODE_ENV=production`) the operation MUST be explicitly opted into via
 * `HOSPEDA_ALLOW_PROD_CLEANUP=true`. Any other value (including unset, `'1'`,
 * `'yes'`) is rejected.
 *
 * @param env - The environment snapshot to evaluate (defaults to `process.env`).
 * @returns A {@link ProdCleanupGateResult} describing the decision.
 */
export function evaluateProdCleanupGate(
    env: NodeJS.ProcessEnv = process.env
): ProdCleanupGateResult {
    const isProd = env.NODE_ENV === 'production';
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

/**
 * Recognized values for {@link SeedMigrationGroup}, used at runtime to
 * validate the `--group=` flag (see {@link parseGroupFlag}).
 */
const SEED_MIGRATION_GROUPS = ['required', 'example'] as const;

/**
 * Narrows a raw CLI string to {@link SeedMigrationGroup}.
 */
function isSeedMigrationGroup(value: string): value is SeedMigrationGroup {
    return (SEED_MIGRATION_GROUPS as readonly string[]).includes(value);
}

/**
 * Input for {@link deriveMigrationGroup}.
 */
export interface DeriveMigrationGroupInput {
    /** Parsed value of `--required`. */
    readonly required: boolean;
    /** Parsed value of `--example`. */
    readonly example: boolean;
}

/**
 * HOS-25 T-017 — derives the `group` filter for `db:seed:migrate` /
 * `db:seed:migrate:status` from the CLI's existing `--required`/`--example`
 * toggle pair (the same flags the main seed command already parses).
 *
 * Passing exactly one of the two flags scopes the command to that single
 * group. Passing neither, or both, runs/reports on every group — mirroring
 * the main seed command's own "no group flags = do everything" default.
 *
 * @param input - See {@link DeriveMigrationGroupInput}.
 * @returns `'required'` or `'example'` when exactly one flag is set,
 *   otherwise `undefined` (no group filter — every group is included).
 *
 * @example
 * ```ts
 * deriveMigrationGroup({ required: true, example: false });  // 'required'
 * deriveMigrationGroup({ required: false, example: false }); // undefined
 * deriveMigrationGroup({ required: true, example: true });   // undefined
 * ```
 */
export function deriveMigrationGroup(
    input: DeriveMigrationGroupInput
): SeedMigrationGroup | undefined {
    const { required, example } = input;
    if (required && !example) {
        return 'required';
    }
    if (example && !required) {
        return 'example';
    }
    return undefined;
}

/**
 * HOS-25 T-017 — parses an explicit `--group=required|example` CLI flag.
 *
 * Used only by `db:seed:make`, which (unlike `db:seed:migrate` /
 * `db:seed:migrate:status`) needs a single definite group to stamp into the
 * scaffolded migration's `meta.group` rather than a run/report filter — so it
 * uses its own `--group=` value flag instead of the `--required`/`--example`
 * toggle pair (see {@link deriveMigrationGroup}).
 *
 * @param args - Raw `process.argv.slice(2)` arguments.
 * @returns The parsed group, or `undefined` when the flag is absent (callers
 *   should fall back to `makeMigration`'s own `'required'` default in that
 *   case).
 * @throws {Error} If the flag is present with a value other than
 *   `'required'` or `'example'`.
 */
export function parseGroupFlag(args: readonly string[]): SeedMigrationGroup | undefined {
    const groupArg = args.find((arg) => arg.startsWith('--group='));
    if (!groupArg) {
        return undefined;
    }
    const value = groupArg.slice('--group='.length);
    if (!isSeedMigrationGroup(value)) {
        throw new Error(`Invalid --group value '${value}'. Expected 'required' or 'example'.`);
    }
    return value;
}

/**
 * HOS-25 T-017 — extracts the positional value immediately following a given
 * flag token, e.g. `parsePositionalAfterFlag(['--data-migrate-make',
 * 'my-slug'], '--data-migrate-make') === 'my-slug'`.
 *
 * Used for `db:seed:make <slug>`, whose slug is a bare positional argument
 * rather than a `--flag=value` pair — every other flag in this CLI is either
 * a boolean toggle (`args.includes(...)`) or a `--key=value` pair
 * (`--exclude=`, `--group=`), so this is the one place a positional value is
 * needed.
 *
 * @param args - Raw `process.argv.slice(2)` arguments.
 * @param flag - The flag token to look for (e.g. `'--data-migrate-make'`).
 * @returns The next argument after `flag`, or `undefined` when `flag` is
 *   absent, is the last argument, or is immediately followed by another flag
 *   (starting with `--`).
 */
export function parsePositionalAfterFlag(
    args: readonly string[],
    flag: string
): string | undefined {
    const flagIndex = args.indexOf(flag);
    if (flagIndex === -1) {
        return undefined;
    }
    const next = args[flagIndex + 1];
    if (!next || next.startsWith('--')) {
        return undefined;
    }
    return next;
}

/**
 * Options accepted by {@link handleDataMigrate}.
 */
export interface DataMigrateOptions {
    /** Scopes the run to a single group. Omit to run every pending migration. */
    readonly group?: SeedMigrationGroup;

    /**
     * Explicit opt-in to run destructive migrations in production. Wired to
     * the CLI's `--allow-destructive` flag.
     */
    readonly allowDestructive: boolean;

    /**
     * When `true`, records every currently pending migration as applied (via
     * `baselineStamp`) INSTEAD of running it — for use right after a fresh
     * `--reset --required --example` baseline seed, where the baseline
     * already produced the post-migration end state directly. Wired to the
     * CLI's `--baseline-stamp` flag.
     */
    readonly baselineStamp: boolean;
}

/**
 * HOS-25 T-017 — handles `db:seed:migrate` (`--data-migrate`): runs every
 * pending versioned seed data-migration, or (with `--baseline-stamp`)
 * records them as applied without ever calling their `up()`.
 *
 * Dynamically imports the underlying `runMigrations`/`baselineStamp`
 * functions (both of which transitively pull in `@repo/db`) so importing
 * this module as a library — e.g. from a unit test exercising
 * {@link deriveMigrationGroup} — never opens a database connection as a side
 * effect. Kept as an exported, pure-input function (rather than an inline
 * closure inside the `IS_CLI_ENTRY` block) so its dispatch logic is
 * unit-testable by mocking the two imported modules.
 *
 * @param options - See {@link DataMigrateOptions}.
 *
 * @example
 * ```ts
 * // CLI: pnpm --filter @repo/seed seed --data-migrate --required
 * await handleDataMigrate({ group: 'required', allowDestructive: false, baselineStamp: false });
 * ```
 */
export async function handleDataMigrate(options: DataMigrateOptions): Promise<void> {
    const { logger } = await import('./utils/logger.js');

    try {
        if (options.baselineStamp) {
            const { baselineStamp: runBaselineStamp } = await import(
                './data-migrations/baselineStamp.js'
            );
            const result = await runBaselineStamp({ group: options.group });
            logger.success({
                msg: `Baseline-stamped ${result.stamped.length} data-migration(s).`
            });
            return;
        }

        const { runMigrations } = await import('./data-migrations/runner.js');
        const result = await runMigrations({
            group: options.group,
            allowDestructive: options.allowDestructive,
            env: process.env
        });
        logger.success({
            msg: `Applied ${result.applied.length} data-migration(s) (${result.skipped.length} already up to date).`
        });
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

/**
 * Options accepted by {@link handleMigrateStatus}.
 */
export interface MigrateStatusOptions {
    /** Scopes the report to a single group. Omit to report on every group. */
    readonly group?: SeedMigrationGroup;
}

/**
 * HOS-25 T-017 — handles `db:seed:migrate:status` (`--data-migrate-status`):
 * prints the applied/pending status of every versioned seed data-migration.
 *
 * Uses `console.log` directly (rather than the seed logger) so the rendered
 * report is plain, unprefixed, script-friendly output.
 *
 * @param options - See {@link MigrateStatusOptions}.
 *
 * @example
 * ```ts
 * // CLI: pnpm --filter @repo/seed seed --data-migrate-status
 * await handleMigrateStatus({ group: undefined });
 * ```
 */
export async function handleMigrateStatus(options: MigrateStatusOptions): Promise<void> {
    const { getMigrationStatus, formatMigrationStatus } = await import(
        './data-migrations/status.js'
    );
    const status = await getMigrationStatus({ group: options.group });
    // biome-ignore lint/suspicious/noConsole: db:seed:migrate:status is a plain script-friendly report, not seed-logger output
    console.log(formatMigrationStatus(status));
}

/**
 * Options accepted by {@link handleMake}.
 */
export interface MakeOptions {
    /**
     * The migration's slug (kebab-case, e.g. `'remove-legacy-feature'`).
     * `undefined` when the CLI invocation omitted the positional argument —
     * the handler reports usage and exits rather than calling `makeMigration`
     * with a missing slug.
     */
    readonly slug: string | undefined;

    /**
     * Which data track to scaffold into. Omit to use `makeMigration`'s own
     * `'required'` default.
     */
    readonly group?: SeedMigrationGroup;

    /** Whether to scaffold the migration as destructive. */
    readonly destructive: boolean;
}

/**
 * HOS-25 T-017 — handles `db:seed:make <slug>` (`--data-migrate-make
 * <slug>`): scaffolds a new versioned seed data-migration file.
 *
 * Slugs must be kebab-case (lowercase, hyphen-separated, e.g.
 * `'remove-legacy-feature'`) — `makeMigration` silently lowercases uppercase
 * input but does NOT auto-convert camelCase or spaces, so a slug like
 * `'removeLegacyFeature'` is rejected rather than rewritten to
 * `'remove-legacy-feature'`.
 *
 * @param options - See {@link MakeOptions}.
 *
 * @example
 * ```ts
 * // CLI: pnpm --filter @repo/seed seed --data-migrate-make remove-legacy-feature --group=example
 * await handleMake({ slug: 'remove-legacy-feature', group: 'example', destructive: false });
 * ```
 */
export async function handleMake(options: MakeOptions): Promise<void> {
    const { logger } = await import('./utils/logger.js');

    if (!options.slug) {
        logger.error(
            "Usage: pnpm db:seed:make <slug> [--group=example] [--destructive]. Slugs must be kebab-case (lowercase, hyphen-separated, e.g. 'remove-legacy-feature') — uppercase input is silently lowercased, but camelCase/spaces are NOT auto-converted."
        );
        process.exit(1);
        return;
    }

    try {
        const { makeMigration } = await import('./data-migrations/make.js');
        const result = await makeMigration({
            slug: options.slug,
            group: options.group,
            destructive: options.destructive
        });
        logger.success({ msg: `Created data-migration: ${result.filePath}` });
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
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
        exclude: [] as string[],
        // HOS-25 T-017: versioned seed data-migration CLI surface.
        dataMigrate: args.includes('--data-migrate'),
        dataMigrateStatus: args.includes('--data-migrate-status'),
        dataMigrateMake: args.includes('--data-migrate-make'),
        baselineStamp: args.includes('--baseline-stamp'),
        allowDestructive: args.includes('--allow-destructive'),
        destructive: args.includes('--destructive')
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

    // HOS-25 T-017: `--data-migrate` / `--data-migrate-status` reuse the
    // existing --required/--example toggle pair to scope the group; `make`
    // uses its own `--group=` value flag plus a bare positional slug.
    const migrationGroup = deriveMigrationGroup({
        required: options.required,
        example: options.example
    });
    const makeGroup = parseGroupFlag(args);
    const makeSlug = parsePositionalAfterFlag(args, '--data-migrate-make');

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
        if (options.dataMigrateMake) {
            // HOS-25 T-017: `db:seed:make <slug>` — scaffold a new migration
            // file and exit. Runs before every other mode, since it never
            // touches the database or the seed pipeline.
            handleMake({
                slug: makeSlug,
                group: makeGroup,
                destructive: options.destructive
            }).catch((err) => {
                logger.error(
                    `${STATUS_ICONS.Error} Error scaffolding data-migration: ${String(err)}`
                );
                process.exit(1);
            });
        } else if (options.dataMigrateStatus) {
            // HOS-25 T-017: `db:seed:migrate:status` — print applied/pending
            // status and exit.
            handleMigrateStatus({ group: migrationGroup }).catch((err) => {
                logger.error(
                    `${STATUS_ICONS.Error} Error reading data-migration status: ${String(err)}`
                );
                process.exit(1);
            });
        } else if (options.dataMigrate) {
            // HOS-25 T-017: `db:seed:migrate` — run (or, with
            // `--baseline-stamp`, stamp) pending versioned seed
            // data-migrations and exit.
            handleDataMigrate({
                group: migrationGroup,
                allowDestructive: options.allowDestructive,
                baselineStamp: options.baselineStamp
            }).catch((err) => {
                logger.error(`${STATUS_ICONS.Error} Error running data-migrations: ${String(err)}`);
                process.exit(1);
            });
        } else if (options.validateCache) {
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
