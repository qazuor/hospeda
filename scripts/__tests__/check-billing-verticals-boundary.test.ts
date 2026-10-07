/**
 * @fileoverview
 * TEST:V1:11 (AC:V1:7): GUARD:G14, green on the branch and broken on purpose.
 *
 * Each case builds a throwaway git tree with a billing half and a verticals
 * half, green, applies ONE mutation and runs the guard over it:
 * (1) verticals importing billing: red, naming the file and the half imported;
 * (2) the same import in the composition root of `apps/api`: green;
 * (3) a half importing the shared test package of the adjustable clock: green.
 * The other forms of the predicate (relative escape, a manifest dependency,
 * the reverse direction) and the fail-loud rules are mutated the same way.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { HALVES, type HalfRoots, run } from '../check-billing-verticals-boundary.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The halves of the throwaway trees: a verticals half exists there. */
const ROOTS: HalfRoots = { billing: ['packages/payments'], verticals: ['packages/verticals'] };

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const json = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g14-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A green tree: both halves talk only through the contract. */
const GREEN: Readonly<Record<string, string>> = {
    'package.json': json({ name: 'root' }),
    'packages/billing-verticals-contract/package.json': json({
        name: '@repo/billing-verticals-contract'
    }),
    'packages/billing-verticals-contract/src/index.ts': 'export type X = 1;\n',
    'packages/test-clock/package.json': json({ name: '@repo/test-clock' }),
    'packages/test-clock/src/index.ts': 'export const clock = 1;\n',
    'packages/payments/package.json': json({
        name: '@repo/payments',
        dependencies: { '@repo/billing-verticals-contract': 'workspace:*' }
    }),
    'packages/payments/src/index.ts':
        "import type { X } from '@repo/billing-verticals-contract';\nexport type P = X;\n",
    'packages/verticals/package.json': json({
        name: '@repo/verticals',
        dependencies: { '@repo/billing-verticals-contract': 'workspace:*' }
    }),
    'packages/verticals/src/trial.ts':
        "import type { X } from '@repo/billing-verticals-contract';\nexport type T = X;\n",
    // Prose naming the other half is not an import.
    'packages/verticals/src/note.ts': "// billing lives in '@repo/payments'\nexport const n = 1;\n",
    'apps/api/package.json': json({ name: 'hospeda-api' }),
    'apps/api/src/app.ts': "import { x } from './routes';\nexport const app = x;\n"
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {},
    roots = ROOTS
}: {
    readonly overrides?: Readonly<Record<string, string>>;
    readonly roots?: HalfRoots;
} = {}) {
    return run({
        root: makeTree({ files: { ...GREEN, ...overrides } }),
        roots,
        minScannedFiles: 0
    });
}

describe('TEST:V1:11 G14 on the branch', () => {
    it('is green over the repo, and says the verticals half is still empty', () => {
        const { exitCode, output } = run({ root: REPO_ROOT });
        expect(output).toContain('OK:');
        expect(output).toContain('verticals half: (none registered)');
        expect(output).toContain('NOTE: the verticals half has no folder registered yet');
        expect(exitCode).toBe(0);
    });

    it('declares billing as packages/payments, verticals as empty', () => {
        expect(HALVES).toEqual({ billing: ['packages/payments'], verticals: [] });
    });

    it('is green over a tree where both halves go through the contract', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK: 3 code file(s)');
        expect(output).not.toContain('NOTE:');
        expect(exitCode).toBe(0);
    });
});

describe('TEST:V1:11 G14 broken on purpose', () => {
    it('mutation 1: verticals importing billing is red, naming the file and the half imported', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/verticals/src/trial.ts':
                    "import { FakePaymentProvider } from '@repo/payments';\nexport const p = FakePaymentProvider;\n"
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(
            'FAIL GUARD:G14: code of the verticals half imports the billing half'
        );
        expect(output).toContain(
            "packages/verticals/src/trial.ts:1  imports '@repo/payments' (the billing half)"
        );
    });

    it('mutation 2: the same import in the composition root of apps/api is green', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'apps/api/src/app.ts':
                    "import { FakePaymentProvider } from '@repo/payments';\nimport { v } from '@repo/verticals';\nexport const app = [FakePaymentProvider, v];\n"
            },
            // Even with apps/api/src declared as verticals code, its composition root is exempt.
            roots: {
                billing: ['packages/payments'],
                verticals: ['packages/verticals', 'apps/api/src']
            }
        });
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });

    it('the exemption is the composition root only: another apps/api file declared as verticals is red', () => {
        const { exitCode, output } = guardOver({
            overrides: { 'apps/api/src/routes.ts': "export { x } from '@repo/payments/sub';\n" },
            roots: {
                billing: ['packages/payments'],
                verticals: ['packages/verticals', 'apps/api/src']
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(
            "apps/api/src/routes.ts:1  imports '@repo/payments/sub' (the billing half)"
        );
    });

    it('mutation 3: a half importing the shared test package of the adjustable clock is green', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/verticals/src/trial.test.ts':
                    "import { clock } from '@repo/test-clock';\nexport const c = clock;\n",
                'packages/payments/src/clock.test.ts':
                    "import { clock } from '../../test-clock/src/index';\nexport const c = clock;\n"
            }
        });
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });

    it('billing importing verticals by a relative escape is red, naming the verticals half', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/payments/src/index.ts':
                    "const m = await import('../../verticals/src/trial');\n"
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(
            'FAIL GUARD:G14: code of the billing half imports the verticals half'
        );
        expect(output).toContain('packages/payments/src/index.ts:1');
    });

    it('a half manifest declaring the other half is red', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                'packages/verticals/package.json': json({
                    name: '@repo/verticals',
                    devDependencies: { '@repo/payments': 'workspace:*' }
                })
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(
            'packages/verticals/package.json  devDependencies declares @repo/payments (the billing half)'
        );
    });

    it('a test of a half mocking the other half is red: tests are code of their half', () => {
        const { exitCode } = guardOver({
            overrides: { 'packages/verticals/test/a.test.ts': "vi.mock('@repo/payments');\n" }
        });
        expect(exitCode).toBe(1);
    });
});

describe('G14 fails loud instead of passing an unenforceable rule', () => {
    it('an empty billing half is an error', () => {
        const { exitCode, output } = guardOver({ roots: { billing: [], verticals: [] } });
        expect(exitCode).toBe(1);
        expect(output).toContain('the billing half declares no folder');
    });

    it('a declared folder that holds no file is an error', () => {
        const { exitCode, output } = guardOver({
            roots: { billing: ['packages/paymentz'], verticals: [] }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain("declares 'packages/paymentz', which holds no file");
    });

    it('too few code files in the halves is an error, not a clean tree', () => {
        const { exitCode, output } = run({ root: makeTree({ files: GREEN }), roots: ROOTS });
        expect(exitCode).toBe(1);
        expect(output).toContain('only 3 code file(s) in the halves');
    });
});
