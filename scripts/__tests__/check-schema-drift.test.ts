/**
 * @fileoverview
 * Tests for `scripts/check-schema-drift.sh` (HOS-1130).
 *
 * The guard used to certify "No drift" whenever `drizzle-kit generate` exited 0
 * and wrote no file. drizzle-kit prints `Error: ... collision` and exits 0 on a
 * snapshot-lineage collision, so the comparison never ran yet the guard passed.
 *
 * The real drizzle-kit is replaced through the script's `SCHEMA_DRIFT_GENERATE_CMD`
 * seam and the repo through `SCHEMA_DRIFT_REPO_ROOT` (a scratch git repo), so the
 * decision logic is exercised without a database or the real migrations dir.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.resolve(__dirname, '../check-schema-drift.sh');
const MIGRATIONS = 'packages/db/src/migrations';

interface RunResult {
    readonly exitCode: number;
    readonly output: string;
}

let repo: string;

/** Runs the guard against the scratch repo with a fake `drizzle-kit generate`. */
function runGuard(generateCmd: string): RunResult {
    try {
        const output = execFileSync('bash', [SCRIPT_PATH], {
            cwd: repo,
            env: {
                ...process.env,
                SCHEMA_DRIFT_REPO_ROOT: repo,
                SCHEMA_DRIFT_GENERATE_CMD: generateCmd
            },
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        return { exitCode: 0, output };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, output: err.stdout };
    }
}

describe('check-schema-drift.sh (HOS-1130)', () => {
    beforeEach(() => {
        repo = mkdtempSync(path.join(tmpdir(), 'schema-drift-'));
        mkdirSync(path.join(repo, MIGRATIONS), { recursive: true });
        writeFileSync(path.join(repo, MIGRATIONS, '0000_init.sql'), 'select 1;\n');
        const git = (...args: string[]) =>
            execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
        git('init', '-q');
        git('add', '.');
        git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    it('passes when drizzle-kit positively confirms nothing to migrate', () => {
        const result = runGuard('echo "No schema changes, nothing to migrate"');
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('No drift');
    });

    it('fails on real drift (drizzle-kit wrote a migration file)', () => {
        const result = runGuard(`echo "-- new" > ${MIGRATIONS}/0001_drift_check.sql`);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Schema drift detected');
    });

    it('fails when drizzle-kit prints an Error but exits 0 (snapshot collision)', () => {
        const result = runGuard(
            'echo "Error: [a_snapshot.json, b_snapshot.json] are pointing to a parent snapshot: x which is a collision."; exit 0'
        );
        expect(result.exitCode).toBe(1);
        expect(result.output).not.toContain('No drift');
        expect(result.output).toContain('comparison did NOT run');
    });

    it('fails when the output is empty (no proof the comparison ran)', () => {
        const result = runGuard('true');
        expect(result.exitCode).toBe(1);
        expect(result.output).not.toContain('No drift');
        expect(result.output).toContain('Cannot certify');
    });

    it('fails when the output has neither drift nor the no-changes confirmation', () => {
        const result = runGuard('echo "some unrelated output"');
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Cannot certify');
    });

    it('fails when the command itself fails', () => {
        const result = runGuard('echo boom; exit 2');
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('generate failed');
    });

    it('leaves the migrations dir clean after drift', () => {
        runGuard(`echo "-- new" > ${MIGRATIONS}/0001_drift_check.sql`);
        const status = execFileSync('git', ['status', '--porcelain'], {
            cwd: repo,
            encoding: 'utf8'
        });
        expect(status).toBe('');
    });
});
