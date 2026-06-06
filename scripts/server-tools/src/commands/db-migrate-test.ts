/**
 * `hops db-migrate-test` — rehearse pending Drizzle migrations against a
 * scratch clone of the target database before applying them for real.
 *
 * This command clones the live DB into a temporary scratch database inside
 * the same Postgres container, runs the full migrate sequence (drizzle-kit
 * migrate + apply-extras) against the clone, then reports PASS or FAIL.
 * On pass the scratch DB is dropped (unless `--keep`). On fail it is
 * preserved and the operator is given the connect details to inspect.
 *
 * Disk / load implications:
 *   - pg_dump is held in RAM (Buffer) — fine for the current database size
 *     (a few MB). If the DB exceeds ~100 MB, switch to a streaming path.
 *   - pg_restore writes to the scratch DB in the same Postgres instance,
 *     temporarily doubling disk use. Ensure the VPS has headroom (~3×
 *     the dump size).
 *   - The migrate run competes with live traffic on the same Postgres
 *     instance — acceptable for a few seconds but avoid during peak hours
 *     on production.
 *   - The scratch DB is always in the same container as the target DB.
 *     It cannot be on a separate host without refactoring.
 *
 * Pull handling mirrors `hops db-migrate` exactly: pass `--pull` or
 * `--no-pull` to skip the interactive question, otherwise the command
 * asks interactively.
 */

import { existsSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { docker, runInContainer } from '../lib/docker.ts';
import { get } from '../lib/env.ts';
import { die, log } from '../lib/log.ts';
import { buildDbDependencies, runMigrateSequence } from '../lib/migrate-core.ts';
import { buildPostgresUrl, pgDumpToBuffer } from '../lib/postgres.ts';
import { confirm } from '../lib/prompt.ts';
import { runner } from '../lib/runner.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops db-migrate-test [--target=prod|staging]
                     [--keep]
                     [--pull | --no-pull]
                     [--no-build]
                     [--yes]
                     [--help, -h]

Rehearse pending migrations against a temporary scratch clone of the
target database. Lets you verify that the migration plan is correct
before running it against the live DB.

Steps:
  1. Locate the target Postgres container.
  2. pg_dump the live DB to a RAM buffer (--no-owner --no-privileges).
  3. Create a scratch database in the SAME container named
     hospeda_migrate_test_<yyyymmdd_hhmmss>.
  4. Restore the dump into the scratch DB (pg_restore --no-owner
     --no-privileges). Temp file inside the container is cleaned up.
  5. Run the full migrate sequence against the scratch DB:
       a. pnpm --filter @repo/db db:migrate   (drizzle-kit migrate)
       b. pnpm db:apply-extras                (triggers / extras)
  6. Report PASS or FAIL.
     - PASS: drop the scratch DB (unless --keep) and exit 0.
     - FAIL: preserve the scratch DB, print connect instructions,
             exit 1.

Flags:
  --keep          Do not drop the scratch DB after a successful run.
                  Useful for manual inspection after a passing test.
  --pull          Always git pull \\$HOPS_REPO_ROOT first.
                  Mutually exclusive with --no-pull.
  --no-pull       Never git pull. Mutually exclusive with --pull.
  --no-build      Skip the turbo build step. Only use when @repo/db
                  dist/ outputs are already up to date.
  --yes           Skip the prod confirmation prompt.
  --help, -h      Show this help.

Without --pull / --no-pull the command asks interactively.
Without --yes on prod, the command prompts for confirmation (pg_dump +
restore + migrate run on the same instance — avoid during peak hours).

Warning:
  The scratch clone runs inside the TARGET Postgres container — it uses
  the same disk and competes for I/O with live traffic. Avoid running
  this against prod during peak hours.

Examples:
  hops db-migrate-test --target=staging --no-pull
  hops db-migrate-test --target=prod --pull --no-build --yes
  hops db-migrate-test --target=staging --keep   # inspect after pass

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID    Coolify Postgres service UUID.
  HOPS_REPO_ROOT (optional)      Path to the hospeda checkout. Default ~/hospeda.
`.trim();

export interface ParsedMigrateTestArgs {
    readonly keep: boolean;
    readonly build: boolean;
    readonly pull: 'on' | 'off' | 'ask';
    readonly skipConfirm: boolean;
}

/** Structured error returned when mutually exclusive flags are combined. */
export interface ParseMigrateTestArgsError {
    readonly kind: 'mutually-exclusive';
    readonly message: string;
}

/** Result union for parseMigrateTestArgs — success or typed parse error. */
export type ParseMigrateTestArgsResult =
    | { readonly ok: true; readonly args: ParsedMigrateTestArgs }
    | { readonly ok: false; readonly error: ParseMigrateTestArgsError };

/**
 * Parse argv for db-migrate-test.
 *
 * Returns a typed result rather than calling `die()` directly, so callers
 * can test the conflict branch without spawning a subprocess.
 *
 * @param argv - Command argv with --target already stripped.
 * @returns Parsed arguments result (ok=true) or a typed error (ok=false).
 */
export function parseMigrateTestArgs(argv: ReadonlyArray<string>): ParseMigrateTestArgsResult {
    const args = [...argv];

    const wantsPull = args.includes('--pull');
    const skipsPull = args.includes('--no-pull');
    if (wantsPull && skipsPull) {
        return {
            ok: false,
            error: {
                kind: 'mutually-exclusive',
                message: '--pull and --no-pull are mutually exclusive.'
            }
        };
    }

    return {
        ok: true,
        args: {
            keep: args.includes('--keep'),
            build: !args.includes('--no-build'),
            pull: wantsPull ? 'on' : skipsPull ? 'off' : 'ask',
            skipConfirm: args.includes('--yes')
        }
    };
}

/**
 * Resolve the repository root from env or default.
 * Mirrors the same helper in db-migrate and db-seed.
 *
 * @returns Absolute path to the repository root.
 */
export function resolveRepoRoot(): string {
    const explicit = get('HOPS_REPO_ROOT');
    if (explicit) return explicit;
    return join(homedir(), 'hospeda');
}

/**
 * Build a scratch database name from the current UTC timestamp.
 * Format: `hospeda_migrate_test_YYYYMMDD_HHMMSS`.
 * Deterministic from the given date, making it testable.
 *
 * @param now - The Date to use (defaults to current time).
 * @returns Scratch database name safe for Postgres identifiers.
 */
export function buildScratchDbName(now: Date = new Date()): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    const year = String(now.getUTCFullYear());
    const month = pad(now.getUTCMonth() + 1);
    const day = pad(now.getUTCDate());
    const hour = pad(now.getUTCHours());
    const min = pad(now.getUTCMinutes());
    const sec = pad(now.getUTCSeconds());
    return `hospeda_migrate_test_${year}${month}${day}_${hour}${min}${sec}`;
}

async function gitPullRepo(repoRoot: string): Promise<void> {
    log.info(`git pull in ${repoRoot}`);
    const result = await runner.run(['git', '-C', repoRoot, 'pull'], { inherit: true });
    if (result.exitCode !== 0) {
        die(`git pull failed (exit ${result.exitCode}). Resolve manually before retrying.`);
    }
    log.ok('Repo updated.');
}

/**
 * Create a scratch database inside the given container as the given user.
 * The user must have CREATEDB privilege or be a superuser.
 *
 * @param params - Container, postgres user, and name for the new database.
 */
async function createScratchDb(params: {
    readonly container: string;
    readonly user: string;
    readonly scratchDb: string;
}): Promise<void> {
    // Use the postgres superuser (default in Coolify prod) for CREATE DATABASE.
    // If the target user doesn't have CREATEDB, this will fail with a clear error.
    const sql = `CREATE DATABASE "${params.scratchDb}" OWNER "${params.user}";`;
    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', 'postgres'],
        input: sql
    });
    if (result.exitCode !== 0) {
        die(
            `Failed to create scratch database '${params.scratchDb}' (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}. Ensure the Postgres user has CREATEDB privilege or is a superuser.`
        );
    }
    log.ok(`Scratch database '${params.scratchDb}' created.`);
}

/**
 * Restore a dump buffer into the scratch database via docker cp + pg_restore.
 * Cleans up the temp file inside the container in a finally block.
 *
 * @param params - Container, user, scratch DB name, and dump buffer.
 */
async function restoreDumpToScratch(params: {
    readonly container: string;
    readonly user: string;
    readonly scratchDb: string;
    readonly dumpBuffer: Buffer;
}): Promise<void> {
    // Both the host and container use the same /tmp path: the host writes
    // the file there and docker cp copies it to the same absolute path inside
    // the container.
    const dumpPath = `/tmp/hops-migrate-test-${Date.now()}.dump`;

    log.info('Writing dump to host temp file...');
    await writeFile(dumpPath, params.dumpBuffer);
    log.ok(`Wrote ${params.dumpBuffer.length} bytes to ${dumpPath}`);

    try {
        log.info(`Copying dump into container (${params.container}:${dumpPath})...`);
        const cp = await docker(['cp', dumpPath, `${params.container}:${dumpPath}`]);
        if (cp.exitCode !== 0) {
            die(`docker cp failed: ${cp.stderr.trim() || cp.stdout.trim()}`);
        }

        log.info(`Running pg_restore into '${params.scratchDb}'...`);
        const restore = await runInContainer({
            container: params.container,
            argv: [
                'pg_restore',
                '-U',
                params.user,
                '-d',
                params.scratchDb,
                '--no-owner',
                '--no-privileges',
                dumpPath
            ]
        });

        // pg_restore emits warnings to stderr about objects dropped with --clean
        // (not applicable here — fresh DB) but may also print "errors ignored".
        // Only treat non-zero exit as failure.
        if (restore.stderr.trim().length > 0) {
            for (const line of restore.stderr.trim().split('\n')) {
                log.hint(line);
            }
        }
        if (restore.exitCode !== 0) {
            die(`pg_restore failed (exit ${restore.exitCode}). Inspect output above.`);
        }

        log.ok(`Dump restored into '${params.scratchDb}'.`);
    } finally {
        await unlink(dumpPath).catch(() => undefined);
        await runInContainer({
            container: params.container,
            argv: ['rm', '-f', dumpPath]
        }).catch(() => undefined);
    }
}

/**
 * Drop the scratch database by first terminating any open connections to it,
 * then issuing DROP DATABASE. Postgres requires no active connections before
 * a DROP DATABASE can succeed.
 *
 * @param params - Container, postgres user, and scratch DB name.
 */
async function dropScratchDb(params: {
    readonly container: string;
    readonly user: string;
    readonly scratchDb: string;
}): Promise<void> {
    // Terminate any stray connections (e.g. from pg_restore or migrate).
    const terminateSql = `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${params.scratchDb}' AND pid <> pg_backend_pid();`;

    await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', 'postgres'],
        input: terminateSql
    }).catch(() => undefined); // best-effort; failure does not block the drop attempt

    const dropSql = `DROP DATABASE IF EXISTS "${params.scratchDb}";`;
    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', 'postgres'],
        input: dropSql
    });

    if (result.exitCode !== 0) {
        log.warn(
            `Could not drop scratch DB '${params.scratchDb}': ${result.stderr.trim() || result.stdout.trim()}. Drop it manually when convenient.`
        );
    } else {
        log.ok(`Scratch database '${params.scratchDb}' dropped.`);
    }
}

export async function dbMigrateTest(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parseResult = parseMigrateTestArgs(argv);
    if (!parseResult.ok) {
        die(parseResult.error.message);
    }
    const parsed = parseResult.args;
    const target = getActiveTarget();

    const repoRoot = resolveRepoRoot();
    if (!existsSync(repoRoot)) {
        die(
            `Repo root '${repoRoot}' not found. Set HOPS_REPO_ROOT in .env.local or clone the repo at ~/hospeda.`
        );
    }
    if (!existsSync(join(repoRoot, '.git'))) {
        die(`'${repoRoot}' is not a git repository.`);
    }

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(target);

    const scratchDb = buildScratchDbName();

    log.info(`Target    : ${target}`);
    log.info(`Repo      : ${repoRoot}`);
    log.info(`Source DB : ${credentials.user}@${container} → ${credentials.database}`);
    log.info(`Scratch DB: ${scratchDb}`);
    log.info(
        `Flags     : ${[parsed.build ? '+build' : '-build', parsed.keep ? '+keep' : '-keep'].join(
            ' '
        )}`
    );

    // ── Prod confirmation ─────────────────────────────────────────────────
    // pg_dump + restore + migrate all run against the same Postgres instance,
    // temporarily doubling disk use. Prompt on prod unless --yes is passed.
    if (target === 'prod' && !parsed.skipConfirm) {
        const ok = await confirm(
            'Run db-migrate-test against PRODUCTION? (pg_dump + restore + migrate on same instance — avoid peak hours)',
            { defaultValue: false }
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // ── Pull step ────────────────────────────────────────────────────────
    let shouldPull: boolean;
    if (parsed.pull === 'on') {
        shouldPull = true;
    } else if (parsed.pull === 'off') {
        shouldPull = false;
    } else {
        shouldPull = await confirm('Pull latest code from git first?', { defaultValue: true });
    }

    if (shouldPull) {
        await gitPullRepo(repoRoot);
    } else {
        log.hint('Skipping git pull.');
    }

    // ── Build workspace deps ─────────────────────────────────────────────
    if (parsed.build) {
        await buildDbDependencies(repoRoot);
    } else {
        log.hint('Skipping build (--no-build).');
    }

    // ── Step 1: dump the live DB ─────────────────────────────────────────
    log.info('Step 1/4: pg_dump source database...');
    const dumpResult = await pgDumpToBuffer({
        container,
        user: credentials.user,
        db: credentials.database
    });

    if (dumpResult.exitCode !== 0) {
        die(
            `pg_dump failed (exit ${dumpResult.exitCode}): ` +
                `${dumpResult.stderr.trim() || '<empty stderr>'}`
        );
    }
    log.ok(`pg_dump produced ${dumpResult.stdout.length} bytes.`);

    // ── Step 2: create scratch DB ─────────────────────────────────────────
    log.info(`Step 2/4: Creating scratch database '${scratchDb}'...`);
    await createScratchDb({
        container,
        user: credentials.user,
        scratchDb
    });

    // ── Step 3: restore dump → scratch ───────────────────────────────────
    let migrationSucceeded = false;
    try {
        log.info('Step 3/4: Restoring dump into scratch database...');
        await restoreDumpToScratch({
            container,
            user: credentials.user,
            scratchDb,
            dumpBuffer: dumpResult.stdout
        });

        // ── Step 4: run migrate sequence against scratch ──────────────────
        log.info('Step 4/4: Running migrate sequence against scratch database...');
        const scratchUrl = await buildPostgresUrl({
            container,
            user: credentials.user,
            db: scratchDb
        });

        // throwOnError: true makes runMigrateSequence throw instead of calling
        // die() (process.exit), so our finally block always runs and we can
        // print the FAIL summary + preserve the scratch DB for inspection.
        await runMigrateSequence({
            repoRoot,
            databaseUrl: scratchUrl,
            target,
            reset: false, // scratch is already a fresh clone — no reset needed
            applyExtras: true,
            backup: undefined, // no backup for the scratch run
            throwOnError: true
        });

        // Reached here — migration succeeded.
        migrationSucceeded = true;
    } catch (err) {
        log.error(err instanceof Error ? err.message : String(err));
    } finally {
        if (migrationSucceeded && !parsed.keep) {
            log.info('Dropping scratch database...');
            await dropScratchDb({ container, user: credentials.user, scratchDb });
        } else if (!migrationSucceeded) {
            log.warn(`Migration FAILED. Scratch database '${scratchDb}' preserved for inspection.`);
            log.hint('Inspect with:');
            log.hint(
                `  docker exec -it <postgres-container> psql -U ${credentials.user} -d ${scratchDb}`
            );
            log.hint('Drop when done:');
            log.hint(
                `  docker exec <postgres-container> psql -U ${credentials.user} -d postgres -c 'DROP DATABASE "${scratchDb}";'`
            );
        } else if (parsed.keep) {
            log.hint(`Scratch database '${scratchDb}' preserved (--keep). Drop it when done:`);
            log.hint(
                `  docker exec <postgres-container> psql -U ${credentials.user} -d postgres -c 'DROP DATABASE "${scratchDb}";'`
            );
        }
    }

    if (migrationSucceeded) {
        log.ok(`db-migrate-test PASSED against ${target} (scratch: ${scratchDb}).`);
        log.hint('Migrations are safe to apply with `hops db-migrate`.');
    } else {
        log.error(`db-migrate-test FAILED against ${target}.`);
        log.hint('Fix the migration, then re-run `hops db-migrate-test` before applying.');
        die(`db-migrate-test FAILED against ${target}.`);
    }
}
