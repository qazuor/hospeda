/**
 * @fileoverview
 * TEST:B1:7 (AC:B1:7, INV:D12): GUARD:G11, by mutation. A trial is never asked
 * of the provider: its clock is ours.
 *
 * Each case builds a throwaway git tree with a green authorization call site,
 * applies ONE mutation and runs the guard over it. The spec's mutation (add
 * `free_trial` to the creation of an authorization) turns it red, in every
 * spelling. The fake and the adapter are not read (M9 is legitimate there), and
 * a file that builds no authorization may talk about our own trial. The real
 * tree is green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findProviderTrialRequests,
    MIN_SCANNED_FILES,
    RULE_MESSAGE,
    run
} from '../check-no-provider-trial.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'apps/api/src/services/subscription-checkout.ts';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g11-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A checkout service that creates an authorization, plus `extra` properties. */
const site = ({
    extra = ''
}: {
    readonly extra?: string;
} = {}) => `export async function startCheckout({ provider, plan }: Deps) {
    return provider.authorize({
        reference: plan.reference,
        amount: { amountMinor: plan.priceMinor, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Plan Anfitrión mensual',${extra}
        returnUrl: 'https://hospeda.test/return'
    });
}
`;

const GREEN: Readonly<Record<string, string>> = {
    [SITE]: site(),
    // M9 lives in the fake, the provider's fields in the adapter: not read.
    'packages/payments/src/fake/fake.ts':
        'export const authorize = (input: AuthorizeInput) => ({ ...input, freeTrial: true });\n',
    'packages/payments/src/adapters/mercadopago/adapter.ts':
        'export function authorize(i: AuthorizeInput) { return { auto_recurring: { free_trial: null } }; }\n',
    // Our own trial clock, in a file that builds no authorization.
    'apps/api/src/services/trial-clock.ts': 'export const freeTrialDays = 14;\n',
    // Prose in a comment of a file that does build one.
    'apps/api/src/services/other-checkout.ts':
        '// never send free_trial here\nexport const go = (p: P) => p.authorize({ reason: "Plan" });\n'
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('G11 over a green tree', () => {
    it('passes: no trial requested; the fake, the adapter and our own trial clock are left alone', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:7 — the spec mutation turns G11 red', () => {
    it('adding free_trial to the creation of an authorization fails, naming the line', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                [SITE]: site({
                    extra: '\n        free_trial: { frequency: 14, frequency_type: "days" },'
                })
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGE);
        expect(output).toContain(`${SITE}:7`);
    });
});

describe('G11: every spelling and every shape of a file that builds an authorization', () => {
    it.each([
        ['camelCase', '\n        freeTrial: { days: 14 },'],
        ['a days field', '\n        freeTrialDays: 14,'],
        ['the offset', '\n        first_invoice_offset: 14,'],
        ['the camelCase offset', '\n        firstInvoiceOffset: 14,'],
        ['a quoted key', "\n        'free_trial': x,"],
        ['a spread of a trial', '\n        ...trial.freeTrial,']
    ])('turns red on %s', (_case, extra) => {
        const { exitCode, output } = guardOver({ overrides: { [SITE]: site({ extra }) } });
        expect(exitCode).toBe(1);
        expect(output).toContain(`${SITE}:7`);
    });

    it.each([
        [
            'names AuthorizeInput',
            'const input: AuthorizeInput = build();\nconst withTrial = { ...input, free_trial: t };\n'
        ],
        ['names the schema', 'AuthorizeInputSchema.parse({ freeTrial: t });\n'],
        ['calls an optional authorize', 'await provider.authorize?.({ freeTrial: t });\n']
    ])('turns red in a file that %s', (_case, source) => {
        const { exitCode } = guardOver({ overrides: { 'packages/x/src/a.ts': source } });
        expect(exitCode).toBe(1);
    });

    it('reads the payments interface folder (only the fake and the adapters are left out)', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/payments/src/provider/payment-provider.ts':
                    'export interface AuthorizeInput { readonly freeTrial?: number }\n'
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain('packages/payments/src/provider/payment-provider.ts:1');
    });
});

describe('the predicate, unit by unit', () => {
    it('leaves a file that builds no authorization alone', () => {
        expect(
            findProviderTrialRequests({ file: 'a.ts', source: 'export const freeTrial = 1;\n' })
        ).toEqual([]);
    });

    it('does not count authorize named only in a comment or a string', () => {
        const source =
            "// provider.authorize(x)\nconst s = 'authorize(';\nexport const freeTrial = 1;\n";
        expect(findProviderTrialRequests({ file: 'a.ts', source })).toEqual([]);
    });
});

describe('G11 cannot pass vacuously', () => {
    it('fails when fewer files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: GREEN }) });
        expect(MIN_SCANNED_FILES).toBe(1000);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not a clean tree');
    });

    it('is green over this repository', { timeout: 30_000 }, () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});

describe('G11 wiring', () => {
    const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
        readonly scripts: Readonly<Record<string, string>>;
    };
    const ci = readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8').split('\n');
    const start = ci.indexOf('  guards:');
    const end = ci.findIndex(
        (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
    );
    const guardsJob = start === -1 ? '' : ci.slice(start, end === -1 ? undefined : end).join('\n');

    it('has its own script and is part of pnpm check:guards', () => {
        expect(rootPkg.scripts['check:no-provider-trial']).toBe(
            'tsx scripts/check-no-provider-trial.ts'
        );
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:no-provider-trial');
    });

    it('is a step of the guards job of ci.yml', () => {
        expect(guardsJob).toMatch(/^\s+run: pnpm check:no-provider-trial\s*$/m);
    });
});
