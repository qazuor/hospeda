import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-succession-first-charge.js';

const rootRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tree(writer: string): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr1b-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    const f = path.join(root, 'apps/api/src/write.ts');
    mkdirSync(path.dirname(f), { recursive: true });
    writeFileSync(f, writer);
    return root;
}
const write = (
    comparison = 'if (read.firstChargeAt <= authorizationWindowEndsAt) throw Error();'
) =>
    `async function create(read, authorizationWindowEndsAt) { ${comparison} return db.insert({ succeedsId: admitted.row.id, firstChargeAt: read.firstChargeAt }); }`;
describe('TEST:B3:25 GUARD:G-R1-B', () => {
    it('is green over the real tree', () => expect(run().exitCode).toBe(0));
    it('accepts provider date and strict ordering', () =>
        expect(run({ root: tree(write()), minScannedFiles: 1 }).exitCode).toBe(0));
    it('mutation: equal boundary with >= charge-left is red (c)', () => {
        const r = run({
            root: tree(
                write('if (read.firstChargeAt >= authorizationWindowEndsAt) throw Error();')
            ),
            minScannedFiles: 1
        });
        expect(r.output).toContain('NO_STRICT_AFTER');
    });
    it('rejects no comparison and equality-only comparison (c)', () => {
        for (const expr of [
            '',
            'if (read.firstChargeAt === authorizationWindowEndsAt) throw Error();'
        ])
            expect(run({ root: tree(write(expr)), minScannedFiles: 1 }).output).toContain(
                'NO_STRICT_AFTER'
            );
    });
    it('mutation: same writer in confirmed SUSPENDED then branch is green', () => {
        const src = `async function create(read, authorizationWindowEndsAt) { if (admitted.basis === 'CARD_SUSPENDED_CONFIRMED_CANCELLED') { return db.insert({ succeedsId: admitted.row.id, firstChargeAt: read.firstChargeAt }); } }`;
        expect(run({ root: tree(src), minScannedFiles: 1 }).exitCode).toBe(0);
    });
    it('same writer outside confirmed branch is red', () => {
        const src = `async function create(read) { if (admitted.basis === 'CARD_SUSPENDED_CONFIRMED_CANCELLED') { log(); } return db.insert({ succeedsId: admitted.row.id, firstChargeAt: read.firstChargeAt }); }`;
        expect(run({ root: tree(src), minScannedFiles: 1 }).output).toContain('NO_STRICT_AFTER');
    });
    it('requires firstChargeAt even in exception (a)', () => {
        const src = `async function create() { if (admitted.basis === 'CARD_SUSPENDED_CONFIRMED_CANCELLED') return db.insert({ succeedsId: admitted.row.id }); }`;
        expect(run({ root: tree(src), minScannedFiles: 1 }).output).toContain('NO_FIRST_CHARGE');
    });
    it('rejects fabricated firstChargeAt (b)', () =>
        expect(
            run({
                root: tree(write().replace('read.firstChargeAt });', 'new Date() });')),
                minScannedFiles: 1
            }).output
        ).toContain('NOT_PROVIDER_DATE'));
});
describe('G-R1-B is plugged into the guards job', () => {
    it('wires package script, guards chain before fake-lies, and job step', () => {
        const pkg = JSON.parse(readFileSync(path.join(rootRepo, 'package.json'), 'utf8'));
        expect(pkg.scripts['check:succession-first-charge']).toBe(
            'tsx scripts/check-succession-first-charge.ts'
        );
        const chain = pkg.scripts['check:guards'];
        expect(chain.indexOf('pnpm check:succession-first-charge')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        const ci = readFileSync(path.join(rootRepo, '.github/workflows/ci.yml'), 'utf8');
        const block = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(block).toContain('Check successor first charge');
        expect(block).toContain('pnpm check:succession-first-charge');
    });
});
