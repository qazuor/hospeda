/**
 * @fileoverview
 * HOS-25 T-024: tests the DECISION logic of `check-seed-dual-write.sh` in
 * isolation, without a real git diff. The script exposes two test-injection
 * env vars for exactly this purpose:
 *
 *   - `CHANGED_FILES_OVERRIDE` — a synthetic `STATUS<TAB>PATH` per-line list,
 *     in the same format `git diff --name-status` emits, used instead of
 *     running a real diff.
 *   - `MARKER_TEXT_OVERRIDE` — synthetic PR-body/commit-message text, used
 *     instead of the real PR body + commit-message scan, to test the
 *     `[skip-seed-migration]` opt-out.
 *
 * Each test spawns the real script as a subprocess (bash), asserting exit
 * code and stdout content — the same "drive the artifact directly" style as
 * other guard-script coverage in this repo (e.g. env-doctor.test.ts), except
 * here the artifact under test is a shell script rather than a compiled TS
 * module, since check-seed-dual-write.sh (like check-schema-drift.sh, its
 * sibling guard) is bash.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-seed-dual-write.sh');

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

describe('check-seed-dual-write.sh (HOS-25 T-024)', () => {
    it('passes when no guarded baseline path changed', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/example/accommodations.seed.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('OK: no guarded baseline seed-data path changed');
    });

    it('fails when required amenity JSON changed with no new migration and no marker', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
        expect(result.stdout).toContain('data-migrate-make');
    });

    it('passes when required data changed AND a new NNNN- migration was added', () => {
        // Arrange
        const changed = [
            'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json',
            'A\tpackages/seed/src/data-migrations/0004-fix-wifi-amenity.ts'
        ].join('\n');

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(
            'OK: baseline data changed AND a new data-migration was added'
        );
    });

    it('does NOT count a MODIFIED (not added) migration file as satisfying the rule', () => {
        // Arrange
        const changed = [
            'M\tpackages/seed/src/data/feature/001-foo.json',
            'M\tpackages/seed/src/data-migrations/0001-billing-plans-ai-consumer-search-limits.ts'
        ].join('\n');

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('passes via the [skip-seed-migration] opt-out marker', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json';
        const marker = 'Cosmetic copy tweak only. [skip-seed-migration]: no live-env impact.';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: marker });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('OK (opt-out)');
    });

    it('guards billing plan/limit config constants (023-025 precedent)', () => {
        // Arrange
        const changed = 'M\tpackages/billing/src/config/plans.config.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('plans.config.ts');
    });

    it('guards pointOfInterest JSON changes (HOS-113 T-027, R-5)', () => {
        // Arrange
        const changed =
            'M\tpackages/seed/src/data/pointOfInterest/001-point-of-interest-autodromo_concepcion_del_uruguay.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
    });

    it('guards internal-/system- prefixed files in the mixed data/tag/ folder', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/tag/internal-001-revisar-contenido.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('does NOT guard non-required files in the mixed data/tag/ folder (example passthrough)', () => {
        // Arrange: a tag file with neither the internal- nor system- prefix
        // (the example seeder's manifest-driven passthrough files live here).
        const changed = 'M\tpackages/seed/src/data/tag/culture-travel.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('does NOT guard example/**/*.json data (non-deterministic, regenerated on reseed)', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/accommodation/uruguay/001-some-fixture.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('fails open (no diff) when BASE_SHA does not resolve (e.g. first push, all-zero sha)', () => {
        // Arrange: no CHANGED_FILES_OVERRIDE — forces the real compute_changed_files
        // path, with an unresolvable BASE_SHA.
        const result = runGuard({
            BASE_SHA: '0000000000000000000000000000000000000000',
            CHANGED_FILES_OVERRIDE: '',
            MARKER_TEXT_OVERRIDE: ''
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });
});
