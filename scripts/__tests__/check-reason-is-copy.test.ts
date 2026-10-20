/**
 * @fileoverview
 * TEST:B1:5 (AC:B1:5, INV:D9): GUARD:G9, by mutation. The `reason` the provider
 * shows the customer is copy, never an internal identifier.
 *
 * Each case builds a throwaway git tree with a green authorization call site,
 * applies ONE mutation and runs the guard over it. The spec's mutation (send the
 * subscription id as the `reason` when creating an authorization) turns it red;
 * so does every other shape the header declares. Copy, including copy that
 * interpolates a name, stays green. The real tree is green.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findIdentifierReasons,
    MIN_SCANNED_FILES,
    RULE_MESSAGE,
    run
} from '../check-reason-is-copy.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'apps/api/src/services/subscription-checkout.ts';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes `files` (repo-relative path → content) into a fresh git tree. */
function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g9-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A checkout service that creates an authorization with `reason` set to `reason`. */
const site = ({
    reason
}: {
    readonly reason: string;
}) => `import type { PaymentProvider } from '@repo/payments';

export async function startCheckout({ provider, subscription, plan }: Deps) {
    const result = await provider.authorize({
        reference: subscription.reference,
        amount: { amountMinor: plan.priceMinor, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: ${reason},
        returnUrl: 'https://hospeda.test/return'
    });
    return result.authorizationId;
}
`;

/** Runs the guard over a tree with the call site and an unrelated file. */
function guardOver({ files }: { readonly files: Readonly<Record<string, string>> }) {
    const root = makeTree({
        files: { 'packages/other/src/a.ts': 'export const reasonId = 1;\n', ...files }
    });
    return run({ root, minScannedFiles: 0 });
}

describe('G9 over a green tree', () => {
    it.each([
        ['a literal', "'Plan Anfitrión mensual'"],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test, not a template
        ['a name in copy', '`Suscripción ${plan.displayName}`'],
        ['a translated copy', "t('billing.reason', { plan: plan.name })"],
        ['a copy variable', 'plan.customerFacingName'],
        ['copy with a fallback', "plan.label ?? 'Plan Hospeda'"]
    ])('passes with %s as the reason', (_case, reason) => {
        const { exitCode, output } = guardOver({ files: { [SITE]: site({ reason }) } });
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });

    it('ignores a `reason` that is not part of building an authorization', () => {
        const { exitCode } = guardOver({
            files: {
                'packages/x/src/err.ts':
                    "throw new Rejected({ reason: subscription.id, capability: 'refund' });\n"
            }
        });
        expect(exitCode).toBe(0);
    });
});

describe('TEST:B1:5 — the spec mutation turns G9 red', () => {
    it('sending the subscription id as the reason fails, naming the file and line', () => {
        const { exitCode, output } = guardOver({
            files: { [SITE]: site({ reason: 'subscription.id' }) }
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(RULE_MESSAGE);
        expect(output).toContain(`${SITE}:8`);
        expect(output).toContain("'subscription.id' (an identifier-shaped name)");
    });
});

describe('G9: every identifier shape the header declares', () => {
    it.each([
        ['an *Id variable', 'subscriptionId'],
        ['an *ID constant', 'SUBSCRIPTION_ID'],
        ['a slug', 'plan.slug'],
        ['an *Slug name', 'plan.planSlug'],
        ['our own reference', 'subscription.reference'],
        ['a snake_case id', 'row.plan_id'],
        ['a computed id key', "row['id']"],
        ['an optional chain', 'subscription?.id'],
        ['a String() of an id', 'String(subscription.id)'],
        ['a toString() of an id', 'subscription.id.toString()'],
        ['a non-null id', 'subscription.id!'],
        ['an id cast', 'subscription.id as string'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test, not a template
        ['an id in a template', '`sub-${subscription.id}`'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text under test, not a template
        ['an id inside copy', '`Plan Anfitrión (${subscription.id})`'],
        ['an id concatenated', "'Plan ' + subscription.id"],
        ['an id as a fallback', 'plan.label ?? subscription.id'],
        ['an id in a ternary', "isAnnual ? 'Plan anual' : planId"],
        ['a UUID literal', "'3f2504e0-4f89-11d3-9a0c-0305e82c3301'"],
        ['a slug literal', "'plan-anfitrion-mensual'"],
        ['a snake_case literal', "'host_basic'"],
        ['a number literal', "'12345'"]
    ])('turns red on %s', (_case, reason) => {
        const { exitCode, output } = guardOver({ files: { [SITE]: site({ reason }) } });
        expect(exitCode).toBe(1);
        expect(output).toContain(`${SITE}:8`);
    });

    it('turns red when the authorization is a variable declared in the same file', () => {
        const source = `const input = {\n    reference: sub.reference,\n    reason: sub.id\n};\nawait provider.authorize(input);\n`;
        const { exitCode, output } = guardOver({ files: { [SITE]: source } });
        expect(exitCode).toBe(1);
        expect(output).toContain(`${SITE}:3`);
    });

    it.each([
        [
            'a typed declaration',
            'const input: AuthorizeInput = { reason: planSlug, reference: r };\n'
        ],
        [
            'satisfies',
            'const input = { reason: planSlug, reference: r } satisfies AuthorizeInput;\n'
        ],
        ['an as cast', 'build({ reason: planSlug, reference: r } as AuthorizeInput);\n']
    ])('turns red on an object typed as an authorization (%s)', (_case, source) => {
        const { exitCode, output } = guardOver({ files: { [SITE]: source } });
        expect(exitCode).toBe(1);
        expect(output).toContain(`${SITE}:1`);
    });

    it('turns red on a quoted reason key', () => {
        const { exitCode } = guardOver({
            files: { [SITE]: "await provider.authorize({ 'reason': subscriptionId });\n" }
        });
        expect(exitCode).toBe(1);
    });

    it('stays green when the identifier only appears in a comment', () => {
        const { exitCode } = guardOver({
            files: { [SITE]: site({ reason: "'Plan Anfitrión' /* not subscription.id */" }) }
        });
        expect(exitCode).toBe(0);
    });
});

describe('the predicate, unit by unit', () => {
    it('does not read `paid` or `void` as an *Id name', () => {
        const source = 'await provider.authorize({ reason: invoice.paid, other: x.void });\n';
        expect(findIdentifierReasons({ file: 'a.ts', source })).toEqual([]);
    });

    it('does not follow a shorthand reason (declared limit)', () => {
        const source = 'const reason = sub.id;\nawait provider.authorize({ reason });\n';
        expect(findIdentifierReasons({ file: 'a.ts', source })).toEqual([]);
    });
});

describe('G9 cannot pass vacuously', () => {
    it('fails when fewer files than the floor were scanned', () => {
        const result = run({ root: makeTree({ files: { [SITE]: site({ reason: "'x y'" }) } }) });
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

describe('G9 wiring', () => {
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
        expect(rootPkg.scripts['check:reason-is-copy']).toBe('tsx scripts/check-reason-is-copy.ts');
        const chain = (rootPkg.scripts['check:guards'] ?? '')
            .split('&&')
            .map((step) => step.trim());
        expect(chain).toContain('pnpm check:reason-is-copy');
    });

    it('is a step of the guards job of ci.yml', () => {
        expect(guardsJob).toMatch(/^\s+run: pnpm check:reason-is-copy\s*$/m);
    });
});
