import { execFileSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { GeneratedBaseline } from '../../cutover-v6/step-6/generate-baseline.ts';
import { replaceHistories } from '../../cutover-v6/step-6/replace-histories.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture(): { root: string; baseline: GeneratedBaseline } {
    const temp = path.join(ROOT, '.hoja/tmp');
    mkdirSync(temp, { recursive: true });
    const root = mkdtempSync(path.join(temp, 'step6-repo-'));
    dirs.push(root);
    const migrations = path.join(root, 'packages/db/src/migrations');
    const seed = path.join(root, 'packages/seed/src/data-migrations');
    mkdirSync(path.join(migrations, 'meta'), { recursive: true });
    mkdirSync(path.join(migrations, 'extras'), { recursive: true });
    mkdirSync(seed, { recursive: true });
    writeFileSync(path.join(migrations, '0001_old.sql'), 'SELECT 1;');
    writeFileSync(path.join(migrations, '0002_old.sql'), 'SELECT 2;');
    writeFileSync(path.join(migrations, 'meta/0001_snapshot.json'), '{}');
    writeFileSync(path.join(migrations, 'meta/_journal.json'), '{"entries":[]}');
    writeFileSync(path.join(migrations, 'extras/001_keep.sql'), 'SELECT 3;');
    writeFileSync(path.join(seed, '0001-old-module.ts'), 'export {};');
    writeFileSync(path.join(seed, 'runner.ts'), 'export {};');
    mkdirSync(path.join(seed, 'data'), { recursive: true });
    writeFileSync(path.join(seed, 'data/keep.json'), '{}');
    const guard = path.join(root, 'scripts/check-old-grouping-word.sh');
    mkdirSync(path.dirname(guard), { recursive: true });
    cpSync(path.join(ROOT, 'scripts/check-old-grouping-word.sh'), guard);
    const stale = path.join(root, 'scripts/__tests__/check-old-grouping-word.test.ts');
    mkdirSync(path.dirname(stale), { recursive: true });
    writeFileSync(
        stale,
        `const prior = '${['both constants ship ', 'off'].join('')}';\nconst removedModule = '${['0001-old', 'module.ts'].join('')}';\n`
    );
    const out = path.join(root, 'generated');
    mkdirSync(path.join(out, 'meta'), { recursive: true });
    const sqlPath = path.join(out, '0000_baseline.sql');
    writeFileSync(sqlPath, 'CREATE TABLE sample (id integer);');
    const journalPath = path.join(out, 'meta/_journal.json');
    writeFileSync(
        journalPath,
        JSON.stringify({
            entries: [{ idx: 0, version: '7', when: 123, tag: '0000_baseline', breakpoints: true }]
        })
    );
    const snapshotPath = path.join(out, 'meta/0000_snapshot.json');
    writeFileSync(snapshotPath, '{}');
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    execFileSync('git', ['add', '--', 'packages', 'scripts'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root });
    return {
        root,
        baseline: { sqlPath, journalPath, snapshotPath, tag: '0000_baseline', when: 123 }
    };
}

describe('step 6 repository replacement', () => {
    it('keeps extras and seed infrastructure, writes one baseline, flips G8, and reports stale references', () => {
        const { root, baseline } = fixture();
        const result = replaceHistories({
            repoRoot: root,
            baseline,
            referenceSql: 'INSERT INTO catalog_key VALUES (1);',
            dryRun: false
        });
        expect(readdirSync(path.join(root, 'packages/db/src/migrations')).sort()).toEqual([
            '0000_baseline.sql',
            'extras',
            'meta'
        ]);
        expect(
            readFileSync(path.join(root, 'packages/db/src/migrations/extras/001_keep.sql'), 'utf8')
        ).toBe('SELECT 3;');
        expect(
            JSON.parse(
                readFileSync(
                    path.join(root, 'packages/db/src/migrations/meta/_journal.json'),
                    'utf8'
                )
            ).entries
        ).toHaveLength(1);
        expect(readdirSync(path.join(root, 'packages/seed/src/data-migrations')).sort()).toEqual([
            'data',
            'runner.ts'
        ]);
        expect(
            readFileSync(path.join(root, 'scripts/check-old-grouping-word.sh'), 'utf8')
        ).toContain('STEP6_RULE=on');
        expect(result.staleReferences).toContain(
            'scripts/__tests__/check-old-grouping-word.test.ts'
        );
        expect(
            execFileSync('bash', ['scripts/check-old-grouping-word.sh'], {
                cwd: root,
                env: { ...process.env, HOSPEDA_PRODUCTION_BUILD: '1' },
                encoding: 'utf8'
            })
        ).toContain('All checks passed.');
        const guardPath = path.join(root, 'scripts/check-old-grouping-word.sh');
        const guard = readFileSync(guardPath, 'utf8').replace(
            'ALLOWLIST=(\n    "$PROGRAM_SPECS"\n)',
            'ALLOWLIST=(\n    "$HISTORY_DB"\n    "$HISTORY_SEED"\n    "$PROGRAM_SPECS"\n)'
        );
        writeFileSync(guardPath, guard);
        expect(() =>
            execFileSync('bash', ['scripts/check-old-grouping-word.sh'], {
                cwd: root,
                env: { ...process.env, HOSPEDA_PRODUCTION_BUILD: '1' },
                stdio: 'pipe'
            })
        ).toThrow();
    });
    it('dry run changes nothing and execution refuses a dirty protected path', () => {
        const { root, baseline } = fixture();
        const before = readFileSync(
            path.join(root, 'packages/db/src/migrations/0001_old.sql'),
            'utf8'
        );
        replaceHistories({ repoRoot: root, baseline, referenceSql: '', dryRun: true });
        expect(
            readFileSync(path.join(root, 'packages/db/src/migrations/0001_old.sql'), 'utf8')
        ).toBe(before);
        writeFileSync(path.join(root, 'packages/db/src/migrations/0001_old.sql'), 'changed');
        expect(() =>
            replaceHistories({ repoRoot: root, baseline, referenceSql: '', dryRun: false })
        ).toThrow('Refusing to replace histories');
    });
});
