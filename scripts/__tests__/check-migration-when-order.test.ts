/**
 * @fileoverview
 * Guard `check-migration-when-order`: pure-function cases for both rules, plus
 * the real journal of this tree (rule 1) and the CLI over temp journal files.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ALLOWED_INVERSIONS,
    checkJournals,
    type Journal,
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
