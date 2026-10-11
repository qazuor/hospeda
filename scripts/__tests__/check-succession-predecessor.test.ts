import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ADMITTED_STATUSES,
    GATE_FILE,
    REFUSED_STATUSES,
    run
} from '../check-succession-predecessor.js';

const rootRepo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const gate = (extra = '') =>
    `export async function admitSuccessionPredecessor(row: Row) { assertFreshForAct({ read: await readById(row.id) }); if (row.status === 'ACTIVE' && row.paymentMethod === 'CARD') return { row, authorization: 'authorized' }; if (row.status === 'SUSPENDED' && row.paymentMethod === 'CARD') return { row, authorization: 'cancelled' }; if (row.status === 'CANCEL_SCHEDULED') return { row }; if (row.succeedsId) throw new Error('chain'); ${extra} }`;
const writer = `async function create(read: Subscription) { const admitted = await admitSuccessionPredecessor(read); return db.insert({ succeedsId: admitted.row.id }); }`;
function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr1a-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    for (const [f, s] of Object.entries(files)) {
        const p = path.join(root, f);
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, s);
    }
    return root;
}
const base = (w = writer, g = gate()) => ({ 'apps/api/src/write.ts': w, [GATE_FILE]: g });
describe('TEST:B3:24 GUARD:G-R1-A', () => {
    it('is green over the real tree (zero writers)', () => {
        expect(run().exitCode).toBe(0);
    });
    it('is green with the canonical gate and derived writer', () => {
        expect(run({ root: tree(base()), minScannedFiles: 1 }).exitCode).toBe(0);
    });
    it('mutation: GRACE_PERIOD path without gate is red (a)', () => {
        const r = run({
            root: tree(
                base(
                    "async function create(read) { if (read.status === 'GRACE_PERIOD') return db.insert({ succeedsId: read.id }); }"
                )
            ),
            minScannedFiles: 1
        });
        expect(r.output).toContain('UNGATED_WRITER');
        expect(r.output).toContain('apps/api/src/write.ts');
    });
    it('mutation: ACTIVE card gate without authorized reread is red (d2)', () => {
        const r = run({
            root: tree(base(writer, gate().replace("'authorized'", "'paused'"))),
            minScannedFiles: 1
        });
        expect(r.output).toContain('GATE_BODY');
        expect(r.output).toContain('d2');
    });
    it.each([
        ['GRACE_PERIOD added', gate("if (row.status === 'GRACE_PERIOD') return {};"), 'd1'],
        ['PAUSED in rejection message', gate("throw new Error('PAUSED');"), 'd1'],
        [
            'SUSPENDED removed',
            gate().replace("row.status === 'SUSPENDED'", "row.status === 'OTHER'"),
            'd1'
        ],
        ['cancelled missing', gate().replace("'cancelled'", "'paused'"), 'd3'],
        ['predecessor chain read missing', gate().replace('row.succeedsId', 'row.id'), 'd4'],
        [
            'freshness check missing',
            gate().replace('assertFreshForAct({ read: await readById(row.id) });', ''),
            'd5'
        ]
    ])('detects gate body clause: %s', (_label, g, code) => {
        const r = run({ root: tree(base(writer, g)), minScannedFiles: 1 });
        expect(r.output).toContain(code);
    });
    it('reports missing gate with writer', () => {
        const r = run({ root: tree({ 'apps/api/src/write.ts': writer }), minScannedFiles: 1 });
        expect(r.output).toContain('GATE_MISSING');
    });
    it('reports raw SQL writes (b)', () => {
        const r = run({
            root: tree(
                base(
                    "async function x() { db.execute('INSERT INTO subscription (id, succeeds_id) VALUES (1, 2)'); }"
                )
            ),
            minScannedFiles: 1
        });
        expect(r.output).toContain('RAW_SQL_WRITE');
    });
    it('ignores null and test/schema writers; checks status parity', async () => {
        expect(
            run({
                root: tree({
                    'apps/api/src/x.ts': 'const a={succeedsId:null};',
                    'apps/api/src/x.test.ts': 'const a={succeedsId:x};',
                    'packages/db/src/schemas/x.ts': 'const a={succeedsId:x};',
                    [GATE_FILE]: gate()
                }),
                minScannedFiles: 1
            }).exitCode
        ).toBe(0);
        const schema = await import('node:fs').then((m) =>
            m.readFileSync(
                path.join(rootRepo, 'packages/db/src/schemas/vertical/subscription.dbschema.ts'),
                'utf8'
            )
        );
        const schemaStatuses = schema.match(
            /export const SUBSCRIPTION_STATUSES = \[([\s\S]*?)\] as const/
        )?.[1];
        expect(schemaStatuses).toBeDefined();
        const actual = [...(schemaStatuses ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
        expect([...ADMITTED_STATUSES, ...REFUSED_STATUSES].sort()).toEqual(actual);
    });
});
describe('G-R1-A is plugged into the guards job', () => {
    it('wires package script, guards chain before fake-lies, and job step', async () => {
        const fs = await import('node:fs');
        const pkg = JSON.parse(fs.readFileSync(path.join(rootRepo, 'package.json'), 'utf8'));
        expect(pkg.scripts['check:succession-predecessor']).toBe(
            'tsx scripts/check-succession-predecessor.ts'
        );
        const chain = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:succession-predecessor');
        expect(chain.indexOf('pnpm check:succession-predecessor')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        const ci = fs.readFileSync(path.join(rootRepo, '.github/workflows/ci.yml'), 'utf8');
        const block = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(block).toContain('Check succession predecessor');
        expect(block).toContain('pnpm check:succession-predecessor');
    });
});
