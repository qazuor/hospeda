/**
 * @fileoverview
 * HOS-1638 (B13a.10): the legacy-billing-table guard correctly identifies code
 * that references a dropped table, ignores comments, and fails closed on zero
 * files.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findLegacyTableReferences,
    LEGACY_BILLING_TABLES,
    run
} from '../check-no-legacy-billing-tables.js';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'legacy-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

describe('HOS-1638 · tablas del cobro viejo', () => {
    it('catches a bare SQL table reference in code', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: `SELECT 1 FROM "billing_subscriptions"`
        });

        expect(hits).toHaveLength(1);
        expect(hits[0]).toEqual({
            file: 'test.ts',
            line: 1,
            table: 'billing_subscriptions'
        });
    });

    it('ignores the table name inside a // comment', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: '// billing_subscriptions is old'
        });

        expect(hits).toHaveLength(0);
    });

    it('ignores the table name inside a * JSDoc comment', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: ' * billing_subscriptions was dropped'
        });

        expect(hits).toHaveLength(0);
    });

    it('ignores the table name inside a /* */ block comment', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: `/* billing_subscriptions
 * was dropped
 * in migration 0125 */`
        });

        expect(hits).toHaveLength(0);
    });

    it('does not match partial table names: billing_option, billing_deadline_version, ck_billing_option_cycle', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: `
const a = billing_option;
const b = billing_deadline_version;
const c = ck_billing_option_cycle;
`
        });

        expect(hits).toHaveLength(0);
    });

    it('catches entity_subscriptions (not all start with billing_)', () => {
        const hits = findLegacyTableReferences({
            file: 'test.ts',
            source: 'SELECT * FROM "entity_subscriptions"'
        });

        expect(hits).toHaveLength(1);
        expect(hits[0].table).toBe('entity_subscriptions');
    });
});

describe('LEGACY_BILLING_TABLES list', () => {
    it('matches every DROP TABLE "x" from the migration', () => {
        const migrationPath = path.resolve(
            import.meta.dirname,
            '../../packages/db/src/migrations/0125_robust_cassandra_nova.sql'
        );
        const migration = readFileSync(migrationPath, 'utf8');
        const dropped = migration.matchAll(
            /DROP TABLE "(billing_[a-z_]+|entity_subscriptions|featured_listing_addon_grants|partner_subscriptions)" CASCADE/g
        );
        const migrationNames = [...dropped].map((m) => m[1]);

        // Both sets must be the same
        expect(LEGACY_BILLING_TABLES).toEqual(migrationNames.sort());
    });
});

describe('guard over the real repo', () => {
    it('reports zero hits and more than zero files scanned', () => {
        const result = run();

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('OK:');
        expect(result.output).toMatch(/file\(s\)\./);
        // Extract the file count from the output
        const match = result.output.match(/across (\d+) file/);
        expect(match).not.toBeNull();
        expect(Number(match![1])).toBeGreaterThan(0);
    });
});

describe('zero-files guard', () => {
    it('fails when it scans zero files', () => {
        const root = makeTree({ files: {} });
        const result = run({ root });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('ERROR');
        expect(result.output).toContain('scanned 0 files');
    });
});

describe('guard wiring', () => {
    it('runs as a standalone check: script', () => {
        const root = path.resolve(import.meta.dirname, '../..');
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

        expect(pkg.scripts['check:no-legacy-billing-tables']).toBe(
            'tsx scripts/check-no-legacy-billing-tables.ts'
        );
    });

    it('is listed in check:guards before check:fake-lies', () => {
        const root = path.resolve(import.meta.dirname, '../..');
        const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

        expect(pkg.scripts['check:guards']).toContain('pnpm check:no-legacy-billing-tables');

        // check:fake-lies must be the LAST guard
        const guards = pkg.scripts['check:guards'].split('&&');
        const lastGuard = guards[guards.length - 1].trim();
        expect(lastGuard).toContain('check:fake-lies');

        // check:no-legacy-billing-tables must not be after check:fake-lies
        const fakePos = pkg.scripts['check:guards'].indexOf('check:fake-lies');
        const legacyPos = pkg.scripts['check:guards'].indexOf('check:no-legacy-billing-tables');
        expect(legacyPos).toBeLessThan(fakePos);
    });
});
