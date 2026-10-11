import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-transition-guards-disjoint';
import {
    CATALOG_PATH,
    CORPUS_PATH,
    guardsDisjoint,
    loadCorpus,
    sharedPairs,
    type TransitionCorpus,
    type TransitionRow
} from '../transition-corpus';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MACHINES = ['trial', 'publication', 'partner_application'];
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'transition-corpus-'));
    dirs.push(root);
    for (const file of [CORPUS_PATH, CATALOG_PATH]) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(path.join(ROOT, file), 'utf8'));
    }
    return root;
}
function read(root: string): TransitionCorpus {
    return JSON.parse(readFileSync(path.join(root, CORPUS_PATH), 'utf8')) as TransitionCorpus;
}
function save(root: string, corpus: TransitionCorpus): void {
    writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
}

describe('TEST:V4:16 - G-R4 over the declared tables, broken on purpose', () => {
    it('counts only the two shared vertical pairs and names their disjoint guards', () => {
        const result = run({ machines: MACHINES });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('TRANS:V:T1/TRANS:V:T6');
        expect(result.output).toContain('TRANS:V:PB11/TRANS:V:PB13');
        expect(result.output.match(/shared pairs:/)?.[0]).toBe('shared pairs:');
        expect(result.output).not.toContain('TRANS:V:PB2/TRANS:V:PB3');
    });
    it('detects the specification mutation in memory against T1', () => {
        const corpus = loadCorpus({ root: ROOT });
        const row: TransitionRow = {
            ...corpus.transitions[0]!,
            id: 'TRANS:V:MUTATION',
            from: ['PRE_TRIAL'],
            events: ['activation_event'],
            to: 'TRIAL_ACTIVE',
            guard: {},
            reads: [],
            inputs: [],
            writes: []
        };
        const mutated = { ...corpus, transitions: [...corpus.transitions, row] };
        const pair = sharedPairs({ corpus: mutated }).find(
            (item) => item.machine === 'trial' && item.event === 'activation_event'
        );
        expect(pair).toBeDefined();
        expect(
            pair!.rows.some(
                (candidate) =>
                    candidate.id === 'TRANS:V:T1' &&
                    !guardsDisjoint({ a: candidate.guard, b: row.guard })
            )
        ).toBe(true);
    });
    it('run rejects T6 after its covered discriminator is removed', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:T6') as {
                guard: Readonly<Record<string, boolean>>;
            }
        ).guard = { converting_title: true };
        save(root, corpus);
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('TRANS:V:T1/TRANS:V:T6');
    });
    it('compares boolean and string-set guard values', () => {
        const guard = (value: boolean | string | readonly string[]) => ({ covered: value });
        const dummy = {
            id: 'a',
            machine: 'trial',
            from: ['PRE_TRIAL'],
            events: ['activation_event'],
            to: 'TRIAL_ACTIVE',
            guard: {},
            reads: [],
            inputs: [],
            writes: []
        } as TransitionRow;
        expect(guardsDisjoint({ a: guard(false), b: guard(true) })).toBe(true);
        expect(guardsDisjoint({ a: guard(true), b: guard(true) })).toBe(false);
        expect(guardsDisjoint({ a: { a: false }, b: { b: true } })).toBe(false);
        expect(guardsDisjoint({ a: guard('DRAFT'), b: guard(['DRAFT', 'PUBLISHED']) })).toBe(false);
        expect(guardsDisjoint({ a: guard(['DRAFT']), b: guard(['PUBLISHED']) })).toBe(true);
        const noRow = { ...dummy, id: 'no-row', from: ['*NO_ROW'] };
        const any = { ...dummy, id: 'any', from: ['*ANY'] };
        const concrete = { ...dummy, id: 'concrete' };
        expect(sharedPairs({ corpus: { machines: {}, transitions: [any, concrete] } }).length).toBe(
            1
        );
        expect(
            sharedPairs({ corpus: { machines: {}, transitions: [noRow, concrete] } }).length
        ).toBe(0);
    });
});
