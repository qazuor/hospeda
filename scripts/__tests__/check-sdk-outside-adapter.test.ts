/**
 * @fileoverview
 * TEST:B1:8 (AC:B1:8, DEC-ARCH-004 condition A): GUARD:G12, by mutation. The
 * payment gateway's SDK is imported only inside the adapter.
 *
 * Each case builds a throwaway git tree that is green, applies ONE mutation and
 * runs the guard over it. The spec's mutation (import the Mercado Pago SDK from
 * a service outside the adapter) turns it red, in every import form and in a
 * package.json. The adapter may import and declare it; the fake may not; the
 * word in a string or a comment is not an import. The real tree is green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findSdkDeclarations,
    findSdkImports,
    MIN_SCANNED_FILES,
    RULE_MESSAGE,
    run
} from '../check-sdk-outside-adapter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVICE = 'apps/api/src/services/subscription-checkout.ts';
const ADAPTER = 'packages/payments/src/adapters/mercadopago/mercadopago-payment-provider.ts';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g12-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

const manifest = (deps: Readonly<Record<string, string>> = {}) =>
    `${JSON.stringify({ name: '@repo/x', dependencies: { zod: '^4.0.0', ...deps } }, null, 4)}\n`;

const GREEN: Readonly<Record<string, string>> = {
    [SERVICE]:
        "import type { PaymentProvider } from '@repo/payments';\n" +
        "// never import 'mercadopago' here\n" +
        "export const provider = 'mercadopago';\n" +
        'export const go = (p: PaymentProvider) => p;\n',
    // The adapter may import the SDK, and the payments package's own manifest declare it.
    [ADAPTER]:
        "import { MercadoPagoConfig } from 'mercadopago';\nexport const c = MercadoPagoConfig;\n",
    'packages/payments/package.json': manifest({ mercadopago: '^2.0.0' }),
    'package.json': manifest()
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('G12 over a green tree', () => {
    it('passes: imported only in the adapter, declared only by packages/payments/package.json; the word in a string or a comment is no import', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:8 — the spec mutation turns G12 red', () => {
    it('importing the Mercado Pago SDK from a service outside the adapter fails, naming the line', () => {
        const { exitCode, output } = guardOver({
            overrides: {
                [SERVICE]: `${GREEN[SERVICE]}import { MercadoPagoConfig } from 'mercadopago';\n`
            }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGE);
        expect(output).toContain(`${SERVICE}:5`);
    });
});

describe('G12: every import form and every place', () => {
    it.each([
        ['a side-effect import', "import 'mercadopago';\n"],
        ['a type import', "import type { Payment } from 'mercadopago';\n"],
        ['a re-export', "export * from 'mercadopago';\n"],
        ['a dynamic import', "const sdk = await import('mercadopago');\n"],
        ['a template dynamic import', 'const sdk = await import(`mercadopago`);\n'],
        ['a require', "const sdk = require('mercadopago');\n"],
        ['a require.resolve', "const where = require.resolve('mercadopago');\n"],
        ['a TS import-require', "import sdk = require('mercadopago');\n"],
        ['a subpath', "import { x } from 'mercadopago/dist/clients';\n"],
        ['a scoped package', "import { y } from '@mercadopago/sdk-react';\n"]
    ])('turns red on %s', (_case, source) => {
        const { exitCode, output } = guardOver({ overrides: { 'packages/x/src/a.ts': source } });
        expect(exitCode).toBe(1);
        expect(output).toContain('packages/x/src/a.ts:1');
    });

    it.each([
        ['the fake', 'packages/payments/src/fake/fake-payment-provider.ts'],
        ['the payments interface', 'packages/payments/src/provider/payment-provider.ts'],
        ['a test', 'apps/api/test/services/checkout.test.ts'],
        ['a script', 'scripts/cutover/step.ts'],
        ['an astro page', 'apps/web/src/pages/checkout.astro']
    ])('turns red in %s', (_case, file) => {
        const source = file.endsWith('.astro')
            ? "---\nimport { MercadoPagoConfig } from 'mercadopago';\n---\n<p/>\n"
            : "import { MercadoPagoConfig } from 'mercadopago';\n";
        const { exitCode, output } = guardOver({ overrides: { [file]: source } });
        expect(exitCode).toBe(1);
        expect(output).toContain(file);
    });

    it.each([
        ['the root package.json', 'package.json', { mercadopago: '^2.0.0' }],
        [
            'a manifest nested under the adapters',
            'packages/payments/src/adapters/mercadopago/package.json',
            { mercadopago: '^2.0.0' }
        ],
        ['another package.json', 'packages/billing/package.json', { mercadopago: '^2.0.0' }],
        [
            'an app package.json, scoped',
            'apps/web/package.json',
            { '@mercadopago/sdk-react': '^1.0.0' }
        ],
        ['an npm alias', 'apps/api/package.json', { mp: 'npm:mercadopago@2.0.0' }]
    ])('turns red when %s declares the SDK', (_case, file, deps) => {
        const { exitCode, output } = guardOver({ overrides: { [file]: manifest(deps) } });
        expect(exitCode).toBe(1);
        expect(output).toContain(file);
    });
});

describe('the predicate, unit by unit', () => {
    it('does not read a member call named import or require as an import', () => {
        const source =
            "loader.import('mercadopago');\nx.require('mercadopago');\nconst o = { from: 'mercadopago' };\n";
        expect(findSdkImports({ file: 'a.ts', source })).toEqual([]);
    });

    it('does not take a package that only starts with the name for the SDK', () => {
        expect(
            findSdkImports({ file: 'a.ts', source: "import x from 'mercadopago-helpers';\n" })
        ).toEqual([]);
        expect(
            findSdkDeclarations({
                file: 'p.json',
                source: manifest({ 'mercadopago-helpers': '1' })
            })
        ).toEqual([]);
    });

    it('reports a manifest that is not JSON instead of passing it', () => {
        expect(findSdkDeclarations({ file: 'p.json', source: '{ nope' })).toHaveLength(1);
    });
});

describe('G12 cannot pass vacuously', () => {
    it('fails when fewer files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: GREEN }) });
        expect(MIN_SCANNED_FILES).toBe(1000);
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('not a clean tree');
    });

    it('is green over this repository', { timeout: 60_000 }, () => {
        const result = run({ root: REPO_ROOT });
        expect(result.output).toContain('OK:');
        expect(result.exitCode).toBe(0);
    });
});

describe('G12 wiring', () => {
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
        expect(rootPkg.scripts['check:sdk-outside-adapter']).toBe(
            'tsx scripts/check-sdk-outside-adapter.ts'
        );
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:sdk-outside-adapter');
    });

    it('is a named step of the guards job of ci.yml', () => {
        expect(guardsJob).toContain('(GUARD:G12)');
        expect(guardsJob).toMatch(/^\s+run: pnpm check:sdk-outside-adapter\s*$/m);
    });
});
