import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { forbiddenStateWords, run } from '../check-verticals-machines-vocabulary';
import { CATALOG_PATH, CORPUS_PATH, loadCorpus, type TransitionCorpus } from '../transition-corpus';

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
function patchCatalog(root: string, replace: (text: string) => string): void {
    const file = path.join(root, CATALOG_PATH);
    writeFileSync(file, replace(readFileSync(file, 'utf8')));
}

describe('TEST:V4:17 - G-R4-B over the verticals machines, broken on purpose', () => {
    it('accepts the complete declared corpus', () => expect(run().exitCode).toBe(0));
    it('uses billing states from the real machine declarations in isolation', () => {
        const corpus = loadCorpus({ root: ROOT });
        const forbidden = new Set([
            ...corpus.machines.subscription.states,
            ...corpus.machines.addon_instance.states
        ]);
        expect(forbiddenStateWords({ value: 'on_EXPIRED', forbidden })).toContain('EXPIRED');
        expect(forbiddenStateWords({ value: 'addon_instance_expired', forbidden })).toEqual([]);
    });
    it('rejects a subscription state in T6 guard values', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:T6') as {
                guard: Readonly<Record<string, string>>;
            }
        ).guard = { subscription_status: 'ACTIVE' };
        save(root, corpus);
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('structured');
        expect(result.output).toContain('TRANS:V:T6');
        expect(result.output).toContain('ACTIVE');
    });
    it('rejects a read of the subscription state column', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:PB2') as {
                reads: readonly string[];
            }
        ).reads = ['subscription.status'];
        save(root, corpus);
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('subscription.status');
    });
    it('rejects an invalid state marker without weakening event validation', () => {
        const root = tempTree();
        const corpus = read(root);
        const row = corpus.transitions.find((item) => item.id === 'TRANS:V:PB2') as {
            events: readonly string[];
        };
        row.events = ['addon_instance_expired'];
        save(root, corpus);
        expect(run({ root, machines: MACHINES }).exitCode).toBe(0);
        expect(
            forbiddenStateWords({
                value: 'on_EXPIRED',
                forbidden: new Set(['EXPIRED'])
            })
        ).toEqual(['EXPIRED']);
    });
    it('does not mistake TRIAL_ACTIVE for the forbidden ACTIVE state', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:T1') as {
                guard: Readonly<Record<string, string>>;
            }
        ).guard = { state: 'TRIAL_ACTIVE' };
        save(root, corpus);
        expect(run({ root, machines: MACHINES }).exitCode).toBe(0);
    });
    it('rejects forbidden state names in catalog prose', () => {
        const root = tempTree();
        patchCatalog(root, (source) =>
            source.replace(
                'la vertical declara evento **y** su plan de trial',
                'la vertical declara evento `GRACE_PERIOD` **y** su plan de trial'
            )
        );
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('catalog prose');
    });
});
