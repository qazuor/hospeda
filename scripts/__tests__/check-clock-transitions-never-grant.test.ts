import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CLASSES_PATH,
    type ClassDeclaration,
    type ClassEntry,
    clockGrants,
    run
} from '../check-clock-transitions-never-grant';
import { CATALOG_PATH, CORPUS_PATH, loadCorpus, type TransitionCorpus } from '../transition-corpus';

const ROOT = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr3b-'));
    dirs.push(root);
    for (const file of [CORPUS_PATH, CATALOG_PATH, CLASSES_PATH]) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(path.join(ROOT, file), 'utf8'));
    }
    return root;
}
function readCorpus(root: string): TransitionCorpus {
    return JSON.parse(readFileSync(path.join(root, CORPUS_PATH), 'utf8')) as TransitionCorpus;
}
function saveCorpus(root: string, corpus: TransitionCorpus): void {
    writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
}
function addWrite(root: string, id: string, column: string): void {
    const corpus = readCorpus(root);
    const row = corpus.transitions.find((item) => item.id === id);
    if (!row) throw new Error(`Missing transition ${id}`);
    (row.writes as string[]).push(column);
    saveCorpus(root, corpus);
}
function editClasses(root: string, edit: (entries: ClassEntry[]) => ClassEntry[]): void {
    const file = path.join(root, CLASSES_PATH);
    const declaration = JSON.parse(readFileSync(file, 'utf8')) as ClassDeclaration;
    const updated = { ...declaration, transitions: edit([...declaration.transitions]) };
    writeFileSync(file, JSON.stringify(updated, null, 4));
}
function replaceEntry(root: string, id: string, entry: ClassEntry): void {
    editClasses(root, (entries) => entries.map((item) => (item.id === id ? entry : item)));
}
function editCatalogBullet(root: string, id: string, bullet: string, replacement: string): void {
    const catalogPath = path.join(root, CATALOG_PATH);
    const source = readFileSync(catalogPath, 'utf8');
    const heading = `### \`${id}\``;
    const start = source.indexOf(heading);
    if (start < 0) throw new Error(`Missing catalog transition ${id}`);
    const next = source.indexOf('\n### `', start + heading.length);
    const end = next < 0 ? source.length : next;
    const block = source.slice(start, end);
    const pattern = new RegExp(`(- \\*\\*${bullet}\\*\\*[^:]*:)[^\\n]*`);
    const updated = block.replace(pattern, `$1 ${replacement}`);
    if (updated === block) throw new Error(`Missing ${bullet} bullet for ${id}`);
    writeFileSync(catalogPath, `${source.slice(0, start)}${updated}${source.slice(end)}`);
}

describe('TEST:V5:24 - G-R3-B: a clock-triggered transition that grants', () => {
    it('passes on the real corpus, catalog and class declaration', () => {
        const result = run({ root: ROOT });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('23 transitions');
        expect(result.output).toContain('4 clock');
    });

    it('fails when T3 writes a coverage source (the spec mutation)', () => {
        const root = tempTree();
        addWrite(root, 'TRANS:V:T3', 'courtesy_grant.ends_at');
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('grants');
        expect(result.output).toContain('TRANS:V:T3');
        expect(result.output).toContain('courtesy_grant.ends_at');
    });

    it.each([
        ['TRANS:V:T3', 'trial.ends_at'],
        ['TRANS:V:PB9', 'subscription.status']
    ])('fails when clock row %s writes %s', (id, column) => {
        const root = tempTree();
        addWrite(root, id, column);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('grants');
        expect(result.output).toContain(id);
        expect(result.output).toContain(column);
    });

    it('fails when a clock row enters a granting state', () => {
        const root = tempTree();
        const corpus = readCorpus(root);
        const row = corpus.transitions.find((item) => item.id === 'TRANS:V:PB5');
        if (!row) throw new Error('Missing TRANS:V:PB5');
        (row as { to: string | readonly string[] }).to = 'PUBLISHED';
        saveCorpus(root, corpus);
        editCatalogBullet(root, 'TRANS:V:PB5', 'hacia', '`PUBLISHED`');
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('grants');
        expect(result.output).toContain('TRANS:V:PB5');
        expect(result.output).toContain('enters PUBLISHED');
    });

    it('reports PB3 as granting, so declaring it clock would fail', () => {
        const row = loadCorpus({ root: ROOT }).transitions.find(
            (item) => item.id === 'TRANS:V:PB3'
        );
        if (!row) throw new Error('Missing TRANS:V:PB3');
        expect(clockGrants({ row })).toEqual(
            expect.arrayContaining([expect.stringContaining('PUBLISHED')])
        );
    });

    it('fails when T3 is declared event', () => {
        const root = tempTree();
        replaceEntry(root, 'TRANS:V:T3', { id: 'TRANS:V:T3', class: 'event' });
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('undeclared clock: TRANS:V:T3');
        expect(result.output).toContain('llega la fecha');
    });

    it('fails when the PB9 entry is removed', () => {
        const root = tempTree();
        editClasses(root, (entries) => entries.filter((item) => item.id !== 'TRANS:V:PB9'));
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `undeclared: TRANS:V:PB9 (publication) has no class in ${CLASSES_PATH}`
        );
    });

    it('fails when an entry is not a row of the three machines', () => {
        const root = tempTree();
        editClasses(root, (entries) => [...entries, { id: 'TRANS:B:S10', class: 'event' }]);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('unknown: TRANS:B:S10');
    });

    it('fails when a clock clause is not in its catalog evento', () => {
        const root = tempTree();
        editClasses(root, (entries) =>
            entries.map((item) =>
                item.id === 'TRANS:V:PB5' ? { ...item, clause: 'cuando el dueño lo pide' } : item
            )
        );
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('clause: TRANS:V:PB5');
    });

    it('fails when a clock source quote is not on the cited line', () => {
        const root = tempTree();
        editClasses(root, (entries) =>
            entries.map((item) =>
                item.id === 'TRANS:V:T3' && item.source
                    ? { ...item, source: { ...item.source, quote: '`T3` y nada más' } }
                    : item
            )
        );
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('source: TRANS:V:T3');
    });

    it('does not claim more than it checks', () => {
        const root = tempTree();
        addWrite(root, 'TRANS:V:PB2', 'courtesy_grant.ends_at');
        addWrite(root, 'TRANS:V:PB5', 'listing.inactiva_desde');
        const result = run({ root });
        expect(result.exitCode).toBe(0);
    });

    it('fails closed when the publication machine is missing', () => {
        const root = tempTree();
        const corpus = readCorpus(root);
        delete (corpus.machines as Record<string, unknown>).publication;
        saveCorpus(root, corpus);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
    });

    it('fails closed when the class declaration cannot be loaded', () => {
        const result = run({ root: tempTree(), classesPath: 'missing-classes.json' });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('cannot load');
    });

    it('fails closed and reports every problem when no row is declared clock', () => {
        const root = tempTree();
        editClasses(root, (entries) =>
            entries.map((item) => ({ id: item.id, class: 'event' as const }))
        );
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('would watch nothing');
        for (const id of ['TRANS:V:T3', 'TRANS:V:PB4', 'TRANS:V:PB5', 'TRANS:V:PB9'])
            expect(result.output).toContain(`undeclared clock: ${id}`);
    });

    it('is wired into check:guards and the guards CI job', () => {
        const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
            .scripts as Record<string, string>;
        expect(scripts['check:clock-transitions-never-grant']).toBe(
            'tsx scripts/check-clock-transitions-never-grant.ts'
        );
        expect(scripts['check:guards']).toContain('pnpm check:clock-transitions-never-grant');
        expect(scripts['check:guards'].trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        const guardsJob = ci.split('\n  guards:\n')[1]?.split(/\n {2}[a-zA-Z][\w-]*:\n/)[0];
        expect(guardsJob).toContain(
            'name: Check no clock-triggered transition grants (GUARD:G-R3-B)'
        );
        expect(guardsJob).toContain('run: pnpm check:clock-transitions-never-grant');
    });
});
