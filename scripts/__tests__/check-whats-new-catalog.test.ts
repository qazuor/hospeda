/**
 * @fileoverview
 * Tests for `scripts/check-whats-new-catalog.sh` (HOS-1214 AC-11).
 *
 * The guard checks three invariants of `apps/api/src/data/whats-new/whats-new.ts`
 * that have no other enforcement (see the script's own header comment):
 * no duplicate id among live entries, no live id that reuses a retired one,
 * and a newest-first `publishedAt` ordering (entries carrying the unresolved
 * `'on-promotion'` marker are skipped by the ordering check).
 *
 * `WHATS_NEW_CATALOG_FILE_OVERRIDE` redirects the guard at a fixture file
 * instead of the real catalog, mirroring the override convention already
 * used by `check-drop-column-release-gap.sh` and `check-no-trial-to-mercadopago.sh`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-whats-new-catalog.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

/** Runs the guard script against a fixture file and captures the result. */
function runGuard(fixtureFile: string): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: REPO_ROOT,
            env: { ...process.env, WHATS_NEW_CATALOG_FILE_OVERRIDE: fixtureFile },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout };
    }
}

describe('check-whats-new-catalog.sh (HOS-1214 AC-11)', () => {
    let fixtureDir: string;

    beforeEach(() => {
        fixtureDir = mkdtempSync(path.join(tmpdir(), 'whats-new-catalog-guard-'));
    });

    afterEach(() => {
        rmSync(fixtureDir, { recursive: true, force: true });
    });

    /** Writes a fixture catalog file and returns its path. */
    function writeFixture(name: string, content: string): string {
        const filePath = path.join(fixtureDir, name);
        writeFileSync(filePath, content, 'utf8');
        return filePath;
    }

    it('passes on the real catalog (positive control)', () => {
        // Arrange / Act
        const result = runGuard(path.join(REPO_ROOT, 'apps/api/src/data/whats-new/whats-new.ts'));

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('All checks passed.');
    });

    it('passes a well-formed catalog with no violations', () => {
        // Arrange
        const file = writeFixture(
            'ok.ts',
            `
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>(['old-retired-entry']);
export const whatsNewEntries = [
    { id: 'newer-entry', publishedAt: '2026-09-07T12:00:00Z' },
    { id: 'older-entry', publishedAt: '2026-09-01T00:00:00Z' }
];
`
        );

        // Act
        const result = runGuard(file);

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('passes when an unresolved on-promotion entry sits above dated entries (no date to order)', () => {
        // Arrange
        const file = writeFixture(
            'on-promotion.ts',
            `
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>([]);
export const whatsNewEntries = [
    { id: 'not-yet-dated', publishedAt: 'on-promotion' },
    { id: 'dated', publishedAt: '2026-09-01T00:00:00Z' }
];
`
        );

        // Act
        const result = runGuard(file);

        // Assert
        expect(result.exitCode).toBe(0);
    });

    // -------------------------------------------------------------------------
    // Case 1 — duplicate id
    // -------------------------------------------------------------------------
    it('fails naming a duplicate id among live entries', () => {
        // Arrange
        const file = writeFixture(
            'dup-id.ts',
            `
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>([]);
export const whatsNewEntries = [
    { id: 'a-dup', publishedAt: '2026-09-07T12:00:00Z' },
    { id: 'a-dup', publishedAt: '2026-09-06T12:00:00Z' }
];
`
        );

        // Act
        const result = runGuard(file);

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('duplicate id');
        expect(result.stdout).toContain('a-dup');
    });

    // -------------------------------------------------------------------------
    // Case 2 — retired id reused
    // -------------------------------------------------------------------------
    it('fails naming a live id that reuses a retired id', () => {
        // Arrange
        const file = writeFixture(
            'retired-reuse.ts',
            `
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>([
    'old-id'
]);
export const whatsNewEntries = [
    { id: 'old-id', publishedAt: '2026-09-07T12:00:00Z' }
];
`
        );

        // Act
        const result = runGuard(file);

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('reused from RETIRED_WHATS_NEW_IDS');
        expect(result.stdout).toContain('old-id');
    });

    // -------------------------------------------------------------------------
    // Case 3 — broken newest-first order
    // -------------------------------------------------------------------------
    it('fails naming entries declared out of newest-first order', () => {
        // Arrange
        const file = writeFixture(
            'bad-order.ts',
            `
export const RETIRED_WHATS_NEW_IDS: ReadonlySet<string> = new Set<string>([]);
export const whatsNewEntries = [
    { id: 'older', publishedAt: '2026-09-01T12:00:00Z' },
    { id: 'newer', publishedAt: '2026-09-07T12:00:00Z' }
];
`
        );

        // Act
        const result = runGuard(file);

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('not declared newest-first');
        expect(result.stdout).toContain('newer');
        expect(result.stdout).toContain('older');
    });

    it('fails when the target file does not exist', () => {
        // Arrange / Act
        const result = runGuard(path.join(fixtureDir, 'does-not-exist.ts'));

        // Assert
        expect(result.exitCode).toBe(1);
    });
});
