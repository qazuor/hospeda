/**
 * HOS-101 regression: the standalone `db:seed:migrate` / `db:seed:migrate:status`
 * CLI paths must initialize the DB connection themselves.
 *
 * These paths bypass `runSeed` (the normal seed entry that calls `initSeedDb`),
 * so before the HOS-101 fix, running `pnpm db:seed:migrate:status` on its own
 * — exactly what `hops db-seed-migrate` does on the VPS — crashed with
 * "Database not initialized. Call initializeDb() before using database
 * operations." even though HOSPEDA_DATABASE_URL was set. This spawns the real
 * CLI as a subprocess (the only way to exercise the `IS_CLI_ENTRY` wiring) and
 * asserts it connects, reports status, and exits 0.
 *
 * Runs in the seed integration carril: the globalSetup provisions the ephemeral
 * DB (incl. the `seed_migrations` ledger) and exports HOSPEDA_DATABASE_URL.
 *
 * ## The SUPER_ADMIN precondition, and why this file clones its own DB (HOS-375)
 *
 * `runMigrations` used to resolve its acting actor with
 * `loadSuperAdminAndGetActor()`, which CREATES `superadmin@hospeda.com` when no
 * super admin exists. HOS-375 replaced that with `requireSuperAdminActor`, which
 * THROWS instead — a `--baseline-stamp` invocation now falls through to a real
 * run, and manufacturing that predictable credential would silently undo the
 * `--required --exclude=users` a production day-1 bootstrap deliberately asked
 * for.
 *
 * That made a precondition of this test explicit which had until then been
 * satisfied by accident: the integration database has NO users (globalSetup
 * seeds billing plans only), so every `--data-migrate` run here was in fact
 * bootstrapping its own super admin on the way in. With the bootstrap gone the
 * CLI exits 1 — which is the correct behavior for that database, not a CLI bug.
 * A real `db:seed:migrate` target always has a super admin; this file has to
 * provide one.
 *
 * It provides it on a DEDICATED database cloned from the integration one
 * (`CREATE DATABASE ... TEMPLATE`), not on the shared database itself, for two
 * reasons:
 *
 * 1. This is the only file in the carril that applies the REAL migration set
 *    (every other one points the runner at a fixture directory), so it is the
 *    only one that writes real users, posts, events and ledger rows. Files here
 *    share one database and run serially in an order vitest does NOT guarantee
 *    (the default sequencer orders by cached duration, so it differs between a
 *    cold CI run and a warm local one). Leaving that content behind would make
 *    sibling assertions about global state — e.g. `contentOnly.integration.
 *    test.ts` asserting the database holds zero users — pass or fail depending
 *    on which file happened to run first.
 * 2. Cloning is what lets the refusal case below be tested at all: a second,
 *    userless clone reproduces the day-1 bootstrap ordering mistake end to end
 *    through the real CLI, without having to first destroy state the other
 *    tests in this file depend on.
 *
 * The clone is a `TEMPLATE` copy rather than a fresh `drizzle-kit migrate`
 * because it is ~1s instead of tens of seconds, and because it inherits the
 * billing plan rows globalSetup seeds, which the ported billing-plan migrations
 * in the real set expect to already exist.
 *
 * ## `maxBuffer` / `LOG_LEVEL` (HOS-142 follow-up)
 *
 * `--data-migrate` now also applies `0013-hos-142-poi-catalog-expansion.ts`
 * (908 POIs + ~1556 destination relations + ~3206 category assignments —
 * roughly 11k individual `@repo/db` model calls). `@repo/logger`'s default
 * level (`LOG`) is maximally permissive (it shows DEBUG lines too, per
 * `shouldLog`'s `default` branch in `packages/logger/src/logger.ts`), and
 * every model `create`/`findOne` call logs a DEBUG line via `logQuery`/
 * `logAction` that includes the full (unsummarized) input `params` — at
 * this row count that floods stdout well past Node's default 1MB
 * `execFile` `maxBuffer`, which is what actually failed
 * (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`), not a real CLI/migration bug.
 * Two changes, both scoped to this test only (no production code touched):
 * `LOG_LEVEL=INFO` (unless the environment already sets one) suppresses
 * that per-row DEBUG noise at the source, and a generous explicit
 * `maxBuffer` is a defensive backstop for whatever INFO-level output (or a
 * future larger migration) remains.
 *
 * ## Per-test timeouts (HOS-386)
 *
 * The vitest budget for each test here is DERIVED from `CLI_TIMEOUT_MS` rather
 * than left to the carril-wide `testTimeout` (30s, see
 * `vitest.integration.config.ts`). That default was not merely tight, it was
 * self-contradictory: a single test spawning the CLI twice with a 90s
 * `execFile` timeout each budgeted 180s of subprocess time inside a 30s test,
 * so vitest always killed the test first and the `execFile` timeout could never
 * fire. CI failed intermittently with an opaque `Test timed out in 30000ms`
 * instead of the CLI's own output, on PRs touching nothing related.
 *
 * Measured locally (idle machine, local Docker PostgreSQL, HOS-386):
 *
 * | Invocation                                 | Wall clock |
 * | ------------------------------------------ | ---------- |
 * | `--data-migrate-status` (ledger read only) | 23.1s      |
 * | `--data-migrate` (applies all pending)     | 45.0s      |
 * | `--data-migrate` (2nd run, ledger no-op)   | 22.7s      |
 *
 * Two things follow. First, ~23s of EVERY invocation is `pnpm exec tsx` cold
 * start of the `@repo/*` module graph, not migration work — the ledger-only
 * read and the no-op second run both cost it in full, and they are the two
 * cheapest things the CLI can do. The migrations themselves are only ~22s of
 * the 45s. Second, that made even the read-only status test (23.1s of a 30s
 * budget, on an idle machine) one loaded runner away from the same failure, so
 * both tests get an explicit budget, not just the two-run one.
 *
 * Note the cost here scales with the number of data migrations in
 * `src/data-migrations/`, not with any one of them: the cloned database starts
 * with an empty `seed_migrations` ledger, so `--data-migrate` applies EVERY
 * migration ever added (42 at the time of writing, incl. the large
 * `0018` POI-curation and `0027`/`0028` event batches — the HOS-142 note above
 * names `0013` only because that is the one that blew the `maxBuffer`).
 *
 * Deliberately NOT fixed with `retries`: a real performance regression in the
 * migration runner or in CLI startup is exactly what this test should surface,
 * and a retry would paper over it.
 */
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPkgDir = path.resolve(__dirname, '../..');

const integrationDbUrl = process.env.HOSPEDA_DATABASE_URL;
const dbAvailable = Boolean(integrationDbUrl);

/**
 * Database cloned for the runs that must SUCCEED. Seeded with one super admin
 * in `beforeAll`, then filled with every real migration's content by the tests
 * themselves — which is precisely why it is not the shared integration DB.
 */
const CLI_DB_NAME = 'hospeda_seed_cli_data_migrate_test';

/**
 * Database cloned for the run that must be REFUSED: a faithful copy of a
 * day-1 bootstrap that ran `--required --exclude=users` and then reached for
 * the migration ledger before promoting a real admin. Kept separate from
 * {@link CLI_DB_NAME} so neither test has to mutate the other's preconditions.
 */
const CLI_NO_ADMIN_DB_NAME = 'hospeda_seed_cli_data_migrate_no_admin_test';

/**
 * The pre-existing super admin the successful runs act as. Deliberately NOT
 * `superadmin@hospeda.com`: that is the identity the removed bootstrap used to
 * manufacture, so using any other email keeps "an account was already here" and
 * "the CLI created one" distinguishable — see the refusal test below.
 */
const CLI_SUPER_ADMIN_EMAIL = 'zzz-test-cli-data-migrate@local.test';

/** Slug for {@link CLI_SUPER_ADMIN_EMAIL}. Conforms to the ASCII slug pattern. */
const CLI_SUPER_ADMIN_SLUG = 'zzz-test-cli-data-migrate-superadmin';

/** The well-known fixture account the runner must never create on its own. */
const SEEDED_SUPER_ADMIN_EMAIL = 'superadmin@hospeda.com';

/** Returns `connectionString` repointed at `dbName`. */
function withDatabase(connectionString: string, dbName: string): string {
    const url = new URL(connectionString);
    url.pathname = `/${dbName}`;
    return url.toString();
}

/** Kills every backend connected to `dbName` so it can be dropped or cloned. */
async function terminateBackends(adminPool: Pool, dbName: string): Promise<void> {
    await adminPool.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
    );
}

/**
 * Drops `dbName` if present and recreates it as a copy of `templateDbName`.
 *
 * `CREATE DATABASE ... TEMPLATE` refuses while anything is connected to the
 * template, hence the `pg_terminate_backend` sweep first. That is safe here:
 * the carril runs with `fileParallelism: false`, so no other test file is
 * executing, and any connection still open on the template is a leaked pool
 * from a file that already finished.
 */
async function cloneDatabase(
    adminPool: Pool,
    templateDbName: string,
    dbName: string
): Promise<void> {
    await terminateBackends(adminPool, dbName);
    await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await terminateBackends(adminPool, templateDbName);
    await adminPool.query(`CREATE DATABASE ${dbName} TEMPLATE ${templateDbName}`);
}

/**
 * Inserts one `SUPER_ADMIN` account into `connectionString`'s database.
 *
 * Written as raw SQL through `pg` rather than through `@repo/db`'s models on
 * purpose: this file never initializes the `@repo/db` singleton (the spawned
 * CLI owns its own connection), and going through the models would drag in the
 * dist-vs-src double-instance problem globalSetup already documents.
 *
 * Both hats are granted, matching `superAdminLoader`'s own `grantSuperAdminRole`
 * — every account holds `USER` as its baseline, and the super admin is not an
 * exception.
 */
async function seedSuperAdmin(connectionString: string): Promise<void> {
    const pool = new Pool({ connectionString });
    try {
        const { rows } = await pool.query<{ id: string }>(
            `INSERT INTO users (email, slug, display_name, first_name, last_name)
             VALUES ($1, $2, 'CLI Test Super Admin', 'CLI', 'Test')
             RETURNING id`,
            [CLI_SUPER_ADMIN_EMAIL, CLI_SUPER_ADMIN_SLUG]
        );
        const userId = rows[0]?.id;
        if (!userId) {
            throw new Error('Failed to insert the CLI test super admin.');
        }
        await pool.query(
            `INSERT INTO user_role (user_id, role) VALUES ($1, 'SUPER_ADMIN'), ($1, 'USER')`,
            [userId]
        );
    } finally {
        await pool.end();
    }
}

/** Returns every email in `connectionString`'s `users` table. */
async function readUserEmails(connectionString: string): Promise<string[]> {
    const pool = new Pool({ connectionString });
    try {
        const { rows } = await pool.query<{ email: string }>(
            'SELECT email FROM users ORDER BY email ASC'
        );
        return rows.map((row) => row.email);
    } finally {
        await pool.end();
    }
}

/**
 * Generous `execFile` stdout/stderr buffer cap for the spawned CLI. Node's
 * `child_process` default is 1MB, which `--data-migrate` can now exceed on
 * its own (see this file's "maxBuffer / LOG_LEVEL" note above) even with
 * `LOG_LEVEL=INFO` trimming the bulk of the per-row DEBUG noise. 20MB is
 * comfortable headroom for the current ~5670-row 0013 migration plus
 * meaningful future growth, while still failing loudly (a real hang/runaway
 * output would still blow past 20MB) rather than silently raising it to
 * `Infinity`.
 */
const CLI_MAX_BUFFER = 20 * 1024 * 1024;

/**
 * `execFile` timeout for ONE spawned CLI run. The slowest measured invocation
 * (`--data-migrate` applying every pending migration) took 45s locally on an
 * idle machine; CI runs the three integration carriles (`db`, `service-core`,
 * `seed`) concurrently under turbo on a 2-vCPU runner, so this leaves ~2.7x
 * headroom for contention while still bounding a genuinely hung CLI.
 *
 * This is the timeout that SHOULD fire when the CLI misbehaves: it rejects with
 * the child's own stdout/stderr, which the assertions below put in the failure
 * message. The per-test budgets are derived from it precisely so vitest never
 * kills the test first and replaces that output with `Test timed out in Nms`.
 */
const CLI_TIMEOUT_MS = 120_000;

/**
 * Slack for per-test work OUTSIDE the spawned runs — the worker fork's own
 * module loading, and building assertion messages that interpolate up to
 * `CLI_MAX_BUFFER` of CLI output. CLI startup is NOT covered here: it happens
 * inside the child process, so `CLI_TIMEOUT_MS` already accounts for it.
 */
const TEST_OVERHEAD_MARGIN_MS = 30_000;

/** Budget for a test that spawns the CLI once. */
const ONE_RUN_BUDGET_MS = CLI_TIMEOUT_MS + TEST_OVERHEAD_MARGIN_MS;

/** Budget for a test that spawns the CLI twice. */
const TWO_RUN_BUDGET_MS = 2 * CLI_TIMEOUT_MS + TEST_OVERHEAD_MARGIN_MS;

/**
 * Runs the seed CLI with the given args from the package dir.
 *
 * `HOSPEDA_DATABASE_URL` is overridden per call so the child targets one of
 * this file's own clones instead of the shared integration database. The
 * override wins over the `apps/api/.env.local` the CLI loads on startup —
 * dotenv does not overwrite variables already present in the environment.
 */
async function runCli(
    args: readonly string[],
    databaseUrl: string
): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
        const { stdout, stderr } = await execFileAsync(
            'pnpm',
            ['exec', 'tsx', '--tsconfig', './tsconfig.json', './src/cli.ts', ...args],
            {
                cwd: seedPkgDir,
                // Defaults to INFO so the CLI's per-row DEBUG query logging
                // (see this file's top JSDoc) doesn't flood stdout; an
                // explicit LOG_LEVEL in the environment (e.g. a developer
                // debugging locally) always wins.
                env: {
                    ...process.env,
                    HOSPEDA_DATABASE_URL: databaseUrl,
                    LOG_LEVEL: process.env.LOG_LEVEL ?? 'INFO'
                },
                timeout: CLI_TIMEOUT_MS,
                maxBuffer: CLI_MAX_BUFFER
            }
        );
        return { stdout, stderr, code: 0 };
    } catch (error) {
        const e = error as { stdout?: string; stderr?: string; code?: number };
        return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', code: e.code ?? 1 };
    }
}

const cliDbUrl = dbAvailable ? withDatabase(integrationDbUrl as string, CLI_DB_NAME) : '';
const cliNoAdminDbUrl = dbAvailable
    ? withDatabase(integrationDbUrl as string, CLI_NO_ADMIN_DB_NAME)
    : '';

beforeAll(async () => {
    if (!dbAvailable) {
        return;
    }

    const templateDbName = new URL(integrationDbUrl as string).pathname.slice(1);
    const adminPool = new Pool({
        connectionString: withDatabase(integrationDbUrl as string, 'postgres')
    });

    try {
        await cloneDatabase(adminPool, templateDbName, CLI_DB_NAME);
        await cloneDatabase(adminPool, templateDbName, CLI_NO_ADMIN_DB_NAME);
    } finally {
        await adminPool.end();
    }

    // Only the first clone gets the actor the runner now requires. The second
    // is left exactly as cloned — no users at all.
    await seedSuperAdmin(cliDbUrl);
});

afterAll(async () => {
    if (!dbAvailable) {
        return;
    }

    const adminPool = new Pool({
        connectionString: withDatabase(integrationDbUrl as string, 'postgres')
    });

    try {
        for (const dbName of [CLI_DB_NAME, CLI_NO_ADMIN_DB_NAME]) {
            await terminateBackends(adminPool, dbName);
            await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
        }
    } finally {
        await adminPool.end();
    }
});

describe('HOS-101: standalone data-migrate CLI initializes the DB', () => {
    it.skipIf(!dbAvailable)(
        '`--data-migrate-status` connects and reports without "not initialized"',
        { timeout: ONE_RUN_BUDGET_MS },
        async () => {
            const { stdout, stderr, code } = await runCli(['--data-migrate-status'], cliDbUrl);
            const combined = `${stdout}\n${stderr}`;

            expect(combined).not.toContain('Database not initialized');
            // Surface the CLI's own output when it exits non-zero so a CI-only
            // failure is diagnosable instead of a bare "expected 1 to be 0".
            expect(code, `CLI exited ${code}. Output:\n${combined}`).toBe(0);
        }
    );

    it.skipIf(!dbAvailable)(
        '`--data-migrate` applies pending migrations and exits 0 (idempotent second run)',
        { timeout: TWO_RUN_BUDGET_MS },
        async () => {
            const first = await runCli(['--data-migrate'], cliDbUrl);
            expect(`${first.stdout}\n${first.stderr}`).not.toContain('Database not initialized');
            expect(
                first.code,
                `CLI exited ${first.code}. Output:\n${first.stdout}\n${first.stderr}`
            ).toBe(0);

            // Second run is a no-op via the seed_migrations ledger.
            const second = await runCli(['--data-migrate'], cliDbUrl);
            expect(
                second.code,
                `CLI (2nd run) exited ${second.code}. Output:\n${second.stdout}\n${second.stderr}`
            ).toBe(0);
        }
    );
});

describe('HOS-375: `--data-migrate` refuses to manufacture a super admin', () => {
    it.skipIf(!dbAvailable)(
        'exits 1 with an actionable message, creating no account, when the target DB has none',
        { timeout: ONE_RUN_BUDGET_MS },
        async () => {
            // This database is a day-1 bootstrap that ran `--required
            // --exclude=users` and reached the migration ledger before a real
            // admin was promoted. Before HOS-375 the runner resolved its actor
            // with `loadSuperAdminAndGetActor()`, so this exact invocation
            // exited 0 having silently created `superadmin@hospeda.com` — the
            // predictable credential the exclusion existed to keep off the box.
            expect(await readUserEmails(cliNoAdminDbUrl)).toEqual([]);

            const { stdout, stderr, code } = await runCli(['--data-migrate'], cliNoAdminDbUrl);
            const combined = `${stdout}\n${stderr}`;

            expect(combined).not.toContain('Database not initialized');
            expect(code, `CLI exited ${code}. Output:\n${combined}`).toBe(1);
            expect(combined).toContain('this database has no SUPER_ADMIN account');

            // The refusal must be total: no bootstrapped account, and no
            // migration content either (the actor is resolved before the first
            // migration runs).
            expect(await readUserEmails(cliNoAdminDbUrl)).toEqual([]);
        }
    );

    it.skipIf(!dbAvailable)(
        'acts as the pre-existing super admin instead of creating the seeded one',
        async () => {
            // Complements the refusal above: on the database that DID have an
            // actor, the applied run must have adopted it rather than adding
            // `superadmin@hospeda.com` alongside it.
            const emails = await readUserEmails(cliDbUrl);

            expect(emails).toContain(CLI_SUPER_ADMIN_EMAIL);
            expect(emails).not.toContain(SEEDED_SUPER_ADMIN_EMAIL);
        }
    );
});
