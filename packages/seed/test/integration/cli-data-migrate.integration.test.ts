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
 * DB (incl. the `seed_migrations` ledger) and exports HOSPEDA_DATABASE_URL,
 * which the spawned CLI inherits.
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
 * `src/data-migrations/`, not with any one of them: the ephemeral integration
 * DB starts with an empty `seed_migrations` ledger, so `--data-migrate` applies
 * EVERY migration ever added (35 at the time of writing, incl. the large
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
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPkgDir = path.resolve(__dirname, '../..');

const dbAvailable = Boolean(process.env.HOSPEDA_DATABASE_URL);

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

/** Runs the seed CLI with the given args from the package dir, inheriting env. */
async function runCli(
    args: readonly string[]
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
                env: { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL ?? 'INFO' },
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

describe('HOS-101: standalone data-migrate CLI initializes the DB', () => {
    it.skipIf(!dbAvailable)(
        '`--data-migrate-status` connects and reports without "not initialized"',
        { timeout: ONE_RUN_BUDGET_MS },
        async () => {
            const { stdout, stderr, code } = await runCli(['--data-migrate-status']);
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
            const first = await runCli(['--data-migrate']);
            expect(`${first.stdout}\n${first.stderr}`).not.toContain('Database not initialized');
            expect(
                first.code,
                `CLI exited ${first.code}. Output:\n${first.stdout}\n${first.stderr}`
            ).toBe(0);

            // Second run is a no-op via the seed_migrations ledger.
            const second = await runCli(['--data-migrate']);
            expect(
                second.code,
                `CLI (2nd run) exited ${second.code}. Output:\n${second.stdout}\n${second.stderr}`
            ).toBe(0);
        }
    );
});
