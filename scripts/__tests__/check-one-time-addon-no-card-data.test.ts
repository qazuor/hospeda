/**
 * @fileoverview
 * HOS-2179 §6.2 item 3 (AC-14): the card-data guard, by mutation. Each case builds a throwaway
 * git tree with one green file per surface, applies ONE mutation and runs the guard over it.
 * The real tree is green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CARD_DATA_SURFACES,
    CARD_DATA_TERMS,
    findNeedles,
    RULE_MESSAGE,
    run
} from '../check-one-time-addon-no-card-data.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** One green file per surface, plus the payments package. */
const GREEN: Readonly<Record<string, string>> = {
    'packages/payments/src/adapters/page.ts': "export const PATH = '/checkout/preferences';\n",
    'apps/web/src/components/Buy.tsx': 'export const Buy = () => null;\n',
    'apps/admin/src/routes/addons.tsx': 'export const Addons = () => null;\n',
    'apps/api/src/routes/billing-addon/purchase.ts': 'export const route = {};\n',
    'packages/service-core/src/services/billing/addon/purchase-addon.service.ts':
        'export const purchase = () => undefined;\n'
};

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'no-card-data-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

describe('HOS-2179 §6.2 a one-time addon never touches card data', () => {
    it('passes a green tree', () => {
        // Arrange
        const root = makeTree({ files: GREEN });

        // Act
        const result = run({ root });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it.each([
        ['an adapter calling the Orders API', 'packages/payments/src/adapters/order.ts'],
        ['a JSON list naming it', 'packages/payments/src/fake/fake-lists.json'],
        ['a comment in the battery', 'packages/payments/src/battery/notes.ts']
    ])('fails %s', (_name, file) => {
        // Arrange
        const root = makeTree({ files: { ...GREEN, [file]: '// POST /v1/orders\n' } });

        // Act
        const result = run({ root });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(RULE_MESSAGE);
        expect(result.output).toContain(`[orders-api] ${file}:1`);
    });

    it('does not read the regex spelling the battery uses to refuse an Orders write', () => {
        // Arrange: declared blind spot, see the guard header.
        const root = makeTree({
            files: {
                ...GREEN,
                'packages/payments/src/battery/watch-operations.ts':
                    'export const MONEY_ROUTE = /^\\/(?:v1\\/orders)/;\n'
            }
        });

        // Act / Assert
        expect(run({ root }).exitCode).toBe(0);
    });

    it.each(
        CARD_DATA_SURFACES.flatMap((surface) =>
            CARD_DATA_TERMS.map((term) => [surface, term] as const)
        )
    )('fails %s naming %s', (surface, term) => {
        // Arrange
        const file = `${surface}leak.ts`;
        const root = makeTree({ files: { ...GREEN, [file]: `export const x = '${term}';\n` } });

        // Act
        const result = run({ root });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(`[card-data] ${file}:1  contains '${term}'`);
    });

    it('does not read tests, nor code outside the surfaces', () => {
        // Arrange
        const root = makeTree({
            files: {
                ...GREEN,
                'apps/web/src/components/Buy.test.tsx': "const t = 'cardToken';\n",
                'packages/service-core/src/services/billing/subscription/start.ts':
                    'export const paymentToken = 1;\n'
            }
        });

        // Act / Assert
        expect(run({ root }).exitCode).toBe(0);
    });

    it('refuses to call an empty surface clean', () => {
        // Arrange
        const { 'apps/admin/src/routes/addons.tsx': _dropped, ...rest } = GREEN;
        const root = makeTree({ files: rest });

        // Act
        const result = run({ root });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('no file scanned under apps/admin/src/');
    });

    it('reports every occurrence on its line', () => {
        expect(
            findNeedles({
                file: 'f.ts',
                source: 'a\ncardToken cardToken\npaymentToken\n',
                rule: 'card-data',
                needles: CARD_DATA_TERMS
            }).map((v) => v.line)
        ).toEqual([2, 2, 3]);
    });

    it('passes the real tree', () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});
