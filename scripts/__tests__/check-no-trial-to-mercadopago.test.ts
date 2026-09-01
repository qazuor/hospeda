/**
 * @fileoverview
 * HOS-1012 T-024: the POSITIVE CONTROL for `check-no-trial-to-mercadopago.sh`
 * (guard G-1).
 *
 * A guard that is green over a clean tree has proved nothing — it would be
 * equally green if its regexes matched no input at all, or if its file
 * derivation silently returned an empty list. So this file never asserts "the
 * repo is clean". It points the guard at fixtures that REINTRODUCE a banned
 * field and asserts it exits 1, and at near-miss fixtures and asserts it does
 * not.
 *
 * The script exposes one test-injection env var for exactly this, mirroring
 * `CHANGED_FILES_OVERRIDE` in check-seed-dual-write.sh:
 *
 *   - `SCAN_FILES_OVERRIDE` — a newline-separated list of paths, used verbatim
 *     instead of deriving the in-scope files from their qzpay imports.
 *
 * Each test spawns the real script as a subprocess, asserting exit code and
 * stdout — the same "drive the artifact directly" style the sibling guard
 * tests use, since the artifact under test is bash rather than a TS module.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-no-trial-to-mercadopago.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

function runGuard(env: Record<string, string>): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: REPO_ROOT,
            env: { ...process.env, ...env },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout ?? '' };
    }
}

let workDir: string;

/** Writes a fixture and returns its absolute path. */
function fixture(name: string, contents: string): string {
    const filePath = path.join(workDir, name);
    writeFileSync(filePath, contents, 'utf8');
    return filePath;
}

function scan(filePath: string): RunResult {
    return runGuard({ SCAN_FILES_OVERRIDE: filePath });
}

beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'g1-no-trial-'));
});

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe('check-no-trial-to-mercadopago.sh — it fails when a trial comes back', () => {
    it('rejects freeTrialDays as an explicit key in a create payload', () => {
        const file = fixture(
            'explicit-key.ts',
            [
                'const sub = await billing.subscriptions.create({',
                "    mode: 'paid',",
                '    freeTrialDays: 30',
                '});'
            ].join('\n')
        );

        const result = scan(file);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('a free trial reaches MercadoPago');
        expect(result.stdout).toContain('freeTrialDays: 30');
    });

    it('rejects the conditional-spread shorthand the checkout used to carry', () => {
        // The exact form removed from every checkout path by T-021. A spread
        // that provably cannot fire is still text the guard has to see.
        const file = fixture(
            'conditional-spread.ts',
            [
                'const sub = await create({',
                "    mode: 'paid',",
                '    ...(freeTrialDays === undefined ? {} : { freeTrialDays }),',
                '});'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects freeTrialDays reintroduced as a typed field on the create input', () => {
        // Removing the FIELD is what makes callers unable to pass one by
        // accident, so putting it back has to trip the guard even before any
        // call site uses it.
        const file = fixture(
            'typed-field.ts',
            [
                'export interface CreatePaidSubscriptionInput {',
                '    readonly freeTrialDays?: number;',
                '}'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects free_trial nested inside auto_recurring', () => {
        // Nesting is the case a shallow, top-level-only check would miss —
        // and `auto_recurring` is exactly where MercadoPago carries it.
        const file = fixture(
            'nested-free-trial.ts',
            [
                'const body = {',
                '    auto_recurring: { frequency: 1, free_trial: { frequency: 30 } }',
                '};'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects start_date, the other half of the same mechanism', () => {
        // HOS-171 measured that a start date and a free trial defer the first
        // charge the same way. Banning only the field that caused HOS-522
        // would leave the door open and the next incident would read as a
        // different bug.
        const file = fixture(
            'start-date.ts',
            ['const body = {', '    auto_recurring: { start_date: isoNow }', '};'].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects a quoted key', () => {
        const file = fixture(
            'quoted-key.ts',
            ["const body = { auto_recurring: { 'free_trial': trial } };"].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects freeTrialDays destructured into scope', () => {
        const file = fixture(
            'destructure.ts',
            ['const { freeTrialDays } = resolveCheckoutTrial(input);'].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });
});

describe('check-no-trial-to-mercadopago.sh — its regexes are anchored', () => {
    // A repo precedent: an unanchored guard watching `data-astro-reload` let
    // `data-astro-reloadX` straight through. These pin both fences.
    it('does not trip on a longer identifier that merely contains a banned name', () => {
        // Both fences, deliberately. The SUFFIX cases (`planfreeTrialDays:`)
        // are what pin the LEFT anchor: without it the pattern would match the
        // tail of an unrelated identifier and the guard would cry wolf. The
        // PREFIX cases pin the right one. An earlier version of this fixture
        // used `legacyFreeTrialDays` — a capital F, which the alternation
        // could never match anyway — and a mutation that stripped the left
        // anchor entirely survived it.
        const file = fixture(
            'near-miss.ts',
            [
                'const a = { freeTrialDaysRemaining: 3 };',
                'const b = { planfreeTrialDays: 1 };',
                'const c = { extrafree_trial: true };',
                'const d = { effectivestart_date: today };',
                'const e = { freeTrialDaysX, freeTrialDaysY };'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });

    it('does not trip on a member READ of a provider payload', () => {
        // The read direction is HOS-936's guard
        // (check-trial-not-derived-from-free-trial.sh). This one is the write
        // direction: a payload being BUILT, not one being inspected.
        const file = fixture(
            'member-read.ts',
            [
                'if (params.startDate) { applyFilter(params.startDate); }',
                'const declared = preapproval.auto_recurring.free_trial;'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });

    it('does not trip on prose in comments', () => {
        // The module docblocks that explain the ban have to name the fields.
        const file = fixture(
            'prose.ts',
            [
                '// freeTrialDays: 30 is banned since HOS-1012',
                ' * free_trial and start_date are the same mechanism',
                '/* start_date: never send this */'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });

    it("does not trip on Hospeda's OWN local trial columns", () => {
        // The whole point of HOS-1012 is that the trial still exists — locally.
        // A guard that blocked writing our own `trialStart`/`trialEnd` would be
        // banning the replacement along with the thing it replaces.
        const file = fixture(
            'local-trial.ts',
            [
                'await tx.insert(billingSubscriptions).values({',
                "    status: 'trialing',",
                '    trialStart: now,',
                '    trialEnd: addDays(now, 30)',
                '});'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });
});

describe('check-no-trial-to-mercadopago.sh — it cannot pass vacuously', () => {
    it('reports a non-zero in-scope file count from the REAL derivation', () => {
        // A green run over ZERO files is the classic silent fail-open: the
        // guard would keep exiting 0 forever if the source roots moved or the
        // qzpay packages were renamed, and nobody would notice because the
        // symptom is a pass. The script refuses outright on an empty scope; this
        // asserts the count it actually reports is non-zero, so "it passed" can
        // never quietly mean "it looked at nothing".
        const result = runGuard({});

        expect(result.stdout).toMatch(/Scanning [1-9]\d* production file\(s\)/);
    });

    it('passes over the repo as it stands', () => {
        // Last, and deliberately least: on its own this asserts nothing, which
        // is why every test above exists. It is here so a real regression in
        // the tree is reported by this suite too, not only by CI.
        const result = runGuard({});

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('no trial field reaches MercadoPago');
    });
});
