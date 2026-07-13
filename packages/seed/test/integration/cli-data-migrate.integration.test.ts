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

/** Runs the seed CLI with the given args from the package dir, inheriting env. */
async function runCli(
    args: readonly string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
        const { stdout, stderr } = await execFileAsync(
            'pnpm',
            ['exec', 'tsx', '--tsconfig', './tsconfig.json', './src/cli.ts', ...args],
            { cwd: seedPkgDir, env: { ...process.env }, timeout: 90_000 }
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
