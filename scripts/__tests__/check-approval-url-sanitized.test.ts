/**
 * @fileoverview
 * TEST:B1:6 (AC:B1:6, INV:D10): GUARD:G10, by mutation. The provider's approval
 * link is never shown without going through `sanitizeApprovalUrl` (EX-37: it
 * arrives broken).
 *
 * Each case builds a throwaway git tree with a green surface (the link read
 * through the sanitizer), applies ONE mutation and runs the guard over it. The
 * spec's mutation (hand a surface the link as it comes from the adapter,
 * skipping the sanitizer) turns it red; so does naming the provider's own field.
 * The payments package, its fake and its adapter, are not read. The real tree
 * is green. The sanitizer's own behaviour is `packages/payments/test/approval-url.test.ts`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findRawApprovalLinks,
    MIN_SCANNED_FILES,
    RULE_MESSAGES,
    run
} from '../check-approval-url-sanitized.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROUTE = 'apps/api/src/routes/subscription/protected/start.ts';
const PAGE = 'apps/web/src/components/billing/Checkout.client.tsx';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g10-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A route that starts a checkout and returns the link to the web surface. */
const route = ({
    link
}: {
    readonly link: string;
}) => `import { sanitizeApprovalUrl } from '@repo/payments';

export async function start({ c, provider, input }: Deps) {
    const result = await provider.authorize(input);
    return c.json({ checkoutUrl: ${link} });
}
`;

const GREEN: Readonly<Record<string, string>> = {
    [ROUTE]: route({ link: 'sanitizeApprovalUrl(result).url' }),
    // The package itself defines and returns the raw link: not read.
    'packages/payments/src/provider/payment-provider.ts':
        'export interface AuthorizeResult { readonly approvalUrl: string }\n',
    'packages/payments/src/fake/fake.ts':
        "export const r = { approvalUrl: 'https://x.invalid/a?activation=true' };\n",
    'packages/payments/src/adapters/mercadopago/adapter.ts':
        'export const toResult = (p: { init_point: string }) => ({ approvalUrl: p.init_point });\n',
    // Prose naming the field, in a comment and in a description string.
    'packages/schemas/src/checkout.schema.ts':
        "// the old init_point\nexport const d = z.string().describe('init_point to redirect to');\n"
};

/** Runs the guard over GREEN plus `overrides`. */
function guardOver({
    overrides = {}
}: {
    readonly overrides?: Readonly<Record<string, string>>;
} = {}) {
    return run({ root: makeTree({ files: { ...GREEN, ...overrides } }), minScannedFiles: 0 });
}

describe('G10 over a green tree', () => {
    it('passes: the surface reads the link through sanitizeApprovalUrl; the package is not read', () => {
        const { exitCode, output } = guardOver();
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });

    it('passes with the raw field read inside the sanitizer call', () => {
        const { exitCode } = guardOver({
            overrides: {
                [ROUTE]: route({
                    link: 'sanitizeApprovalUrl({ approvalUrl: result.approvalUrl }).url'
                })
            }
        });
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:6 — the spec mutation turns G10 red', () => {
    it('handing the surface the link as the adapter returned it fails, naming predicate (b)', () => {
        const { exitCode, output } = guardOver({
            overrides: { [ROUTE]: route({ link: 'result.approvalUrl' }) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G10(b)']);
        expect(output).toContain(`${ROUTE}:5`);
        expect(output).not.toContain(RULE_MESSAGES['G10(a)']);
    });
});

describe('G10 predicate (b): every other way of reading the raw link', () => {
    it.each([
        [
            'a destructuring',
            'const { approvalUrl } = await provider.authorize(input);\nexport const u = approvalUrl;\n'
        ],
        ['a computed key', "export const u = result['approvalUrl'];\n"],
        ['an optional chain', 'export const u = result?.approvalUrl;\n'],
        ['a type position', 'export interface CheckoutResponse { readonly approvalUrl: string }\n'],
        ['a schema key', 'export const S = z.object({ approvalUrl: z.string() });\n'],
        [
            'a read next to (not inside) the sanitizer',
            'sanitizeApprovalUrl(result);\nexport const u = result.approvalUrl;\n'
        ],
        ['a JSX attribute', 'export const A = ({ r }: P) => <a href={r.approvalUrl}>Pagar</a>;\n']
    ])('turns red on %s', (_case, source) => {
        const { exitCode, output } = guardOver({ overrides: { [PAGE]: source } });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G10(b)']);
        expect(output).toContain(PAGE);
    });
});

describe("G10 predicate (a): the provider's own field outside the package", () => {
    it.each([
        ['snake_case', 'export const u = (p: Raw) => p.init_point;\n'],
        ['the sandbox one', 'export const u = (p: Raw) => p.sandbox_init_point;\n'],
        ['camelCase', 'export const u = (p: Raw) => p.initPoint;\n'],
        ['a prefixed variable', 'export const mpInitPoint = 1;\n'],
        ['a computed key', "export const u = (p: Raw) => p['init_point'];\n"]
    ])('turns red on %s, naming predicate (a)', (_case, source) => {
        const { exitCode, output } = guardOver({ overrides: { [PAGE]: source } });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGES['G10(a)']);
        expect(output).toContain(`${PAGE}:1`);
    });
});

describe('the predicates, unit by unit', () => {
    it('reads code inside a template interpolation', () => {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test, not a template
        const source = 'export const s = `go to ${result.approvalUrl} now`;\n';
        expect(findRawApprovalLinks({ file: 'a.ts', source })).toHaveLength(1);
    });

    it('does not read the name inside a comment or as prose in a string', () => {
        const source =
            '/* result.approvalUrl */\nexport const s = `approvalUrl is raw`;\n// approvalUrl\n';
        expect(findRawApprovalLinks({ file: 'a.ts', source })).toEqual([]);
    });
});

describe('G10 cannot pass vacuously', () => {
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

    it('the sanitizer it points to is exported by @repo/payments', () => {
        const index = readFileSync(path.join(REPO_ROOT, 'packages/payments/src/index.ts'), 'utf8');
        expect(index).toMatch(/\bsanitizeApprovalUrl\b/);
    });
});

describe('G10 wiring', () => {
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
        expect(rootPkg.scripts['check:approval-url-sanitized']).toBe(
            'tsx scripts/check-approval-url-sanitized.ts'
        );
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:approval-url-sanitized');
    });

    it('is a step of the guards job of ci.yml', () => {
        expect(guardsJob).toMatch(/^\s+run: pnpm check:approval-url-sanitized\s*$/m);
    });
});
