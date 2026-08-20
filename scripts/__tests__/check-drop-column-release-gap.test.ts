/**
 * @fileoverview
 * Tests for `scripts/check-drop-column-release-gap.sh` (HOS-601).
 *
 * The script blocks a PR that adds a `DROP COLUMN` migration unless the PR
 * description names, per dropped column, a citation (a PR number or a Linear
 * issue id) proving the code that used it already shipped in an earlier,
 * separately-deployed release — see the script's own header comment for the
 * full incident this defends against (an 8-minute accommodations outage
 * measured on the 2026-08-18 release) and why a fully-automatic "was it
 * really already deployed" check is not attempted.
 *
 * Three test-injection env vars mirror the conventions already established
 * by check-seed-dual-write.sh and check-seed-migration-schema-probe.sh:
 *
 *   - `CHANGED_FILES_OVERRIDE` — synthetic `STATUS<TAB>PATH` lines instead of
 *     `git diff --name-status`.
 *   - `MIGRATION_FIXTURE_ROOT` — redirects file CONTENT reads (for paths
 *     named by CHANGED_FILES_OVERRIDE) to a scratch directory keyed by
 *     basename, so the real extraction regex can be exercised against
 *     fixture files without ever writing into the real
 *     packages/db/src/migrations/.
 *   - `DROPPED_COLUMNS_OVERRIDE` — synthetic `table.column` lines instead of
 *     scanning files at all, for testing the marker-decision logic in
 *     isolation.
 *   - `MARKER_TEXT_OVERRIDE` — synthetic PR-body/commit-message text instead
 *     of the real PR body + commit-message scan.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-drop-column-release-gap.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

/** Runs the guard script with the given env overrides and captures the result. */
function runGuard(env: Record<string, string>): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: REPO_ROOT,
            env: { ...process.env, ...env },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout };
    }
}

describe('check-drop-column-release-gap.sh (HOS-601)', () => {
    describe('decision logic (DROPPED_COLUMNS_OVERRIDE)', () => {
        it('passes when no DROP COLUMN migration was added', () => {
            // Arrange / Act
            const result = runGuard({ DROPPED_COLUMNS_OVERRIDE: ' ', MARKER_TEXT_OVERRIDE: '' });

            // Assert
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('OK: no DROP COLUMN migration added');
        });

        it('fails a dropped column with no marker at all', () => {
            // Arrange / Act
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: 'accommodations.schedule',
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('FAIL:');
            expect(result.stdout).toContain('accommodations.schedule');
            expect(result.stdout).toContain('HOS-601');
        });

        it('fails a marker present without a PR/issue citation (evidence, not just text)', () => {
            // Arrange / Act
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: 'accommodations.schedule',
                MARKER_TEXT_OVERRIDE:
                    '[drop-column-release-gap: accommodations.schedule]: trust me, verified'
            });

            // Assert
            expect(result.exitCode).toBe(1);
        });

        it('passes with a marker carrying a PR number citation', () => {
            // Arrange / Act
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: 'accommodations.schedule',
                MARKER_TEXT_OVERRIDE:
                    '[drop-column-release-gap: accommodations.schedule]: shipped in #2701'
            });

            // Assert
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain(
                'OK: every dropped column carries a release-gap marker'
            );
        });

        it('passes with a marker carrying a Linear issue citation (HOS-xxx)', () => {
            // Arrange / Act
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: 'accommodations.schedule',
                MARKER_TEXT_OVERRIDE:
                    '[drop-column-release-gap: accommodations.schedule]: code removed in HOS-598, live on staging since 2026-08-10'
            });

            // Assert
            expect(result.exitCode).toBe(0);
        });

        it('reports ONLY the still-missing column when a multi-column PR partially covers markers', () => {
            // Arrange: two tables both drop a column literally named "media"
            // (0072_wealthy_kingpin.sql's real shape) — only one is covered.
            const dropped = 'accommodations.media\nexperiences.media';
            const marker =
                '[drop-column-release-gap: accommodations.media]: #100 already live per HOS-1';

            // Act
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: dropped,
                MARKER_TEXT_OVERRIDE: marker
            });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('experiences.media');
            expect(result.stdout).not.toContain('accommodations.media\n');
        });

        it('does not cross-match a marker for a DIFFERENT table with the same column name', () => {
            // Arrange: a marker for accommodations.media must not satisfy
            // experiences.media — same column name, different table.
            const result = runGuard({
                DROPPED_COLUMNS_OVERRIDE: 'experiences.media',
                MARKER_TEXT_OVERRIDE: '[drop-column-release-gap: accommodations.media]: #100 HOS-1'
            });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('experiences.media');
        });
    });

    describe('real file extraction (CHANGED_FILES_OVERRIDE + MIGRATION_FIXTURE_ROOT)', () => {
        let fixtureDir: string;

        beforeEach(() => {
            fixtureDir = mkdtempSync(path.join(tmpdir(), 'drop-column-guard-'));
        });

        afterEach(() => {
            rmSync(fixtureDir, { recursive: true, force: true });
        });

        it('POSITIVE CASE: detects the real 0090 DROP COLUMN shape and fails without a marker', () => {
            // Arrange — the exact statement HOS-601's migration 0090 emitted.
            writeFileSync(
                path.join(fixtureDir, '0100_test_drop.sql'),
                'ALTER TABLE "accommodations" DROP COLUMN "schedule";\n',
                'utf-8'
            );

            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: 'A\tpackages/db/src/migrations/0100_test_drop.sql',
                MIGRATION_FIXTURE_ROOT: fixtureDir,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('accommodations.schedule');
        });

        it('passes the same real DROP COLUMN once a valid marker is supplied', () => {
            // Arrange
            writeFileSync(
                path.join(fixtureDir, '0100_test_drop.sql'),
                'ALTER TABLE "accommodations" DROP COLUMN "schedule";\n',
                'utf-8'
            );

            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: 'A\tpackages/db/src/migrations/0100_test_drop.sql',
                MIGRATION_FIXTURE_ROOT: fixtureDir,
                MARKER_TEXT_OVERRIDE:
                    '[drop-column-release-gap: accommodations.schedule]: shipped in #2701'
            });

            // Assert
            expect(result.exitCode).toBe(0);
        });

        it('MUTATION CHECK: a comment merely mentioning the statement does not trip the guard', () => {
            // Arrange — mirrors 0069_mushy_captain_america.sql:35, a comment
            // line that names the exact statement text one line above the
            // real one. Anchoring the regex at line start (not "contains")
            // is what this test pins.
            writeFileSync(
                path.join(fixtureDir, '0100_test_comment.sql'),
                [
                    '-- Note: `ALTER TABLE "users" DROP COLUMN "role"` on the next line has',
                    '-- already been superseded, so this comment merely mentions it.',
                    'SELECT 1;'
                ].join('\n'),
                'utf-8'
            );

            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: 'A\tpackages/db/src/migrations/0100_test_comment.sql',
                MIGRATION_FIXTURE_ROOT: fixtureDir,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('OK: no DROP COLUMN migration added');
        });

        it('does NOT count a MODIFIED (not added) migration file', () => {
            // Arrange
            writeFileSync(
                path.join(fixtureDir, '0100_test_drop.sql'),
                'ALTER TABLE "accommodations" DROP COLUMN "schedule";\n',
                'utf-8'
            );

            // Act — status "M", not "A"
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: 'M\tpackages/db/src/migrations/0100_test_drop.sql',
                MIGRATION_FIXTURE_ROOT: fixtureDir,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode).toBe(0);
        });

        it('extracts multiple DROP COLUMN statements from one migration (0072 shape)', () => {
            // Arrange — mirrors 0072_wealthy_kingpin.sql: three tables, same
            // column name, one statement per line.
            writeFileSync(
                path.join(fixtureDir, '0100_test_multi.sql'),
                [
                    'ALTER TABLE "accommodations" DROP COLUMN "media";--> statement-breakpoint',
                    'ALTER TABLE "experiences" DROP COLUMN "media";--> statement-breakpoint',
                    'ALTER TABLE "gastronomies" DROP COLUMN "media";'
                ].join('\n'),
                'utf-8'
            );

            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: 'A\tpackages/db/src/migrations/0100_test_multi.sql',
                MIGRATION_FIXTURE_ROOT: fixtureDir,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('accommodations.media');
            expect(result.stdout).toContain('experiences.media');
            expect(result.stdout).toContain('gastronomies.media');
        });
    });
});
