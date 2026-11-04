/**
 * @fileoverview
 * Guard `check-migration-when-order`: pure-function cases for both rules, plus
 * the real journal of this tree (rule 1) and the CLI over temp journal files.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ALLOWED_INVERSIONS,
    checkJournals,
    type Journal,
    normalizeTarget,
    parseJournal,
    run
} from '../check-migration-when-order.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const journal = (...rows: ReadonlyArray<readonly [string, number]>): Journal => ({
    entries: rows.map(([tag, when], idx) => ({ idx, tag, when }))
});

const tempDirs: string[] = [];
afterEach(() => {
    for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'when-order-'));
    tempDirs.push(dir);
    return dir;
}

describe('rule 1: monotonicity', () => {
    it('accepts a strictly increasing journal', () => {
        const r = checkJournals({ current: journal(['a', 10], ['b', 20], ['c', 30]), base: null });
        expect(r.exitCode).toBe(0);
    });

    it('rejects a new out-of-order pair and names the tag', () => {
        const r = checkJournals({ current: journal(['a', 10], ['b', 30], ['c', 20]), base: null });
        expect(r.exitCode).toBe(1);
        expect(r.violations.join('\n')).toContain('c (idx 2');
    });

    it('rejects an equal pair (strict comparison)', () => {
        const r = checkJournals({ current: journal(['a', 10], ['b', 10]), base: null });
        expect(r.exitCode).toBe(1);
    });

    it('accepts the allowlisted 44/45 pair exactly', () => {
        const [a] = ALLOWED_INVERSIONS;
        const entries = [
            { idx: 44, tag: 'x44', when: a?.previousWhen ?? 0 },
            { idx: 45, tag: 'x45', when: a?.when ?? 0 }
        ];
        expect(checkJournals({ current: { entries }, base: null }).exitCode).toBe(0);
    });

    it('does not allowlist the same idx pair with different whens', () => {
        const entries = [
            { idx: 44, tag: 'x44', when: 1783041491334 },
            { idx: 45, tag: 'x45', when: 1783035614000 }
        ];
        expect(checkJournals({ current: { entries }, base: null }).exitCode).toBe(1);
    });
});

describe('rule 2: above the base', () => {
    const base = journal(['a', 10], ['b', 20]);

    it('accepts a new entry above the base maximum (target staging)', () => {
        const current = journal(['a', 10], ['b', 20], ['c', 21]);
        expect(checkJournals({ current, base, target: 'staging' }).exitCode).toBe(0);
    });

    it('rejects a new entry below the base maximum and names its tag', () => {
        const current = journal(['a', 10], ['b', 20], ['c_new', 15]);
        const r = checkJournals({ current, base, target: 'staging' });
        expect(r.exitCode).toBe(1);
        expect(r.violations.join('\n')).toContain('c_new');
    });

    it('rejects a new entry equal to the base maximum (strict comparison)', () => {
        const current = journal(['a', 10], ['b', 20], ['c_new', 20]);
        expect(checkJournals({ current, base, target: 'main' }).exitCode).toBe(1);
    });

    it('skips rule 2 for an epic target', () => {
        // Monotonic, but the new entry sits below the base maximum (20).
        const current = journal(['a', 10], ['c_new', 15]);
        expect(checkJournals({ current, base, target: 'staging' }).exitCode).toBe(1);
        const r = checkJournals({ current, base, target: 'epic/x' });
        expect(r.exitCode).toBe(0);
        expect(r.notes.join('\n')).toContain('RULE 2 skipped');
    });

    it('skips rule 2 with no target', () => {
        const r = checkJournals({ current: journal(['a', 10]), base: null });
        expect(r.exitCode).toBe(0);
        expect(r.notes.join('\n')).toContain('RULE 2 skipped');
    });

    it('fails closed when the base journal is missing for staging', () => {
        const r = checkJournals({ current: journal(['a', 10]), base: null, target: 'staging' });
        expect(r.exitCode).toBe(1);
        expect(r.violations.join('\n')).toContain('Failing closed');
    });
});

describe('real tree and CLI', () => {
    it('the real journal passes rule 1', () => {
        expect(run({ args: [], root: REPO_ROOT }).exitCode).toBe(0);
    });

    it('CLI fails closed when --base=staging has no readable base journal', () => {
        const dir = tempDir();
        writeFileSync(
            path.join(dir, 'j.json'),
            JSON.stringify({ entries: [{ idx: 0, tag: 'a', when: 1 }] })
        );
        const r = run({
            args: ['--base=staging', '--journal-file=j.json', '--base-journal-file=missing.json'],
            root: dir
        });
        expect(r.exitCode).toBe(1);
        expect(r.output).toContain('Failing closed');
    });

    it('CLI reports a low-when new entry against a base journal file', () => {
        const dir = tempDir();
        writeFileSync(
            path.join(dir, 'base.json'),
            JSON.stringify({ entries: [{ idx: 0, tag: 'a', when: 100 }] })
        );
        writeFileSync(
            path.join(dir, 'cur.json'),
            JSON.stringify({
                entries: [
                    { idx: 0, tag: 'a', when: 100 },
                    { idx: 1, tag: 'ok_one', when: 150 },
                    { idx: 2, tag: 'new_low', when: 160 }
                ]
            })
        );
        const green = run({
            args: ['--base=staging', '--journal-file=cur.json', '--base-journal-file=base.json'],
            root: dir
        });
        expect(green.exitCode).toBe(0);

        writeFileSync(
            path.join(dir, 'cur.json'),
            JSON.stringify({
                entries: [
                    { idx: 0, tag: 'a', when: 100 },
                    { idx: 1, tag: 'new_low', when: 90 }
                ]
            })
        );
        const red = run({
            args: ['--base=staging', '--journal-file=cur.json', '--base-journal-file=base.json'],
            root: dir
        });
        expect(red.exitCode).toBe(1);
        expect(red.output).toContain('new_low');
    });

    it('baseRef (GITHUB_BASE_REF) is used when --base is absent', () => {
        const r = run({ args: [], baseRef: 'epic/x', root: REPO_ROOT });
        expect(r.output).toContain('RULE 2 skipped');
    });
});

describe('review fixes', () => {
    const writeJson = (dir: string, name: string, value: unknown): void =>
        writeFileSync(path.join(dir, name), JSON.stringify(value));
    const good = { entries: [{ idx: 0, tag: 'a', when: 100 }] };

    it('parseJournal rejects an empty journal', () => {
        expect(() => parseJournal({ text: '{"entries":[]}', label: 'x' })).toThrow(/empty/);
    });

    it('CLI exits 1 on an empty base journal and never claims a comparison', () => {
        const dir = tempDir();
        writeJson(dir, 'cur.json', good);
        writeJson(dir, 'base.json', { entries: [] });
        const r = run({
            args: ['--base=staging', '--journal-file=cur.json', '--base-journal-file=base.json'],
            root: dir
        });
        expect(r.exitCode).toBe(1);
        expect(r.output).not.toContain('sit above');
    });

    it('CLI exits 1 on an empty current journal', () => {
        const dir = tempDir();
        writeJson(dir, 'cur.json', { entries: [] });
        const r = run({ args: ['--journal-file=cur.json'], root: dir });
        expect(r.exitCode).toBe(1);
    });

    it('does not print the rule 2 OK message when rule 2 did not run', () => {
        const r = run({ args: ['--base=epic/x'], root: REPO_ROOT });
        expect(r.exitCode).toBe(0);
        expect(r.output).not.toContain('sit above');
    });

    it('CLI exits 1 on invalid JSON in the base journal', () => {
        const dir = tempDir();
        writeJson(dir, 'cur.json', good);
        writeFileSync(path.join(dir, 'base.json'), '{not json');
        const r = run({
            args: ['--base=staging', '--journal-file=cur.json', '--base-journal-file=base.json'],
            root: dir
        });
        expect(r.exitCode).toBe(1);
        expect(r.output).toContain('Failing closed');
    });

    it('normalizes origin/ and refs/heads/ prefixes and whitespace', () => {
        expect(normalizeTarget(' origin/staging ')).toBe('staging');
        expect(normalizeTarget('refs/heads/main')).toBe('main');
        const base = journal(['a', 10], ['b', 20]);
        const current = journal(['a', 10], ['c_new', 15]);
        expect(checkJournals({ current, base, target: 'origin/staging' }).exitCode).toBe(1);
        expect(checkJournals({ current, base, target: 'refs/heads/staging' }).exitCode).toBe(1);
    });

    it('an empty --base= does not override GITHUB_BASE_REF', () => {
        const r = run({ args: ['--base='], baseRef: 'epic/x', root: REPO_ROOT });
        expect(r.output).toContain('target "epic/x"');
    });

    it('rule 2 message says regenerate or raise when, and that idx alone is not enough', () => {
        const base = journal(['a', 10], ['b', 20]);
        const current = journal(['a', 10], ['c_new', 15]);
        const msg = checkJournals({ current, base, target: 'staging' }).violations.join('\n');
        expect(msg).toContain('Regenerate');
        expect(msg).toContain('idx alone is not enough');
    });

    it('a renamed tag counts as new and must be above the base maximum', () => {
        const base = journal(['a', 10], ['b_old_name', 20]);
        const current = journal(['a', 10], ['b_renamed', 20]);
        const r = checkJournals({ current, base, target: 'staging' });
        expect(r.exitCode).toBe(1);
        expect(r.violations.join('\n')).toContain('b_renamed');
    });

    it('the CLI really runs when invoked through a symlink', () => {
        const dir = tempDir();
        const link = path.join(dir, 'linked-guard.ts');
        symlinkSync(path.join(REPO_ROOT, 'scripts/check-migration-when-order.ts'), link);
        writeJson(dir, 'bad.json', {
            entries: [
                { idx: 0, tag: 'a', when: 100 },
                { idx: 1, tag: 'b', when: 50 }
            ]
        });
        let status = 0;
        try {
            execFileSync(
                process.execPath,
                ['--import', 'tsx', link, `--journal-file=${path.join(dir, 'bad.json')}`],
                { cwd: REPO_ROOT, stdio: 'pipe' }
            );
        } catch (error) {
            status = (error as { status?: number }).status ?? -1;
        }
        expect(status).toBe(1);
    });
});
