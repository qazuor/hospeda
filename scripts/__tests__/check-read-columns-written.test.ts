import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-read-columns-written';
import { CATALOG_PATH, CORPUS_PATH, type TransitionCorpus } from '../transition-corpus';

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

describe('G-R6 (unitaria) - a read column that no transition writes', () => {
    it('reports checked vertical read columns', () => {
        const result = run({ machines: MACHINES });
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/verified [1-9][0-9]* read columns/);
    });
    it('rejects an invented column read by T3', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:T3') as {
                reads: readonly string[];
            }
        ).reads = ['trial.ends_at', 'trial.no_such_column'];
        save(root, corpus);
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('TRANS:V:T3');
        expect(result.output).toContain('trial.no_such_column');
    });
    it('requires at least one transition to write each read column', () => {
        const root = tempTree();
        const corpus = read(root);
        for (const id of ['TRANS:V:T1', 'TRANS:V:T4'])
            (
                corpus.transitions.find((row) => row.id === id) as { writes: readonly string[] }
            ).writes = corpus.transitions
                .find((row) => row.id === id)!
                .writes.filter((column) => column !== 'trial.ends_at');
        save(root, corpus);
        const result = run({ root, machines: MACHINES });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('TRANS:V:T3 reads unwritten column trial.ends_at');
        expect(result.output).toContain('TRANS:V:T4 reads unwritten column trial.ends_at');
    });
    it('does not validate inputs as column reads', () => {
        const root = tempTree();
        const corpus = read(root);
        (
            corpus.transitions.find((row) => row.id === 'TRANS:V:T3') as {
                inputs: readonly string[];
            }
        ).inputs = ['runtime:trial.no_such_column'];
        save(root, corpus);
        expect(run({ root, machines: MACHINES }).exitCode).toBe(0);
    });
});

describe('HOS-1448 corrida 2b - exhaustive billing transition annotations', () => {
    it('declares reads for all five billing machines at the audited total', () => {
        const corpus = JSON.parse(
            readFileSync(path.join(ROOT, CORPUS_PATH), 'utf8')
        ) as TransitionCorpus;
        const billingMachines = [
            'subscription',
            'payment',
            'refund',
            'manual_payment',
            'addon_instance'
        ];
        const counts = Object.fromEntries(
            billingMachines.map((machine) => [
                machine,
                corpus.transitions
                    .filter((row) => row.machine === machine)
                    .reduce((total, row) => total + row.reads.length, 0)
            ])
        );
        expect(Object.values(counts).every((count) => count > 0)).toBe(true);
        // 2026-10-12, HOS-1558: 143 reads (S5 reads subscription.succeeded_by_id, I-12).
        expect(corpus.transitions.reduce((total, row) => total + row.reads.length, 0)).toBe(143);
    });
});

describe('TEST:V4:18 - G-R6 over the declared corpus of the ten machines, broken on purpose', () => {
    it('checks all declared reads in the complete corpus', () => {
        const result = run();
        expect(result.exitCode).toBe(0);
        expect(result.output).toMatch(/verified [1-9][0-9]* read columns/);
    });
    it('rejects an invented MP5 read', () => {
        const root = tempTree();
        const corpus = read(root);
        const row = corpus.transitions.find((item) => item.id === 'TRANS:B:MP5') as {
            reads: readonly string[];
        };
        row.reads = [...row.reads, 'manual_payment.no_writer_column'];
        save(root, corpus);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('TRANS:B:MP5');
        expect(result.output).toContain('manual_payment.no_writer_column');
    });
    it('requires a declared writer for MP5 next_charge_at', () => {
        const root = tempTree();
        const corpus = read(root);
        for (const row of corpus.transitions) {
            (row.writes as string[]) = row.writes.filter(
                (column) => column !== 'subscription.next_charge_at'
            );
        }
        save(root, corpus);
        const result = run({ root });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'TRANS:B:MP5 reads unwritten column subscription.next_charge_at'
        );
    });
});
