import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadInventories } from '../live-term-inventory.js';
import { inspect, run } from '../reconciliation-mark-listing-and-inventory.js';

const repo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const emptyInventories = { marca_abierta: [], cortesia_diferida: [] } as const;
function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(repo, '.hoja/tmp/reconciliation-listing-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [file, source] of Object.entries(files)) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, source);
    }
    return root;
}
function check(files: Record<string, string>, inventories = emptyInventories) {
    return run({ root: tree(files), minScannedFiles: 1, inventories });
}

describe('TEST:B3:27 G-R1-F listing and inventories', () => {
    it(
        'is green on the real tree',
        () =>
            expect(
                run({ root: repo, inventories: loadInventories({ root: repo }).inventories })
                    .exitCode
            ).toBe(0),
        30000
    );
    it('checks a complete actionable listing and leaves no-listing trees unevaluated', () => {
        const full = inspect({
            file: 'apps/api/src/list.ts',
            source: 'export interface ActionableReconciliationMarkRow { reason: string; openedAt: Date; payments: unknown[]; totalAmount: number; defaultProposal: string }'
        });
        expect(full.findings).toHaveLength(0);
        expect(full.listingCount).toBe(1);
        const absent = check({ 'apps/api/src/empty.ts': 'export const value = 1;' });
        expect(absent.exitCode).toBe(0);
        expect(absent.listingCount).toBe(0);
    });
    it.each([
        'reason',
        'openedAt',
        'payments',
        'totalAmount',
        'defaultProposal'
    ])('reports missing listing field %s', (field) => {
        const source = `interface ActionableReconciliationMarkRow { ${[
            'reason',
            'openedAt',
            'payments',
            'totalAmount',
            'defaultProposal'
        ]
            .filter((x) => x !== field)
            .map((x) => `${x}: unknown;`)
            .join(' ')} }`;
        const result = check({ 'apps/api/src/list.ts': source });
        expect(result.output).toContain(
            `G-R1-F (c): apps/api/src/list.ts:1 ActionableReconciliationMarkRow declaration is missing ${field}`
        );
    });
    it('requires registration of listOpen and liftedAt consumers, then accepts matching entries', () => {
        const file = 'apps/api/src/marks.ts';
        for (const [source, expected] of [
            ['reconciliationMarkModel.listOpen({});', 'consumer listOpen is not registered'],
            ['const x = mark.liftedAt;', 'consumer liftedAt is not registered']
        ]) {
            const missing = check({ [file]: source });
            expect(missing.output).toContain(`G-R1-F (g): ${file}:1 marca_abierta ${expected}`);
        }
        const source = 'reconciliationMarkModel.listOpen({}); const x = mark.liftedAt;';
        const entries = {
            ...emptyInventories,
            marca_abierta: [
                {
                    file,
                    symbol: 'markConsumer',
                    row: null,
                    why: 'Current consumer without a glossary row.'
                }
            ]
        };
        expect(check({ [file]: source }, entries).exitCode).toBe(0);
    });
    it('requires courtesy registration and rejects stale and malformed entries', () => {
        const file = 'apps/api/src/courtesy.ts';
        const missing = check({ [file]: 'const x = grant.balanceClosedAt;' });
        expect(missing.output).toContain(
            'cortesia_diferida consumer balanceClosedAt is not registered'
        );
        const stale = check(
            { 'apps/api/src/empty.ts': 'export const x = 1;' },
            {
                ...emptyInventories,
                cortesia_diferida: [{ file, symbol: 'old', row: null, why: 'Former consumer.' }]
            }
        );
        expect(stale.output).toContain('stale cortesia_diferida registry entry');
        const malformed = check(
            { 'apps/api/src/empty.ts': 'export const x = 1;' },
            { ...emptyInventories, marca_abierta: [{ file: ' ', symbol: 'x', row: 0, why: '' }] }
        );
        expect(malformed.output).toContain('has blank file');
        expect(malformed.output).toContain('row must be an integer');
        const duplicate = check(
            { 'apps/api/src/empty.ts': 'export const x = 1;' },
            {
                ...emptyInventories,
                marca_abierta: [
                    { file: 'apps/api/src/old.ts', symbol: 'old', row: 1, why: 'Old.' },
                    { file: 'apps/api/src/old.ts', symbol: 'old', row: 1, why: 'Repeated.' }
                ]
            }
        );
        expect(duplicate.output).toContain('repeats (file, symbol)');
    });
    it('does not count mark model or schema definitions as consumers', () => {
        const result = check({
            'packages/db/src/models/reconciliation-mark/reconciliation-mark.model.ts':
                'reconciliationMarkModel.listOpen({}); mark.liftedAt;',
            'packages/db/src/schemas/vertical/example.dbschema.ts':
                'const balanceMonths = z.number(); const balanceClosedAt = z.date();'
        });
        expect(result.exitCode).toBe(0);
    });
});
