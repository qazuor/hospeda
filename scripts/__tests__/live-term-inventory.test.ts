import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    INVENTORY_FILE,
    INVENTORY_KEYS,
    loadInventories,
    validateEntries
} from '../live-term-inventory.js';

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tree(json?: string): string {
    const root = mkdtempSync(path.join(tmpdir(), 'live-inventory-'));
    dirs.push(root);
    if (json !== undefined) {
        const file = path.join(root, INVENTORY_FILE);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, json);
    }
    return root;
}
const valid = {
    file: 'apps/api/src/x.ts',
    symbol: 'consumer',
    row: null,
    why: 'No glosario row',
    subject: 'subscription'
};

describe('live-term-inventory', () => {
    it('reports absent registry', () => {
        expect(loadInventories({ root: tree() }).findings[0]?.detail).toContain(
            'cannot read or parse'
        );
    });
    it('reports malformed JSON', () => {
        expect(loadInventories({ root: tree('{') }).findings[0]?.detail).toContain(
            'cannot read or parse'
        );
    });
    it('reports non-object top-level JSON', () => {
        expect(loadInventories({ root: tree('[]') }).findings[0]?.detail).toBe(
            'top-level JSON value must be an object'
        );
    });
    it('reports an unknown top-level key', () => {
        const result = loadInventories({
            root: tree(
                JSON.stringify({
                    ...Object.fromEntries(INVENTORY_KEYS.map((key) => [key, []])),
                    extra: []
                })
            )
        });
        expect(result.findings).toContainEqual({ key: 'extra', detail: 'unknown top-level key' });
    });
    it('reports a missing top-level key', () => {
        const result = loadInventories({ root: tree(JSON.stringify({ fila_viva: [] })) });
        expect(result.findings).toContainEqual({
            key: 'grant_vivo_ancla_viva',
            detail: 'missing top-level key'
        });
    });
    it('reports a non-array inventory value', () => {
        expect(validateEntries({ key: 'fila_viva', entries: {} })).toContainEqual({
            key: 'fila_viva',
            detail: 'entries must be an array'
        });
    });
    it('reports an entry that is not an object', () => {
        expect(validateEntries({ key: 'fila_viva', entries: [null] })[0]?.detail).toBe(
            'entry 1 is not an object'
        );
    });
    it.each(['file', 'symbol', 'why'] as const)('reports blank %s', (field) => {
        expect(
            validateEntries({ key: 'fila_viva', entries: [{ ...valid, [field]: '  ' }] })[0]?.detail
        ).toContain(`blank ${field}`);
    });
    it.each([0, -1, 1.5, '1', undefined] as const)('reports invalid row %s', (row) => {
        expect(
            validateEntries({ key: 'fila_viva', entries: [{ ...valid, row }] })[0]?.detail
        ).toContain('row must be an integer');
    });
    it('accepts null row', () => {
        expect(validateEntries({ key: 'fila_viva', entries: [valid] })).toEqual([]);
    });
    it('reports repeated (file, symbol)', () => {
        expect(validateEntries({ key: 'fila_viva', entries: [valid, valid] })[0]?.detail).toContain(
            'repeats (file, symbol)'
        );
    });
    it.each([
        undefined,
        'bad',
        'subscription+addon_instance'
    ] as const)('reports absent or invalid fila_viva subject', (subject) => {
        expect(
            validateEntries({ key: 'fila_viva', entries: [{ ...valid, subject }] })[0]?.detail
        ).toContain('missing or invalid subject');
    });
    it('accepts the four exact registry keys', () => {
        const result = loadInventories({
            root: tree(JSON.stringify(Object.fromEntries(INVENTORY_KEYS.map((key) => [key, []]))))
        });
        expect(result.findings).toEqual([]);
    });
});
