import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOSER_FILE, OPENERS, run, WRITES_FILE } from '../check-succession-close.js';

const repo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
const real = (file: string): string => readFileSync(path.join(repo, file), 'utf8');
const anchors = [CLOSER_FILE, WRITES_FILE, OPENERS[0].file];
function write(root: string, file: string, source: string): void {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, source);
}
function tree(overrides: Record<string, string> = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr1c-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const file of anchors) write(root, file, overrides[file] ?? real(file));
    for (const [file, source] of Object.entries(overrides))
        if (!anchors.includes(file)) write(root, file, source);
    return root;
}
function mutate(file: string, before: string, after: string): string {
    const source = real(file);
    expect(source).toContain(before);
    return source.replace(before, after);
}
function red(file: string, source: string, rule: string): void {
    const result = run({ root: tree({ [file]: source }), minScannedFiles: 1 });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(`G-R1-C: ${rule}: ${file}:`);
    expect(run({ root: tree(), minScannedFiles: 1 })).toMatchObject({ exitCode: 0 });
}
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('TEST:B8b:21 AC:B8b:21 GUARD:G-R1-C', () => {
    it('passes the real production tree', () => {
        expect(run()).toMatchObject({ exitCode: 0 });
    });
    it('passes the minimal registered tree', () => {
        expect(run({ root: tree(), minScannedFiles: 1 })).toMatchObject({ exitCode: 0 });
    });
    it('(c1) rejects an unregistered predecessor writer', () => {
        const file = 'apps/api/src/succession-bypass.ts';
        red(
            file,
            'export function bypass(tx: Tx) { return tx.update(subscriptions).set({ succeededById: "new" }); }',
            'c1 pointer writer'
        );
    });
    it('(c1) rejects an unregistered shorthand predecessor writer', () => {
        const file = 'apps/api/src/succession-bypass.ts';
        red(
            file,
            'export function bypass(tx: Tx, succeededById: string) { return tx.update(subscriptions).set({ succeededById }); }',
            'c1 pointer writer'
        );
    });
    it('(c1) rejects succeedsId null outside clearSuccessorLink', () => {
        const file = 'packages/service-core/src/services/billing/subscription/other.ts';
        red(
            file,
            'export function other(tx: Tx) { return tx.update(subscriptions).set({ succeedsId: null }); }',
            'c1 pointer writer'
        );
    });
    it('(c1) rejects succeedsId null in a local const patch outside clearSuccessorLink', () => {
        const file = 'packages/service-core/src/services/billing/subscription/other.ts';
        red(
            file,
            'export function other(tx: Tx) { const patch = { succeedsId: null }; return tx.update(subscriptions).set(patch); }',
            'c1 pointer writer'
        );
    });
    it('(c1) accepts succeedsId null in clearSuccessorLink', () => {
        expect(run({ root: tree(), minScannedFiles: 1 })).toMatchObject({ exitCode: 0 });
    });
    it('(c2) rejects a second caller of a close writer', () => {
        const file = 'apps/api/src/other-close.ts';
        red(file, 'export function other() { return clearSuccessorLink({}); }', 'c2 paired close');
    });
    for (const name of ['linkClosedPredecessor', 'clearSuccessorLink'])
        it(`(c2) rejects removing ${name} from S18`, () => {
            const source = real(CLOSER_FILE);
            const start = source.indexOf(`await ${name}({`);
            expect(start).toBeGreaterThan(0);
            red(
                CLOSER_FILE,
                source.slice(0, start) +
                    source.slice(start).replace(`await ${name}({`, `await removed${name}({`),
                'c2 paired close'
            );
        });
    for (const name of ['repointComplements', 'deferOrCloseCourtesy', 'flagRetainedPayments'])
        it(`(c3) rejects removing ${name} from S18`, () => {
            red(
                CLOSER_FILE,
                mutate(CLOSER_FILE, `await ${name}({`, `await removed${name}({`),
                'c3 close inventory'
            );
        });
    it('(c4) rejects missing complement repoint', () => {
        red(
            WRITES_FILE,
            mutate(
                WRITES_FILE,
                '.set({ targetId: successorId })',
                '.set({ otherId: successorId })'
            ),
            'c4 complements'
        );
    });
    it('(c4) rejects missing vertical scope', () => {
        red(
            WRITES_FILE,
            mutate(WRITES_FILE, "'VERTICAL_SUBSCRIPTION'", "'USER'"),
            'c4 complements'
        );
    });
    it('(c4) rejects missing monthly balanceMonths, the literal TEST mutation', () => {
        red(
            WRITES_FILE,
            mutate(WRITES_FILE, '.set({ balanceMonths: months })', '.set({ other: months })'),
            'c4 courtesy balance'
        );
    });
    it('(c4) accepts the monthly balanceMonths in a local const patch', () => {
        const source = mutate(
            WRITES_FILE,
            '.set({ balanceMonths: months })',
            '.set(patch)'
        ).replace(
            "if (option.cycle === 'monthly') {",
            "if (option.cycle === 'monthly') {\n            const patch = { balanceMonths: months };"
        );
        expect(run({ root: tree({ [WRITES_FILE]: source }), minScannedFiles: 1 })).toMatchObject({
            exitCode: 0
        });
    });
    it('(c4) rejects missing nonmonthly balanceMonths, the separate TEST mutation', () => {
        red(
            WRITES_FILE,
            mutate(
                WRITES_FILE,
                'balanceMonths: months,\n                    balanceClosedAt',
                'other: months,\n                    balanceClosedAt'
            ),
            'c4 courtesy balance'
        );
    });
    it('(c4) rejects missing nonmonthly balanceClosedAt', () => {
        red(
            WRITES_FILE,
            mutate(WRITES_FILE, 'balanceClosedAt: value.now,', 'otherDate: value.now,'),
            'c4 courtesy balance'
        );
    });
    it('(c4) rejects balanceClosedAt moved to the monthly set', () => {
        const source = mutate(
            WRITES_FILE,
            '.set({ balanceMonths: months })',
            '.set({ balanceMonths: months, balanceClosedAt: value.now })'
        );
        expect(source).toContain('balanceClosedAt: value.now,');
        red(
            WRITES_FILE,
            source.replace('balanceClosedAt: value.now,', 'otherDate: value.now,'),
            'c4 courtesy balance'
        );
    });
    it('(c4) rejects a removed reconciliation mark call, the literal TEST mutation', () => {
        red(
            WRITES_FILE,
            mutate(
                WRITES_FILE,
                'await openReconciliationMark(',
                'await removedOpenReconciliationMark('
            ),
            'c4 retained payment mark'
        );
    });
    it('(c4) rejects another reconciliation reason', () => {
        red(
            WRITES_FILE,
            mutate(WRITES_FILE, "reason: 'REEMBOLSO_POR_CONFIRMAR'", "reason: 'COBRO_DUPLICADO'"),
            'c4 retained payment mark'
        );
    });
    it('(c4) rejects a mark without payment', () => {
        red(
            WRITES_FILE,
            mutate(WRITES_FILE, "payment: { source: 'PAYMENT', id: retention.paymentId },", ''),
            'c4 retained payment mark'
        );
    });
    it('(c5) rejects repointing promo redemption', () => {
        const file = 'packages/service-core/src/services/billing/subscription/promo-move.ts';
        red(
            file,
            'export function move(tx: Tx) { return tx.update(promoRedemptions).set({ subscriptionId: "new" }); }',
            'c5 promo immobility'
        );
    });
    it('(c5) rejects repointing promo redemption from a file-level const patch', () => {
        const file = 'packages/service-core/src/services/billing/subscription/promo-move.ts';
        red(
            file,
            'const patch = { subscriptionId: "new" }; export function move(tx: Tx) { return tx.update(promoRedemptions).set(patch); }',
            'c5 promo immobility'
        );
    });
    it('rejects a tree below the production file floor', () => {
        const result = run({ root: tree() });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('G-R1-C: scanned 3 files; expected at least 1000');
    });
    it('wires the script after retention, before role, and into the Guards job', () => {
        const pkg = JSON.parse(real('package.json'));
        expect(pkg.scripts['check:succession-close']).toBe('tsx scripts/check-succession-close.ts');
        const chain: string = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:succession-retention && pnpm check:succession-close');
        expect(chain.indexOf('pnpm check:succession-close')).toBeLessThan(
            chain.indexOf('pnpm check:role-never-decides')
        );
        expect(chain.trim().endsWith('pnpm check:fake-lies')).toBe(true);
        const ci = real('.github/workflows/ci.yml');
        const guards = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(guards).toContain('Check succession close completeness (GUARD:G-R1-C)');
        expect(guards).toContain('run: pnpm check:succession-close');
    });
});
