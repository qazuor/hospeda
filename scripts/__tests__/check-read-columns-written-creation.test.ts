/**
 * HOS-1667 restores creation-column reads removed by HOS-1448 commit 0531d5903d.
 * The catalog and corpus together declare that S1 is the sole transition writer.
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
const CREATION_WRITES = [
    'subscription.user_id',
    'subscription.vertical',
    'subscription.class',
    'subscription.payment_method',
    'subscription.authorization_window_ends_at',
    'subscription.authorization_window_deadline_version'
] as const;
const RETURNED_READS = [
    ['TRANS:B:S1', 'subscription.user_id'],
    ['TRANS:B:S1', 'subscription.vertical'],
    ['TRANS:B:S1', 'subscription.class'],
    ['TRANS:B:S1', 'subscription.payment_method'],
    ['TRANS:B:S2', 'subscription.payment_method'],
    ['TRANS:B:S3', 'subscription.authorization_window_ends_at'],
    ['TRANS:B:S3', 'subscription.authorization_window_deadline_version'],
    ['TRANS:B:S3', 'subscription.payment_method'],
    ['TRANS:B:S4', 'subscription.payment_method'],
    ['TRANS:B:S6', 'subscription.payment_method'],
    ['TRANS:B:S7', 'subscription.payment_method'],
    ['TRANS:B:S13', 'subscription.class'],
    ['TRANS:B:S16', 'subscription.payment_method'],
    ['TRANS:B:S20', 'subscription.class'],
    ['TRANS:B:S21', 'subscription.class'],
    ['TRANS:B:S29', 'subscription.payment_method'],
    ['TRANS:B:S39', 'subscription.authorization_window_ends_at'],
    ['TRANS:B:MP1', 'subscription.payment_method'],
    ['TRANS:B:MP2', 'subscription.payment_method'],
    ['TRANS:B:MP3', 'subscription.payment_method'],
    ['TRANS:B:MP5', 'subscription.payment_method']
] as const;
const EXPECTED: Record<(typeof CREATION_WRITES)[number], readonly string[]> = {
    'subscription.user_id': ['TRANS:B:S1 reads unwritten column subscription.user_id'],
    'subscription.vertical': ['TRANS:B:S1 reads unwritten column subscription.vertical'],
    'subscription.class': [
        'TRANS:B:S1 reads unwritten column subscription.class',
        'TRANS:B:S13 reads unwritten column subscription.class',
        'TRANS:B:S20 reads unwritten column subscription.class',
        'TRANS:B:S21 reads unwritten column subscription.class'
    ],
    'subscription.payment_method': [
        'TRANS:B:S1 reads unwritten column subscription.payment_method',
        'TRANS:B:S2 reads unwritten column subscription.payment_method',
        'TRANS:B:S3 reads unwritten column subscription.payment_method',
        'TRANS:B:S4 reads unwritten column subscription.payment_method',
        'TRANS:B:S6 reads unwritten column subscription.payment_method',
        'TRANS:B:S7 reads unwritten column subscription.payment_method',
        'TRANS:B:S16 reads unwritten column subscription.payment_method',
        'TRANS:B:S29 reads unwritten column subscription.payment_method',
        'TRANS:B:MP1 reads unwritten column subscription.payment_method',
        'TRANS:B:MP2 reads unwritten column subscription.payment_method',
        'TRANS:B:MP3 reads unwritten column subscription.payment_method',
        'TRANS:B:MP5 reads unwritten column subscription.payment_method'
    ],
    'subscription.authorization_window_ends_at': [
        'TRANS:B:S3 reads unwritten column subscription.authorization_window_ends_at',
        'TRANS:B:S39 reads unwritten column subscription.authorization_window_ends_at'
    ],
    'subscription.authorization_window_deadline_version': [
        'TRANS:B:S3 reads unwritten column subscription.authorization_window_deadline_version'
    ]
};
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempTree(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'read-columns-creation-'));
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

function save({
    root,
    corpus
}: {
    readonly root: string;
    readonly corpus: TransitionCorpus;
}): void {
    writeFileSync(path.join(root, CORPUS_PATH), JSON.stringify(corpus, null, 2));
}

describe('TEST:1667:1 AC:1667:1 — S1 creation writes', () => {
    it('declares S1 as the sole corpus writer for every creation column', () => {
        const corpus = read({ root: ROOT });
        for (const column of CREATION_WRITES) {
            expect(
                corpus.transitions.filter((row) => row.writes.includes(column)).map((row) => row.id)
            ).toEqual(['TRANS:B:S1']);
        }
    });

    it('cites every creation column in S1 catalog effects', () => {
        const effects =
            parseCatalog({ root: ROOT }).find((row) => row.id === 'TRANS:B:S1')?.bullets.efectos ??
            '';
        expect(CREATION_WRITES.filter((column) => effects.includes(TICK + column + TICK))).toEqual([
            ...CREATION_WRITES
        ]);
    });
});

describe('TEST:1667:2 AC:1667:2 — restored reads', () => {
    it('restores the twenty-one retired reads in their catalog order', () => {
        const corpus = read({ root: ROOT });
        expect(
            corpus.transitions.flatMap((row) =>
                row.reads
                    .filter((column) => (CREATION_WRITES as readonly string[]).includes(column))
                    .map((column) => [row.id, column])
            )
        ).toEqual(RETURNED_READS);
    });

    it('passes G-R6 across the real corpus', () => {
        expect(run()).toEqual({
            exitCode: 0,
            output: 'OK GUARD:G-R6: verified 173 read columns.'
        });
    });
});

describe('TEST:1667:3 AC:1667:4 — each S1 write is required', () => {
    it.each(CREATION_WRITES)('reports exact violations when S1 stops writing %s', (column) => {
        const root = tempTree();
        const corpus = read({ root });
        const row = corpus.transitions.find((item) => item.id === 'TRANS:B:S1');
        if (!row) throw new Error('TRANS:B:S1 is missing from the corpus');
        (row.writes as string[]) = row.writes.filter((written) => written !== column);
        save({ root, corpus });
        expect(run({ root })).toEqual({
            exitCode: 1,
            output: ['FAIL GUARD:G-R6:', ...EXPECTED[column]].join('\n')
        });
    });
});
