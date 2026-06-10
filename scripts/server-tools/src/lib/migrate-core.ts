/**
 * Shared migration core — run `drizzle-kit migrate` + `apply-extras`
 * against a target database URL, with optional pre-migrate backup.
 *
 * Extracted so both `hops db-migrate` (T-008) and `hops db-seed --migrate`
 * (T-010) reuse the identical process. The VPS must NEVER use `drizzle-kit
 * push`; both callers go through this helper which uses `db:migrate`.
 *
 * Design notes:
 *   - Takes an already-built `databaseUrl` (caller has resolved container
 *     creds before calling — keeps this helper transport-agnostic).
 *   - The build step is the caller's responsibility (db-seed already has its
 *     own buildSeedDependencies; db-migrate calls buildDbDependencies).
 *   - The backup step is optional and caller-controlled (db-migrate passes
 *     a backup function when `--no-backup` is not set; db-seed skips it).
 *   - `die` on any step failure — no step is silent-success-on-error.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findContainer } from './container-lookup.ts';
import { runInContainer } from './docker.ts';
import { die, log } from './log.ts';
import { runner } from './runner.ts';
import { getDbCredentials } from './target.ts';
import type { Target } from './target.ts';

/**
 * Build the `@repo/db` package and its deps via turbo so `drizzle-kit
 * migrate` can find the compiled config and schema files.
 *
 * Uses `@repo/db^...` filter to build all DEPENDENCIES of `@repo/db` first,
 * then `@repo/db` itself (unlike db-seed which builds `@repo/seed^...`
 * because the seed has no build script of its own).
 */
export async function buildDbDependencies(repoRoot: string): Promise<void> {
    log.info('Building @repo/db dependencies (turbo, cached)...');
    const result = await runner.run(['pnpm', 'turbo', 'run', 'build', '--filter=@repo/db'], {
        cwd: repoRoot,
        inherit: true
    });
    if (result.exitCode !== 0) {
        die(
            `Build failed (exit ${result.exitCode}). drizzle-kit migrate requires the compiled schema. Inspect the output above; if the issue is transient, pass --no-build to skip.`
        );
    }
    log.ok('@repo/db built.');
}

/**
 * Run `pnpm --filter @repo/db db:migrate` (drizzle-kit migrate) against the
 * given database URL. This is the VERSIONED migration path — NOT push. Must
 * be the only schema-sync mechanism used on staging and prod.
 */
export async function runDbMigrate(params: {
    readonly repoRoot: string;
    readonly databaseUrl: string;
}): Promise<void> {
    log.info('Running drizzle-kit migrate (pnpm --filter @repo/db db:migrate)...');
    const result = await runner.run(['pnpm', '--filter', '@repo/db', 'db:migrate'], {
        cwd: params.repoRoot,
        inherit: true,
        env: { HOSPEDA_DATABASE_URL: params.databaseUrl }
    });
    if (result.exitCode !== 0) {
        die(
            `db:migrate failed (exit ${result.exitCode}). The schema is NOT in sync. Inspect the migration output above. If a backup was taken, use the rollback instructions to restore before retrying.`
        );
    }
    log.ok('drizzle-kit migrate completed.');
}

/**
 * Apply hospeda-side Postgres extras (triggers, materialized views, JSONB
 * CHECK constraints) that Drizzle cannot declare in its schema files.
 * The script is idempotent — safe to run repeatedly.
 */
export async function runApplyExtras(params: {
    readonly repoRoot: string;
    readonly databaseUrl: string;
}): Promise<void> {
    log.info('Applying Postgres extras (pnpm db:apply-extras)...');
    const result = await runner.run(['pnpm', 'db:apply-extras'], {
        cwd: params.repoRoot,
        inherit: true,
        env: { HOSPEDA_DATABASE_URL: params.databaseUrl }
    });
    if (result.exitCode !== 0) {
        die(
            `db:apply-extras failed (exit ${result.exitCode}). Triggers, matviews and JSONB CHECK constraints are not in sync. Inspect the output above; if you intentionally want to skip them, pass --no-apply-extras.`
        );
    }
    log.ok('Postgres extras applied.');
}

/**
 * Apply reset SQL files against the target's Postgres container via `docker
 * exec psql`. Runs 000-reset-schema.sql then 001-extensions.sql in order.
 *
 * Why docker exec (not the Postgres URL over TCP):
 *   - Exactly the same mechanism psql.ts uses — already battle-tested.
 *   - Connects via the Unix socket inside the container so password is not
 *     needed.
 *   - The reset SQL contains DDL that needs superuser privileges (DROP SCHEMA
 *     CASCADE, CREATE EXTENSION) — the container's `postgres` user has them.
 *   - Works even when the schema is in a broken state (no TCP-level auth deps).
 */
export async function runResetSql(params: {
    readonly repoRoot: string;
    readonly target: Target;
}): Promise<void> {
    const container = await findContainer('postgres');
    const credentials = getDbCredentials(params.target);
    const user = credentials.user;
    const db = credentials.database;

    const resetFiles = [
        {
            path: join(
                params.repoRoot,
                'packages',
                'db',
                'scripts',
                'reset',
                '000-reset-schema.sql'
            ),
            label: '000-reset-schema.sql'
        },
        {
            path: join(params.repoRoot, 'packages', 'db', 'scripts', 'reset', '001-extensions.sql'),
            label: '001-extensions.sql'
        }
    ];

    for (const { path, label } of resetFiles) {
        log.info(`Applying reset SQL: ${label}...`);
        let sql: string;
        try {
            sql = readFileSync(path, 'utf-8');
        } catch (err) {
            die(
                `Cannot read reset file '${path}': ${err instanceof Error ? err.message : String(err)}`
            );
        }
        const result = await runInContainer({
            container,
            argv: ['psql', '-U', user, '-d', db],
            input: sql
        });
        if (result.exitCode !== 0) {
            die(
                `Reset SQL '${label}' failed (exit ${result.exitCode}):\n${result.stderr.trim() || result.stdout.trim()}`
            );
        }
        log.ok(`${label} applied.`);
    }
}

/**
 * Full migration sequence: optionally reset -> migrate -> apply extras.
 * Called by both db-migrate and db-seed (--migrate flag).
 *
 * `backup` is an async thunk the caller passes when pre-migrate backup is
 * desired. It runs FIRST — before reset and migrate — so it captures the
 * current data. Backing up AFTER the reset would snapshot an already-empty
 * schema, making the backup worthless. Callers that don't want a backup pass
 * `undefined`.
 *
 * `throwOnError` (default `false`) controls failure behaviour:
 *   - When `false` (default): each internal step calls `die()` on failure,
 *     which writes to stderr and calls `process.exit(1)`. This is the
 *     original behaviour preserved for `db-migrate` and `db-seed`.
 *   - When `true`: failures throw an `Error` instead of exiting, so the
 *     caller can catch them, clean up resources, and print its own summary
 *     before exiting. Used by `db-migrate-test` so it can preserve and
 *     report the scratch DB on failure.
 */
export async function runMigrateSequence(params: {
    readonly repoRoot: string;
    readonly databaseUrl: string;
    readonly target: Target;
    readonly reset: boolean;
    readonly applyExtras: boolean;
    readonly backup: (() => Promise<void>) | undefined;
    readonly throwOnError?: boolean;
}): Promise<void> {
    /**
     * Fail helper — respects `throwOnError` so callers that need clean-up can
     * catch rather than having the process exit under their feet.
     * Return type is explicitly `never` so TypeScript narrows control flow
     * correctly at every call site (e.g. after a try/catch where fail() is
     * the only catch body, TS knows the variable assigned in the try is
     * always defined after the block).
     */
    function fail(message: string): never {
        if (params.throwOnError) {
            throw new Error(message);
        }
        return die(message);
    }

    // Backup FIRST — before ANY destructive step — so it captures the current
    // data. A backup taken after the reset would snapshot an empty schema.
    if (params.backup) {
        await params.backup();
    }

    if (params.reset) {
        // When throwOnError is false, runResetSql uses die() internally which
        // is exactly what we want. When throwOnError is true we inline the same
        // logic but route errors through fail() so the caller can catch them.
        if (params.throwOnError) {
            const container = await findContainer('postgres');
            const credentials = getDbCredentials(params.target);
            const resetFiles = [
                {
                    path: join(
                        params.repoRoot,
                        'packages',
                        'db',
                        'scripts',
                        'reset',
                        '000-reset-schema.sql'
                    ),
                    label: '000-reset-schema.sql'
                },
                {
                    path: join(
                        params.repoRoot,
                        'packages',
                        'db',
                        'scripts',
                        'reset',
                        '001-extensions.sql'
                    ),
                    label: '001-extensions.sql'
                }
            ];
            for (const { path, label } of resetFiles) {
                log.info(`Applying reset SQL: ${label}...`);
                let sql: string;
                try {
                    sql = readFileSync(path, 'utf-8');
                } catch (err) {
                    fail(
                        `Cannot read reset file '${path}': ${err instanceof Error ? err.message : String(err)}`
                    );
                }
                const result = await runInContainer({
                    container,
                    argv: ['psql', '-U', credentials.user, '-d', credentials.database],
                    input: sql
                });
                if (result.exitCode !== 0) {
                    fail(
                        `Reset SQL '${label}' failed (exit ${result.exitCode}):\n${result.stderr.trim() || result.stdout.trim()}`
                    );
                }
                log.ok(`${label} applied.`);
            }
        } else {
            await runResetSql({ repoRoot: params.repoRoot, target: params.target });
        }
    }

    // Run drizzle-kit migrate.
    log.info('Running drizzle-kit migrate (pnpm --filter @repo/db db:migrate)...');
    const migrateResult = await runner.run(['pnpm', '--filter', '@repo/db', 'db:migrate'], {
        cwd: params.repoRoot,
        inherit: true,
        env: { HOSPEDA_DATABASE_URL: params.databaseUrl }
    });
    if (migrateResult.exitCode !== 0) {
        fail(
            `db:migrate failed (exit ${migrateResult.exitCode}). The schema is NOT in sync. Inspect the migration output above. If a backup was taken, use the rollback instructions to restore before retrying.`
        );
    }
    log.ok('drizzle-kit migrate completed.');

    if (params.applyExtras) {
        log.info('Applying Postgres extras (pnpm db:apply-extras)...');
        const extrasResult = await runner.run(['pnpm', 'db:apply-extras'], {
            cwd: params.repoRoot,
            inherit: true,
            env: { HOSPEDA_DATABASE_URL: params.databaseUrl }
        });
        if (extrasResult.exitCode !== 0) {
            fail(
                `db:apply-extras failed (exit ${extrasResult.exitCode}). Triggers, matviews and JSONB CHECK constraints are not in sync. Inspect the output above; if you intentionally want to skip them, pass --no-apply-extras.`
            );
        }
        log.ok('Postgres extras applied.');
    } else {
        log.hint('Skipping db:apply-extras (--no-apply-extras).');
    }
}
