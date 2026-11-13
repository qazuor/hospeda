/**
 * @fileoverview
 * TEST:V8b:8 AC:V8b:7 — pure SQL rules, real additive migrations, phase context,
 * and a scratch Git history covering the guard's branch attribution contract.
 */
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findDestructiveStatements,
    isPhaseBranchContext,
    run
} from '../check-additive-migrations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrations = 'packages/db/src/migrations';
const scratchDirs: string[] = [];

function scratchRepo(): string {
    const cwd = mkdtempSync(path.join(tmpdir(), 'additive-migrations-'));
    scratchDirs.push(cwd);
    const git = (...args: string[]): string =>
        execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    const write = (file: string, text: string): void => {
        const target = path.join(cwd, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, text);
    };
    const commit = (message: string): string => {
        git('add', '-A');
        git('-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', message);
        return git('rev-parse', 'HEAD');
    };
    git('init', '-q', '-b', 'staging');
    write(`${migrations}/0001_old_destructive.sql`, 'ALTER TABLE "old" DROP COLUMN "gone";\n');
    const base = commit('base with historical destructive migration');
    git('update-ref', 'refs/remotes/origin/staging', base);
    git('checkout', '-qb', 'epic/test');
    return cwd;
}

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
}

function addCommit(
    cwd: string,
    entries: ReadonlyArray<readonly [string, string]>,
    message: string
): void {
    for (const [file, content] of entries) {
        const target = path.join(cwd, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
    git(cwd, 'add', '-A');
    git(cwd, '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', message);
}

afterEach(() => {
    for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('TEST:V8b:8 AC:V8b:7 check-additive-migrations destructive SQL guard', () => {
    it.each([
        ['DROP_TABLE', 'DROP TABLE "x";', 'DROP_TABLE'],
        ['DROP_TABLE with IF EXISTS', 'DROP TABLE IF EXISTS "x";', 'DROP_TABLE'],
        ['DROP_COLUMN', 'ALTER TABLE "x" DROP COLUMN "y";', 'DROP_COLUMN'],
        ['DROP_COLUMN with IF EXISTS', 'ALTER TABLE "x" DROP COLUMN IF EXISTS "y";', 'DROP_COLUMN'],
        [
            'DROP_COLUMN in a multi-action ALTER',
            'ALTER TABLE "x" ADD COLUMN "z" text, DROP COLUMN "y";',
            'DROP_COLUMN'
        ],
        ['RENAME_TABLE', 'ALTER TABLE "x" RENAME TO "y";', 'RENAME_TABLE'],
        ['RENAME_COLUMN without COLUMN', 'ALTER TABLE "x" RENAME "a" TO "b";', 'RENAME_COLUMN'],
        ['RENAME_COLUMN with COLUMN', 'ALTER TABLE "x" RENAME COLUMN "a" TO "b";', 'RENAME_COLUMN'],
        [
            'CHANGE_COLUMN_TYPE with TYPE',
            'ALTER TABLE "x" ALTER COLUMN "y" TYPE text;',
            'CHANGE_COLUMN_TYPE'
        ],
        [
            'CHANGE_COLUMN_TYPE with SET DATA TYPE',
            'ALTER TABLE "x" ALTER COLUMN "y" SET DATA TYPE text;',
            'CHANGE_COLUMN_TYPE'
        ]
    ])('finds %s with the exact rule and initial line', (_label, sql, rule) => {
        expect(
            findDestructiveStatements({
                file: 'migration.sql',
                sql: `-- header\n${sql};--> statement-breakpoint`
            })
        ).toEqual([
            {
                file: 'migration.sql',
                line: 2,
                rule,
                statement: sql
                    .replaceAll('"x"', '"_"')
                    .replaceAll('"y"', '"_"')
                    .replaceAll('"z"', '"_"')
                    .replaceAll('"a"', '"_"')
                    .replaceAll('"b"', '"_"')
                    .toUpperCase()
                    .replace(/;$/, '')
            }
        ]);
    });

    it('permits every additive or explicitly allowed statement and masks comments and quoted text', () => {
        const allowed = [
            'ALTER TYPE "role" ADD VALUE \'new\';',
            'ALTER TABLE "x" ADD COLUMN "y" text;',
            'ALTER TABLE "x" ADD COLUMN "y" text DEFAULT \'safe\';',
            'ALTER TABLE "x" DROP CONSTRAINT "check_x", ADD CONSTRAINT "check_x" CHECK ("state" IN (\'a\', \'b\'));',
            'CREATE INDEX "ix" ON "x" ("y");',
            'CREATE UNIQUE INDEX "ix" ON "x" ("y");',
            'DROP INDEX "ix";',
            'ALTER TABLE "x" ADD CONSTRAINT "check_x" CHECK (true);',
            'ALTER TABLE "x" RENAME CONSTRAINT "old" TO "new";',
            'ALTER TABLE "x" ALTER COLUMN "y" DROP DEFAULT;',
            'ALTER TABLE "x" ALTER COLUMN "y" DROP NOT NULL;',
            'ALTER TABLE "x" ALTER COLUMN "y" SET DEFAULT \'safe\';'
        ];
        for (const sql of allowed) {
            expect(sql.trim(), 'control SQL is non-empty').not.toBe('');
            expect(
                sql.split(';').filter((part) => part.trim()).length,
                'control has a statement'
            ).toBeGreaterThan(0);
            expect(findDestructiveStatements({ file: 'control.sql', sql })).toEqual([]);
        }
        const masked = [
            '-- ALTER TABLE "x" DROP COLUMN "y";\nSELECT 1;',
            '/* ALTER TABLE "x" DROP COLUMN "y"; */ SELECT 1;',
            "SELECT 'DROP COLUMN';",
            'SELECT "drop";'
        ];
        for (const sql of masked)
            expect(findDestructiveStatements({ file: 'masked.sql', sql })).toEqual([]);
        expect(
            findDestructiveStatements({
                file: 'body.sql',
                sql: 'DO $$ BEGIN ALTER TABLE x DROP COLUMN y; END $$;'
            })
        ).toEqual([]);
    });

    it('removes inline comments between tokens before recognizing a destructive statement', () => {
        expect(
            findDestructiveStatements({
                file: 'inline-comment.sql',
                sql: 'ALTER TABLE "x" DROP/* this comment separates the tokens */COLUMN "y";'
            })
        ).toEqual([
            {
                file: 'inline-comment.sql',
                line: 1,
                rule: 'DROP_COLUMN',
                statement: 'ALTER TABLE "_" DROP COLUMN "_"'
            }
        ]);
    });

    it('accepts the ten real phase migrations, including all five widened CHECK constraints', () => {
        const files = readdirSync(path.join(root, migrations)).filter((name) =>
            /^(020[3-9]|021[0-2])_.*\.sql$/.test(name)
        );
        expect(files.length).toBeGreaterThanOrEqual(10);
        for (const file of files) {
            const sql = readFileSync(path.join(root, migrations, file), 'utf8');
            expect(findDestructiveStatements({ file, sql }), file).toEqual([]);
        }
        for (const prefix of ['0203', '0205', '0209', '0210', '0211']) {
            const file = files.find((name) => name.startsWith(`${prefix}_`));
            expect(file, `${prefix} is in the real migration set`).toBeDefined();
            expect(readFileSync(path.join(root, migrations, file ?? ''), 'utf8')).toContain(
                'DROP CONSTRAINT "domain_event_event_type_check"'
            );
        }
    });

    it('detects phase context from CI refs and only falls back to the local branch without CI refs', () => {
        expect(
            isPhaseBranchContext({
                env: { GITHUB_BASE_REF: 'epic/HOS-1352-post-mvp' },
                currentBranch: 'feat/x'
            })
        ).toBe(true);
        expect(
            isPhaseBranchContext({
                env: { GITHUB_HEAD_REF: 'epic/phase' },
                currentBranch: 'feat/x'
            })
        ).toBe(true);
        expect(
            isPhaseBranchContext({
                env: { GITHUB_REF_NAME: 'epic/phase' },
                currentBranch: 'feat/x'
            })
        ).toBe(true);
        expect(
            isPhaseBranchContext({
                env: { GITHUB_BASE_REF: 'staging', GITHUB_HEAD_REF: 'fix/x' },
                currentBranch: 'epic/x'
            })
        ).toBe(false);
        expect(isPhaseBranchContext({ env: {}, currentBranch: 'epic/x' })).toBe(true);
        expect(isPhaseBranchContext({ env: {}, currentBranch: 'feat/x' })).toBe(false);
        expect(
            isPhaseBranchContext({ env: { GITHUB_REF_NAME: 'staging' }, currentBranch: 'epic/x' })
        ).toBe(false);
    });

    it('scans only committed added SQL files, fails closed, and uses the merge-base after staging merges', () => {
        const cwd = scratchRepo();
        addCommit(
            cwd,
            [
                [`${migrations}/0002_add_one.sql`, 'ALTER TABLE "x" ADD COLUMN "a" text;'],
                [`${migrations}/0003_add_two.sql`, 'CREATE INDEX "ix" ON "x" ("a");']
            ],
            'two additive migrations'
        );
        const additive = run({ cwd, env: {}, argv: [] });
        expect(additive.exitCode).toBe(0);
        expect(additive.output).toContain('scanned 2 migration file(s)');

        const cases = [
            [`${migrations}/0004_drop.sql`, 'ALTER TABLE "x" DROP COLUMN "y";', 'DROP_COLUMN'],
            [
                `${migrations}/0005_rename.sql`,
                'ALTER TABLE "x" RENAME COLUMN "a" TO "b";',
                'RENAME_COLUMN'
            ],
            [`${migrations}/extras/0006_drop.sql`, 'DROP TABLE "x";', 'DROP_TABLE']
        ] as const;
        for (const [file, sql, rule] of cases) {
            addCommit(cwd, [[file, `${sql}\n`]], `add ${rule}`);
            const rejected = run({ cwd, env: { GITHUB_HEAD_REF: 'epic/test' }, argv: [] });
            expect(rejected.exitCode).toBe(1);
            expect(rejected.output).toContain(`${file}:1: ${rule}`);
        }
        const normalPr = run({ cwd, env: { GITHUB_BASE_REF: 'staging' }, argv: [] });
        expect(normalPr.exitCode).toBe(0);
        expect(normalPr.output).toContain('not a phase branch');

        git(cwd, 'update-ref', '-d', 'refs/remotes/origin/staging');
        const missingBase = run({ cwd, env: { GITHUB_REF_NAME: 'epic/test' }, argv: [] });
        expect(missingBase.exitCode).toBe(1);
        expect(missingBase.output).toContain('cannot resolve the base');
        const missingSince = run({ cwd, env: {}, argv: ['--since=missing-ref'] });
        expect(missingSince.exitCode).toBe(1);
        expect(missingSince.output).toContain('cannot resolve the base');
    });

    it('uses the updated staging merge-base and ignores added non-SQL migration metadata', () => {
        const cwd = scratchRepo();
        const base = git(cwd, 'rev-parse', 'HEAD');
        git(cwd, 'checkout', 'staging');
        const stagedPath = `${migrations}/0002_staging_drop.sql`;
        writeFileSync(path.join(cwd, stagedPath), 'ALTER TABLE "x" DROP COLUMN "staging_only";\n');
        git(cwd, 'add', stagedPath);
        git(
            cwd,
            '-c',
            'user.name=test',
            '-c',
            'user.email=test@example.com',
            'commit',
            '-qm',
            'staging migration'
        );
        const stagingHead = git(cwd, 'rev-parse', 'HEAD');
        git(cwd, 'update-ref', 'refs/remotes/origin/staging', stagingHead);
        git(cwd, 'checkout', 'epic/test');
        git(cwd, 'merge', '--no-edit', 'staging');
        addCommit(
            cwd,
            [
                [
                    `${migrations}/0003_epic_add.sql`,
                    'ALTER TABLE "x" ADD COLUMN "epic_added" text;'
                ],
                [`${migrations}/meta/0003_snapshot.json`, '{"version":1}']
            ],
            'epic additive migration and snapshot'
        );
        const result = run({ cwd, env: { GITHUB_HEAD_REF: 'epic/test' }, argv: [] });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('scanned 1 migration file(s)');
        expect(result.output).not.toContain('0002_staging_drop.sql');
        expect(existsSync(path.join(cwd, `${migrations}/meta/0003_snapshot.json`))).toBe(true);
        expect(base).not.toBe(stagingHead);
    });
});
