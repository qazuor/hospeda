/**
 * Tests for `scripts/check-seed-migration-schema-probe.sh` (HOS-513).
 *
 * A guard is only worth what its POSITIVE case proves. One that never detects
 * anything reports "no findings" forever and reads exactly like a clean repo,
 * so the first assertion here feeds it the real 0037 body and requires it to
 * fail. The negative cases then pin down that it is not simply failing on
 * everything.
 *
 * The script scans `MIGRATIONS_DIR_OVERRIDE` when set, which is how these tests
 * hand it fixtures instead of the real migration set — the same override
 * mechanism `check-seed-dual-write.sh` exposes for the same reason.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '../..');
const SCRIPT_PATH = path.join(repoRoot, 'scripts/check-seed-migration-schema-probe.sh');

let fixtureDir: string;

/** Writes a migration fixture and returns its path. */
function writeMigration(name: string, body: string): void {
    writeFileSync(path.join(fixtureDir, name), body, 'utf-8');
}

/** Runs the guard against the fixture dir, capturing exit code and output. */
function runGuard(): { exitCode: number; output: string } {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: repoRoot,
            encoding: 'utf-8',
            env: { ...process.env, MIGRATIONS_DIR_OVERRIDE: fixtureDir }
        });
        return { exitCode: 0, output: stdout };
    } catch (error) {
        const e = error as { status?: number; stdout?: string; stderr?: string };
        return { exitCode: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

/**
 * The offending body, copied from
 * `0037-hos-390-content-media-to-relational.ts`. Kept verbatim so this test
 * fails if the guard stops recognizing the exact shape it was written for.
 */
const OFFENDING_BODY = `
async function readPhotoCandidates(
    db: SeedMigrationCtx['db'],
    table: 'posts' | 'events'
): Promise<PhotoCandidate[]> {
    const columnExists = await db.execute(
        sql\`SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = \${table} AND column_name = 'media'\`
    );
    if ((columnExists.rows?.length ?? 0) === 0) return [];
    return [];
}
`;

/** A migration that verifies the target state instead — the 0042 shape. */
const COMPLIANT_BODY = `
export const meta = { name: '0100-compliant', group: 'required' } as const;

export async function up(ctx: SeedMigrationCtx) {
    const matched = await countRows(ctx);
    if (matched === 0) {
        const already = await countAlreadyApplied(ctx);
        if (already > 0) {
            return { summary: 'Already applied.' };
        }
        throw new Error('Matched zero rows and nothing looks applied. Refusing to ledger this.');
    }
    return { summary: \`Updated \${matched} row(s).\` };
}
`;

beforeEach(() => {
    fixtureDir = mkdtempSync(path.join(tmpdir(), 'seed-migration-guard-'));
});

afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
});

describe('check-seed-migration-schema-probe.sh', () => {
    describe('the positive case — without this the guard proves nothing', () => {
        it('FAILS on the real 0037 schema-existence probe', () => {
            writeMigration('0100-new-media-migration.ts', OFFENDING_BODY);

            const result = runGuard();

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('schema-existence probe');
            expect(result.output).toContain('0100-new-media-migration.ts');
        });

        it('names the migration to copy instead', () => {
            writeMigration('0100-new-media-migration.ts', OFFENDING_BODY);

            const result = runGuard();

            expect(result.output).toContain('0042-reattribute-imported-events.ts');
        });

        it.each([
            ['to_regclass', "const t = await db.execute(sql`SELECT to_regclass('public.posts')`);"],
            ['pg_catalog', 'await db.execute(sql`SELECT 1 FROM pg_catalog.pg_tables`);'],
            [
                'has_column_privilege',
                "await db.execute(sql`SELECT has_column_privilege('posts','media','SELECT')`);"
            ]
        ])('FAILS on the %s probe variant too', (_label, line) => {
            writeMigration('0101-variant.ts', `export async function up() {\n    ${line}\n}\n`);

            expect(runGuard().exitCode).toBe(1);
        });
    });

    describe('the negative cases — it must not fail on everything', () => {
        it('PASSES on a migration that verifies the target state', () => {
            writeMigration('0100-compliant.ts', COMPLIANT_BODY);

            const result = runGuard();

            expect(result.exitCode).toBe(0);
            expect(result.output).toContain('no schema-existence probes found');
        });

        it('PASSES when information_schema is only discussed in JSDoc', () => {
            // Several real migrations explain in prose why they deliberately do
            // NOT probe. Matching that would make the guard cry wolf, which is
            // how guards get disabled.
            writeMigration(
                '0100-documented.ts',
                [
                    '/**',
                    ' * Ported from a .plan.sql that used an `information_schema.tables`',
                    ' * existence check. Dropped here: the runner guarantees the structural',
                    ' * migration already ran, so `to_regclass` would only hide a real failure.',
                    ' */',
                    'export async function up() {',
                    '    // no information_schema probe here either',
                    '    return { summary: "ok" };',
                    '}',
                    ''
                ].join('\n')
            );

            const result = runGuard();

            expect(result.exitCode).toBe(0);
        });

        it('ignores non-migration files beside the migrations', () => {
            // runner.ts / discover.ts legitimately inspect the schema; only
            // NNNN-prefixed files are migrations.
            writeMigration('0100-compliant.ts', COMPLIANT_BODY);
            writeMigration(
                'runner.ts',
                'await db.execute(sql`SELECT 1 FROM information_schema.columns`);\n'
            );

            expect(runGuard().exitCode).toBe(0);
        });
    });

    describe('the frozen historical exemptions', () => {
        it.each([
            '0034-hos-372-commerce-media-to-relational.ts',
            '0037-hos-390-content-media-to-relational.ts'
        ])('PASSES on the exempt file %s', (name) => {
            writeMigration(name, OFFENDING_BODY);

            expect(runGuard().exitCode).toBe(0);
        });

        it('does NOT exempt a third file that copies them', () => {
            // The whole point: the vector is the next copy, not the two that
            // already ran.
            writeMigration('0034-hos-372-commerce-media-to-relational.ts', OFFENDING_BODY);
            writeMigration('0055-hos-999-more-media-to-relational.ts', OFFENDING_BODY);

            const result = runGuard();

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('0055-hos-999-more-media-to-relational.ts');
            expect(result.output).not.toContain('0034-hos-372');
        });
    });

    describe('the guard refuses to report a vacuous pass', () => {
        it('FAILS when it scanned zero migration files', () => {
            // An empty scan looks identical to a clean repo. It must not.
            const result = runGuard();

            expect(result.exitCode).toBe(1);
            expect(result.output).toContain('scanned 0 migration files');
        });
    });

    describe('against the real migration set', () => {
        it('PASSES on the repository as it stands today', () => {
            const stdout = execFileSync('bash', [SCRIPT_PATH], {
                cwd: repoRoot,
                encoding: 'utf-8'
            });

            expect(stdout).toContain('no schema-existence probes found');
            // Guards against a silently-shrinking scan: the real set is ~54
            // files and only ever grows.
            const scanned = /Scanned (\d+) numbered data-migration/.exec(stdout);
            expect(scanned).not.toBeNull();
            expect(Number.parseInt(scanned?.[1] ?? '0', 10)).toBeGreaterThanOrEqual(50);
        });
    });
});
