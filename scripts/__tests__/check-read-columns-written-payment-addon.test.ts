/**
 * HOS-1715 restores the eight payment and addon reads removed by HOS-1448.
 * P0 (the charge-fact record) writes the payment columns at creation; A1 writes
 * `complement_subscription_id` and A2 writes `ends_at`. G-R6's definition is unchanged.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-read-columns-written';
import {
    CATALOG_PATH,
    CORPUS_PATH,
    parseCatalog,
    type TransitionCorpus
} from '../transition-corpus';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TICK = String.fromCharCode(96);

/** Each retired column, the exact set of transitions that write it, and who reads it. */
const CASES = [
    {
        column: 'payment.amount',
        writers: ['TRANS:B:P0', 'TRANS:B:A2'],
        readers: ['TRANS:B:P1', 'TRANS:B:P3', 'TRANS:B:P4', 'TRANS:B:P5']
    },
    { column: 'payment.subscription_id', writers: ['TRANS:B:P0'], readers: ['TRANS:B:P1'] },
    { column: 'payment.addon_instance_id', writers: ['TRANS:B:A2'], readers: ['TRANS:B:P1'] },
    { column: 'addon_instance.ends_at', writers: ['TRANS:B:A2'], readers: ['TRANS:B:A4'] },
    {
        column: 'addon_instance.complement_subscription_id',
        writers: ['TRANS:B:A1'],
        readers: ['TRANS:B:A5']
    }
] as const;
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'read-columns-payment-addon-'));
    dirs.push(root);
    for (const file of [CORPUS_PATH, CATALOG_PATH]) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(path.join(ROOT, file), 'utf8'));
    }
    return root;
}

function read({ root }: { readonly root: string }): TransitionCorpus {
    return JSON.parse(readFileSync(path.join(root, CORPUS_PATH), 'utf8')) as TransitionCorpus;
}

describe('TEST:1715:1 AC:1715:1 — expected writer set per retired column', () => {
    it.each(CASES)('declares exactly $writers as the corpus writers of $column', (item) => {
        const corpus = read({ root: ROOT });
        expect(
            corpus.transitions
                .filter((row) => row.writes.includes(item.column))
                .map((row) => row.id)
        ).toEqual([...item.writers]);
    });

    it.each(CASES)('keeps the $column reads in $readers', (item) => {
        const corpus = read({ root: ROOT });
        expect(
            corpus.transitions.filter((row) => row.reads.includes(item.column)).map((row) => row.id)
        ).toEqual([...item.readers]);
    });
});

describe('TEST:1715:2 AC:1715:2 — P0 is the charge-fact record', () => {
    it('declares P0 as the entry transition of the payment machine', () => {
        const corpus = read({ root: ROOT });
        const p0 = corpus.transitions.find((row) => row.id === 'TRANS:B:P0');
        expect(p0?.machine).toBe('payment');
        expect(p0?.from).toEqual(['*NO_ROW']);
        expect(p0?.to).toEqual(['PENDING']);
    });

    it('states in the catalog that P0 is recordChargeFact and cites its two columns and disclaims addon_instance_id', () => {
        const nota =
            parseCatalog({ root: ROOT }).find((row) => row.id === 'TRANS:B:P0')?.bullets.nota ?? '';
        expect(nota).toContain('`P0` ES el registro del hecho de cobro');
        expect(nota).toContain('no es un paso nuevo ni un segundo escritor');
        for (const column of ['payment.amount', 'payment.subscription_id'])
            expect(nota).toContain(TICK + column + TICK);
        expect(nota).toContain(`P0${TICK} no escribe ${TICK}payment.addon_instance_id`);
    });

    it('cites the addon writers in the A1 and A2 catalog bullets', () => {
        const rows = parseCatalog({ root: ROOT });
        expect(rows.find((row) => row.id === 'TRANS:B:A1')?.bullets.nota).toContain(
            `${TICK}addon_instance.complement_subscription_id${TICK}`
        );
        const a2 = rows.find((row) => row.id === 'TRANS:B:A2')?.bullets.nota;
        for (const column of [
            'addon_instance.ends_at',
            'payment.addon_instance_id',
            'payment.amount'
        ])
            expect(a2).toContain(`${TICK}${column}${TICK}`);
    });
});

describe('TEST:1715:3 AC:1715:3 — each writer is required', () => {
    it('passes G-R6 across the real corpus', () => {
        expect(run()).toEqual({
            exitCode: 0,
            // 2026-11-18, HOS-2344: 183 (S40 reads subscription.succeeds_id).
            // 2026-11-19, HOS-2351: still 183 (S40 stops writing succeeded_by_id; reads unchanged).
            output: 'OK GUARD:G-R6: verified 183 read columns.'
        });
    });

    it.each(CASES)('reports exact violations when $writers stop writing $column', (item) => {
        const root = tempTree();
        const corpus = read({ root });
        for (const writer of item.writers) {
            const row = corpus.transitions.find((candidate) => candidate.id === writer);
            if (!row) throw new Error(`${writer} is missing from the corpus`);
            (row.writes as string[]) = row.writes.filter((written) => written !== item.column);
        }
        writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
        expect(run({ root })).toEqual({
            exitCode: 1,
            output: [
                'FAIL GUARD:G-R6:',
                ...item.readers.map((reader) => `${reader} reads unwritten column ${item.column}`)
            ].join('\n')
        });
    });
});

describe('TEST:1715:4 AC:1715:4 — payment.amount keeps a writer while either remains', () => {
    it.each(['TRANS:B:P0', 'TRANS:B:A2'])('stays green when only %s stops writing it', (writer) => {
        const root = tempTree();
        const corpus = read({ root });
        const row = corpus.transitions.find((candidate) => candidate.id === writer);
        if (!row) throw new Error(`${writer} is missing from the corpus`);
        (row.writes as string[]) = row.writes.filter((written) => written !== 'payment.amount');
        writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
        expect(run({ root }).exitCode).toBe(0);
    });
});
