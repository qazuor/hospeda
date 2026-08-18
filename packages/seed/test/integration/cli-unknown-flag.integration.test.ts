/**
 * HOS-510 regression, measured where it actually hurts: the `seed_migrations`
 * ledger.
 *
 * `pnpm db:seed:migrate --status` expands to
 * `tsx ./src/cli.ts --data-migrate --status`. `--status` is not a flag this CLI
 * knows — the real one is `--data-migrate-status` — and every flag used to be
 * parsed with `args.includes('--x')`, which cannot tell "absent" from
 * "unrecognized". The unknown token was dropped silently, `--data-migrate`
 * survived alone, and a command typed to LOOK at the ledger applied every
 * pending data-migration. Reproduced on a dev database on 2026-08-15:
 * `seed_migrations` went 44 rows -> 54, exit code 0, no warning.
 *
 * ## Why this asserts on the ledger and not on stdout
 *
 * A command that reports "Applied 10 data-migration(s)" is also a command whose
 * OUTPUT is trustworthy — the bug was never that the CLI lied about what it
 * did, it was that it did it at all. So the assertion that carries this file is
 * the row count in `seed_migrations` before and after, read straight from the
 * database with `pg`. The exit code is asserted too, but as a second signal.
 *
 * ## The instrument is verified before it is trusted
 *
 * A ledger that cannot change cannot detect a write. On a database where every
 * migration is already applied, "the ledger did not move" is true whether the
 * fix works or not, and this file would be a green light wired to nothing. So
 * `beforeAll` clones a database whose ledger is EMPTY (every migration
 * pending), and the first test asserts that precondition explicitly: the
 * read-only report must show a non-zero pending count. Only then does the
 * refusal test's "still zero rows" mean anything.
 *
 * Revert the fix and this file fails on the row count, not on a message.
 *
 * Runs in the seed integration carril (`vitest.integration.config.ts`), which
 * provisions the ephemeral database and exports HOSPEDA_DATABASE_URL. The
 * conventions here — cloning per file, `runCli`, the timeout budgets — follow
 * `cli-data-migrate.integration.test.ts`; see that file's header for why each
 * exists.
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
 * Dedicated clone for this file. Its `seed_migrations` ledger starts empty, so
 * every migration on disk is pending and any accidental run is visible as new
 * rows — which is the entire measuring instrument here.
 */
const CLI_DB_NAME = 'hospeda_seed_cli_unknown_flag_test';

/**
 * The super admin `runMigrations` requires. Without one it refuses before
 * touching anything, which would make the refusal test pass for the wrong
 * reason — an unrelated guard, not the flag validation under test.
 */
const CLI_SUPER_ADMIN_EMAIL = 'zzz-test-cli-unknown-flag@local.test';

/** Slug for {@link CLI_SUPER_ADMIN_EMAIL}. Conforms to the ASCII slug pattern. */
const CLI_SUPER_ADMIN_SLUG = 'zzz-test-cli-unknown-flag-superadmin';

/** Generous stdout cap; the status report over ~50 migrations is small but the CLI is chatty. */
const CLI_MAX_BUFFER = 20 * 1024 * 1024;

/** `execFile` timeout for one spawned CLI run. Matches the sibling CLI carril file. */
const CLI_TIMEOUT_MS = 120_000;

/** Slack for worker-fork module loading and assertion-message building. */
const TEST_OVERHEAD_MARGIN_MS = 30_000;

/** Budget for a test that spawns the CLI once. */
const ONE_RUN_BUDGET_MS = CLI_TIMEOUT_MS + TEST_OVERHEAD_MARGIN_MS;

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

/** Drops `dbName` if present and recreates it as a copy of `templateDbName`. */
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
 * Inserts one `SUPER_ADMIN` into `connectionString`'s database.
 *
 * Raw SQL through `pg` rather than `@repo/db`'s models on purpose: this file
 * never initializes the `@repo/db` singleton — the spawned CLI owns its own
 * connection — and going through the models would drag in the dist-vs-src
 * double-instance problem globalSetup documents.
 */
async function seedSuperAdmin(connectionString: string): Promise<void> {
    const pool = new Pool({ connectionString });
    try {
        const { rows } = await pool.query<{ id: string }>(
            `INSERT INTO users (email, slug, display_name, first_name, last_name)
             VALUES ($1, $2, 'CLI Unknown Flag Super Admin', 'CLI', 'Test')
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

/** Reads the current row count of the `seed_migrations` ledger. */
async function readLedgerCount(connectionString: string): Promise<number> {
    const pool = new Pool({ connectionString });
    try {
        const { rows } = await pool.query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM seed_migrations'
        );
        const raw = rows[0]?.count;
        if (raw === undefined) {
            throw new Error('seed_migrations count query returned no row.');
        }
        return Number.parseInt(raw, 10);
    } finally {
        await pool.end();
    }
}

/** Runs the seed CLI with the given args against `databaseUrl`. */
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
    } finally {
        await adminPool.end();
    }

    await seedSuperAdmin(cliDbUrl);
}, 180_000);

afterAll(async () => {
    if (!dbAvailable) {
        return;
    }

    const adminPool = new Pool({
        connectionString: withDatabase(integrationDbUrl as string, 'postgres')
    });
    try {
        await terminateBackends(adminPool, CLI_DB_NAME);
        await adminPool.query(`DROP DATABASE IF EXISTS ${CLI_DB_NAME}`);
    } finally {
        await adminPool.end();
    }
}, 60_000);

describe('seed CLI unknown-flag refusal (HOS-510)', () => {
    it.skipIf(!dbAvailable)(
        'INSTRUMENT CHECK: this database has pending migrations and an empty ledger',
        async () => {
            // Without this precondition, "the ledger did not move" is vacuously
            // true and the regression test below proves nothing.
            const before = await readLedgerCount(cliDbUrl);
            expect(before).toBe(0);

            const result = await runCli(['--data-migrate-status'], cliDbUrl);

            expect(result.code).toBe(0);

            const pendingMatch = /Pending \((\d+)\)/.exec(result.stdout);
            expect(pendingMatch, `no pending count in output:\n${result.stdout}`).not.toBeNull();
            expect(Number.parseInt(pendingMatch?.[1] ?? '0', 10)).toBeGreaterThan(0);

            // A read-only report must also leave the ledger alone.
            expect(await readLedgerCount(cliDbUrl)).toBe(before);
        },
        ONE_RUN_BUDGET_MS
    );

    it.skipIf(!dbAvailable)(
        'refuses `--data-migrate --status` and writes NOTHING to the ledger',
        async () => {
            // Arrange: exactly what `pnpm db:seed:migrate --status` produces.
            const before = await readLedgerCount(cliDbUrl);

            // Act
            const result = await runCli(['--data-migrate', '--status'], cliDbUrl);

            // Assert: the ledger is the measurement that matters.
            const after = await readLedgerCount(cliDbUrl);
            expect(
                after,
                `The CLI applied ${after - before} migration(s) for a command that only ` +
                    `asked to look. Output was:\n${result.stdout}\n${result.stderr}`
            ).toBe(before);

            // And it must fail loudly rather than proceed.
            expect(result.code).not.toBe(0);
            expect(`${result.stdout}${result.stderr}`).toContain('--status');
        },
        ONE_RUN_BUDGET_MS
    );
});

/*
 * Deliberately NOT tested here: that `--data-migrate` still applies migrations
 * when every flag is recognized. `cli-data-migrate.integration.test.ts` already
 * spawns the real CLI end to end for exactly that, and duplicating it would add
 * a second multi-minute run of the whole migration set for coverage that
 * already exists — and that would fail loudly if this change over-rejected.
 */
