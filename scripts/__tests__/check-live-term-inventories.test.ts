import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectFile, run } from '../check-live-term-inventories.js';
import type { InventoryEntry, InventoryKey } from '../live-term-inventory.js';

const rootRepo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'live-guard-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [file, source] of Object.entries(files)) {
        const target = path.join(root, file);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, source);
    }
    return root;
}
const empty = {
    fila_viva: [],
    grant_vivo_ancla_viva: [],
    marca_abierta: [],
    cortesia_diferida: []
} satisfies Partial<Record<InventoryKey, readonly unknown[]>>;
const entry = (file: string, symbol = 'consumer'): InventoryEntry => ({
    file,
    symbol,
    row: null,
    why: 'No glosario row exists yet',
    subject: 'subscription'
});
const runTree = (files: Record<string, string>, inventories = empty) =>
    run({ root: tree(files), minScannedFiles: 0, inventories });
const noLive = 'db.select().from(subscriptions).where(isNotNull(subscriptions.succeedsId));';

describe('TEST:B3:26 GUARD:G-R1-E', () => {
    it('is green over the real tree', () => {
        expect(run().exitCode).toBe(0);
    });
    it('mutation 1: succeedsId without live status is red (NO_LIVENESS)', () => {
        const result = runTree({ 'apps/api/src/x.ts': noLive });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('(NO_LIVENESS)');
    });
    it('accepts a live status in the containing and()', () => {
        expect(
            runTree(
                {
                    'apps/api/src/x.ts':
                        'db.select().from(subscriptions).where(and(isNotNull(subscriptions.succeedsId), inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])));'
                },
                { ...empty, fila_viva: [entry('apps/api/src/x.ts')] }
            ).exitCode
        ).toBe(0);
    });
    it('does not borrow status evidence from another query in the file', () => {
        const result = runTree({
            'apps/api/src/x.ts': `${noLive}\ndb.select().from(subscriptions).where(inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES));`
        });
        expect(result.output).toContain('(NO_LIVENESS)');
    });
    it('accepts an unscoped succeedsId predicate when the containing where has status evidence', () => {
        expect(
            runTree({
                'apps/api/src/x.ts':
                    'db.select().from(subscriptions).where(and(eq(subscriptions.succeedsId, id), eq(subscriptions.status, "ACTIVE")));'
            }).exitCode
        ).toBe(0);
    });
    it('accepts raw SQL with status evidence in the same string', () => {
        expect(
            runTree({
                'apps/api/src/x.ts':
                    "db.execute(sql`SELECT * FROM subscription WHERE succeeds_id IS NOT NULL AND status IN ('ACTIVE')`);"
            }).exitCode
        ).toBe(0);
    });
    it('rejects raw SQL succeeds_id predicate without status evidence', () => {
        expect(
            runTree({
                'apps/api/src/x.ts':
                    'db.execute(sql`SELECT * FROM subscription WHERE succeeds_id IS NOT NULL`);'
            }).output
        ).toContain('(NO_LIVENESS)');
    });
    it('does not mark isNull(succeedsId), including findLiveCommitment shape', () => {
        expect(
            runTree(
                {
                    'apps/api/src/x.ts':
                        'db.select().from(subscriptions).where(and(isNull(subscriptions.succeedsId), inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)));'
                },
                { ...empty, fila_viva: [entry('apps/api/src/x.ts')] }
            ).exitCode
        ).toBe(0);
    });
    it('mutation 2: a new unregistered live-set consumer is red, then green when registered', () => {
        const files = {
            'apps/api/src/new-consumer.ts':
                'return inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]);'
        };
        expect(runTree(files).output).toContain('(UNLISTED_CONSUMER)');
        expect(
            runTree(files, { ...empty, fila_viva: [entry('apps/api/src/new-consumer.ts')] })
                .exitCode
        ).toBe(0);
    });
    it('reports a registered file that is no longer a consumer as stale', () => {
        const result = runTree(
            { 'apps/api/src/no-longer-live.ts': 'return subscriptions.id;' },
            { ...empty, fila_viva: [entry('apps/api/src/no-longer-live.ts')] }
        );
        expect(result.output).toContain('stale registry entry');
    });
    it('reports malformed registry entries', () => {
        const result = runTree(
            { 'apps/api/src/x.ts': 'export const x = 1;' },
            { ...empty, fila_viva: [{ file: '', symbol: '', row: 0, why: '', subject: 'wrong' }] }
        );
        expect(result.output).toContain('blank file');
        expect(result.output).toContain('blank symbol');
        expect(result.output).toContain('blank why');
        expect(result.output).toContain('row must be an integer');
        expect(result.output).toContain('invalid subject');
    });
    it('rejects subscription sets and subscription-only literals on addonInstances (c1)', () => {
        expect(
            runTree({
                'apps/api/src/x.ts':
                    'inArray(addonInstances.status, [...LIVE_SUBSCRIPTION_STATUSES]);'
            }).output
        ).toContain('(WRONG_SUBJECT)');
        expect(
            runTree({
                'apps/api/src/x.ts': "inArray(addonInstances.status, ['ACTIVE', 'SUSPENDED']);"
            }).output
        ).toContain('(WRONG_SUBJECT)');
    });
    it('mutation 5: rejects the exact addon live pair on subscriptions (c2)', () => {
        expect(
            runTree({
                'apps/api/src/x.ts':
                    "inArray(subscriptions.status, ['PENDING_AUTHORIZATION', 'ACTIVE']);"
            }).output
        ).toContain('(WRONG_SUBJECT)');
    });
    it('keeps the S21 shape green without asking for the addon pair', () => {
        const result = runTree(
            {
                'apps/api/src/x.ts':
                    "inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES); eq(addonInstances.status, 'CANCELLED');"
            },
            { ...empty, fila_viva: [entry('apps/api/src/x.ts')] }
        );
        expect(result.exitCode).toBe(0);
        expect(result.output).not.toContain('addon_instance');
    });
    it('ignores the live-set name in import/export only, tests, and its defining schema', () => {
        expect(
            inspectFile({
                file: 'apps/api/src/import.ts',
                source: "import { LIVE_SUBSCRIPTION_STATUSES } from './x'; export { LIVE_SUBSCRIPTION_STATUSES };"
            }).consumers
        ).toEqual([]);
        expect(
            runTree(
                {
                    'apps/api/src/x.test.ts':
                        'inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES);',
                    'packages/db/src/schemas/vertical/subscription.dbschema.ts':
                        'export const LIVE_SUBSCRIPTION_STATUSES = [];'
                },
                { ...empty }
            ).exitCode
        ).toBe(0);
    });
});

describe('G-R1-E is plugged into the guards job', () => {
    it('wires package script, guards chain before fake-lies, and its job step', async () => {
        const fs = await import('node:fs');
        const pkg = JSON.parse(fs.readFileSync(path.join(rootRepo, 'package.json'), 'utf8'));
        expect(pkg.scripts['check:live-term-inventories']).toBe(
            'tsx scripts/check-live-term-inventories.ts'
        );
        const chain = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:live-term-inventories');
        expect(chain.indexOf('pnpm check:live-term-inventories')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        const ci = fs.readFileSync(path.join(rootRepo, '.github/workflows/ci.yml'), 'utf8');
        const block = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(block).toContain('Check live succession terms and subject sets (GUARD:G-R1-E)');
        expect(block).toContain('run: pnpm check:live-term-inventories');
    });
});
