import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    LATE_PAYMENT_FILE,
    REACTIVATORS,
    REFUND_WRITERS,
    run
} from '../check-succession-retention.js';

const rootRepo = path.resolve(import.meta.dirname, '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** The real files the guard anchors on, copied verbatim into each temporary tree. */
const ANCHORED = [
    LATE_PAYMENT_FILE,
    ...REACTIVATORS.map((r) => r.file),
    ...REFUND_WRITERS.map((w) => w.file)
];
const real = (file: string): string => readFileSync(path.join(rootRepo, file), 'utf8');

function tree(overrides: Record<string, string> = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'gr1d-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    const files = { ...Object.fromEntries(ANCHORED.map((f) => [f, real(f)])), ...overrides };
    for (const [f, s] of Object.entries(files)) write(root, f, s);
    return root;
}
function write(root: string, file: string, source: string): void {
    const p = path.join(root, file);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, source);
}
const check = (root: string) => run({ root, minScannedFiles: 1 });
/** Applies a mutation, expects red naming the path, restores it, expects green. */
function redThenGreen(input: {
    readonly file: string;
    readonly mutated: string;
    readonly expected: readonly string[];
}): void {
    const original = ANCHORED.includes(input.file) ? real(input.file) : null;
    expect(input.mutated).not.toBe(original);
    const root = tree({ [input.file]: input.mutated });
    const red = check(root);
    expect(red.exitCode).toBe(1);
    for (const piece of input.expected) expect(red.output).toContain(piece);
    if (original === null) rmSync(path.join(root, input.file));
    else write(root, input.file, original);
    expect(check(root)).toMatchObject({ exitCode: 0 });
}

const EXIT_GRACE = REACTIVATORS[0].file;
const REQUEST_REFUND = REFUND_WRITERS[0].file;

describe('TEST:B7:11 GUARD:G-R1-D', () => {
    it('is green over the real tree', () => {
        const result = run();
        expect(result.output).toContain('G-R1-D: OK');
        expect(result.exitCode).toBe(0);
    });

    it('is green over a tree holding only the anchored files', () => {
        expect(check(tree())).toMatchObject({ exitCode: 0 });
    });

    it('is red when fewer files than the floor are scanned', () => {
        expect(run({ root: tree(), minScannedFiles: 1000 }).output).toContain('G-R1-D: scanned');
    });

    it('(g1) the S5 condition that the row is not a succession predecessor removed: red, then green', () => {
        const source = real(LATE_PAYMENT_FILE);
        const line = '    if (facts.isPredecessorInSuccession) return { retainedForS19: true };\n';
        expect(source).toContain(line);
        redThenGreen({
            file: LATE_PAYMENT_FILE,
            mutated: source.replace(line, ''),
            expected: [
                'G-R1-D: g1 retention first',
                `${LATE_PAYMENT_FILE}:`,
                'evaluateLatePaymentConditions'
            ]
        });
    });

    it('(g2) isPredecessorInSuccession fed with false: red, then green', () => {
        const source = real(LATE_PAYMENT_FILE);
        const call = /await isLiveSuccessionPredecessor\(\{[\s\S]*?\}\)/;
        expect(source).toMatch(call);
        redThenGreen({
            file: LATE_PAYMENT_FILE,
            mutated: source.replace(call, 'false'),
            expected: ['G-R1-D: g2 predecessor read', 'checkLatePaymentConditions']
        });
    });

    it("(g3) the 'retainedForS19' in … branch removed from S5: red, then green", () => {
        const source = real(EXIT_GRACE);
        const branch = /\n {4}if \('retainedForS19' in verdict\) \{[\s\S]*?\n {4}\}\n/;
        expect(source).toMatch(branch);
        redThenGreen({
            file: EXIT_GRACE,
            mutated: source.replace(branch, '\n'),
            expected: [
                'G-R1-D: g3 reactivator exits on retention',
                `${EXIT_GRACE}:`,
                'exitGraceOnCreditedPayment → reactivateFromGrace'
            ]
        });
    });

    it("(g4) a new function writing status 'ACTIVE' over GRACE_PERIOD: red, then green", () => {
        const file = 'packages/service-core/src/services/billing/subscription/revive.ts';
        redThenGreen({
            file,
            mutated: `export async function reviveFromGrace(db: Db, id: string) {
    await db
        .update(subscriptions)
        .set({ status: 'ACTIVE', updatedAt: new Date() })
        .where(and(eq(subscriptions.id, id), eq(subscriptions.status, 'GRACE_PERIOD')));
}
`,
            expected: [
                'G-R1-D: g4 unregistered reactivation',
                `${file}:4`,
                'reviveFromGrace writes ACTIVE/CANCEL_SCHEDULED over GRACE_PERIOD/SUSPENDED'
            ]
        });
    });

    it('(g4) a second caller of the S5 writer bypassing S19: red, then green', () => {
        const file = 'apps/api/src/routes/revive.ts';
        redThenGreen({
            file,
            mutated: `export async function revive(id: string) {
    return reactivateFromGrace({ subscriptionId: id, now: new Date() });
}
`,
            expected: [
                'G-R1-D: g4 unregistered reactivation',
                `${file}:2`,
                'calls reactivateFromGrace outside exitGraceOnCreditedPayment'
            ]
        });
    });

    it('(g5) a refund of the retained payment inserted before the succession closes: red, then green', () => {
        const file = 'packages/service-core/src/services/billing/refund/refund-retained.ts';
        redThenGreen({
            file,
            mutated: `export async function refundRetainedPayment(tx: Tx, paymentId: string) {
    await tx.insert(refunds).values({ paymentId, amount: 1, status: 'REQUESTED' });
}
`,
            expected: [
                'G-R1-D: g5 unregistered refund writer',
                `${file}:2`,
                'refundRetainedPayment inserts into refunds outside the S19 gate registry'
            ]
        });
    });

    it('(g5) the gate removed from RF1: red, then green', () => {
        const source = real(REQUEST_REFUND);
        const gate = '        await assertRetainedPaymentRefundable({ tx, locked });\n';
        expect(source).toContain(gate);
        redThenGreen({
            file: REQUEST_REFUND,
            mutated: source.replace(gate, ''),
            expected: [
                'G-R1-D: g5 refund behind the S19 gate',
                `${REQUEST_REFUND}:`,
                'requestRefund → requestRefund: inserts into refunds without assertRetainedPaymentRefundable first'
            ]
        });
    });
});

describe('G-R1-D is plugged into the guards job', () => {
    it('wires package script, guards chain before fake-lies, and job step', () => {
        const pkg = JSON.parse(readFileSync(path.join(rootRepo, 'package.json'), 'utf8'));
        expect(pkg.scripts['check:succession-retention']).toBe(
            'tsx scripts/check-succession-retention.ts'
        );
        const chain: string = pkg.scripts['check:guards'];
        expect(chain).toContain('pnpm check:succession-retention');
        expect(chain.indexOf('pnpm check:succession-retention')).toBeLessThan(
            chain.indexOf('pnpm check:fake-lies')
        );
        const ci = readFileSync(path.join(rootRepo, '.github/workflows/ci.yml'), 'utf8');
        const block = ci.match(/(?<= {2}guards:\n)[\s\S]*?(?=\n {2}[\w-]+:|$)/)?.[0] ?? '';
        expect(block).toContain('GUARD:G-R1-D');
        expect(block).toContain('pnpm check:succession-retention');
    });
});
